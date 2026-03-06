import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(ip, 30)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const address = req.nextUrl.searchParams.get('address')?.trim();
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  // Normalize: uppercase, strip city/state words, collapse spaces, prefix match
  const street = address
    .toUpperCase()
    .split(',')[0]
    .replace(/\b(CHICAGO|IL|ILLINOIS)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const { data, error } = await supabase
    .from('claimed_buildings')
    .select('claimant_role, verification_status, claimed_at, landlord_id')
    .ilike('address', `${street}%`)
    .in('verification_status', ['pending', 'approved'])
    .order('claimed_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Building claim lookup error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ claim: null });
  }

  // Fetch company_name and plan from landlord_profiles
  let companyName: string | null = null;
  const { data: profile } = await supabase
    .from('landlord_profiles')
    .select('company_name, verified, plan, slug, logo_url')
    .eq('id', data.landlord_id)
    .single();

  if (profile) {
    companyName = profile.company_name;
  }

  // Compute avg rating and response rate for this landlord
  let avgRating = 0;
  let responseRate = 0;

  if (profile) {
    // Get all approved buildings for this landlord to compute aggregate stats
    const { data: allBuildings } = await supabase
      .from('claimed_buildings')
      .select('address')
      .eq('landlord_id', data.landlord_id)
      .eq('verification_status', 'approved');

    if (allBuildings && allBuildings.length > 0) {
      const normalizedAddrs = allBuildings.map((b) =>
        b.address.toUpperCase().split(',')[0].replace(/\b(CHICAGO|IL|ILLINOIS)\b/g, '').replace(/\s+/g, ' ').trim()
      );

      const allReviews: { rating: number }[] = [];
      let totalResponses = 0;

      for (const addr of normalizedAddrs) {
        const { data: addrRows } = await supabase
          .from('addresses')
          .select('landlord_id')
          .ilike('address', `${addr}%`);

        if (addrRows && addrRows.length > 0) {
          const landlordIds = [...new Set(addrRows.map((a) => a.landlord_id).filter(Boolean))];
          if (landlordIds.length > 0) {
            const { data: reviews } = await supabase
              .from('reviews')
              .select('rating')
              .in('landlord_id', landlordIds)
              .eq('moderation_status', 'approved');
            if (reviews) allReviews.push(...reviews);

            const { count } = await supabase
              .from('landlord_responses')
              .select('*', { count: 'exact', head: true })
              .in('landlord_id', landlordIds)
              .like('violation_id', 'review_%');
            totalResponses += count || 0;
          }
        }
      }

      if (allReviews.length > 0) {
        avgRating = Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length) * 10) / 10;
        responseRate = Math.round((totalResponses / allReviews.length) * 100);
      }
    }
  }

  return NextResponse.json({
    claim: {
      company_name: companyName,
      claimant_role: data.claimant_role,
      verification_status: data.verification_status,
      claimed_at: data.claimed_at,
      verified: profile?.verified ?? false,
      plan: profile?.plan ?? 'free',
      slug: profile?.slug ?? null,
      logo_url: profile?.logo_url ?? null,
      avg_rating: avgRating,
      response_rate: responseRate,
    },
  });
}
