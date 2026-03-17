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

  // Normalize address
  const street = address
    .toUpperCase()
    .split(',')[0]
    .replace(/\b(CHICAGO|IL|ILLINOIS)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Find landlord entities linked to this address
  const { data: addrRows } = await supabase
    .from('addresses')
    .select('landlord_id')
    .ilike('address', `%${street}%`);

  if (!addrRows || addrRows.length === 0) {
    return NextResponse.json({ reviews: [], responses: {} });
  }

  const landlordIds = [...new Set(addrRows.map((a) => a.landlord_id).filter(Boolean))];
  if (landlordIds.length === 0) {
    return NextResponse.json({ reviews: [], responses: {} });
  }

  // Fetch approved reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, text, good_text, bad_text, duration_lived, would_recommend, created_at')
    .in('landlord_id', landlordIds)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!reviews || reviews.length === 0) {
    return NextResponse.json({ reviews: [], responses: {} });
  }

  // Fetch management responses for these reviews
  // Responses are stored with violation_id = "review_{reviewId}"
  const reviewIds = reviews.map((r) => `review_${r.id}`);

  // Find claimed buildings for this address
  const { data: buildings } = await supabase
    .from('claimed_buildings')
    .select('id')
    .eq('verification_status', 'approved')
    .ilike('address', `${street}%`);

  const responses: Record<string, { response_text: string; created_at: string; company_name: string | null }> = {};

  if (buildings && buildings.length > 0) {
    const buildingIds = buildings.map((b) => b.id);
    const { data: resps } = await supabase
      .from('landlord_responses')
      .select('violation_id, response_text, created_at, landlord_id')
      .in('building_id', buildingIds)
      .in('violation_id', reviewIds);

    if (resps) {
      // Get company names for respondents
      const landlordProfileIds = [...new Set(resps.map((r) => r.landlord_id))];
      const { data: profiles } = await supabase
        .from('landlord_profiles')
        .select('id, company_name')
        .in('id', landlordProfileIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.company_name]) || []);

      for (const r of resps) {
        if (r.violation_id) {
          const reviewId = r.violation_id.replace('review_', '');
          responses[reviewId] = {
            response_text: r.response_text,
            created_at: r.created_at,
            company_name: profileMap.get(r.landlord_id) || null,
          };
        }
      }
    }
  }

  return NextResponse.json({ reviews, responses });
}
