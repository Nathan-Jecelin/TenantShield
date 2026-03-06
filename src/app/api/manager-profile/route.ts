import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(ip, 30)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const slug = req.nextUrl.searchParams.get('slug')?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  // Fetch profile
  const { data: profile, error: profileErr } = await supabase
    .from('landlord_profiles')
    .select('id, company_name, bio, website, public_phone, public_email, logo_url, years_in_business, verified, profile_visible')
    .eq('slug', slug)
    .eq('profile_visible', true)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Fetch approved claimed buildings
  const { data: buildings } = await supabase
    .from('claimed_buildings')
    .select('id, address, verification_status')
    .eq('landlord_id', profile.id)
    .eq('verification_status', 'approved');

  const buildingList = buildings || [];

  // Normalize addresses for matching
  const normalizedAddresses = buildingList.map((b) =>
    b.address.toUpperCase().split(',')[0].replace(/\b(CHICAGO|IL|ILLINOIS)\b/g, '').replace(/\s+/g, ' ').trim()
  );

  // Fetch reviews via address → landlord entity → reviews chain
  const buildingStats: { address: string; slug: string; avgRating: number; reviewCount: number }[] = [];
  const allReviews: { rating: number }[] = [];

  for (let i = 0; i < buildingList.length; i++) {
    const addr = normalizedAddresses[i];
    let buildingReviews: { rating: number }[] = [];

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
        if (reviews) buildingReviews = reviews;
      }
    }

    const avgRating = buildingReviews.length > 0
      ? Math.round((buildingReviews.reduce((s, r) => s + r.rating, 0) / buildingReviews.length) * 10) / 10
      : 0;

    const addressSlug = buildingList[i].address
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    buildingStats.push({
      address: buildingList[i].address,
      slug: addressSlug,
      avgRating,
      reviewCount: buildingReviews.length,
    });

    allReviews.push(...buildingReviews);
  }

  // Aggregate stats
  const totalReviews = allReviews.length;
  const avgRating = totalReviews > 0
    ? Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / totalReviews) * 10) / 10
    : 0;

  // Response rate: count landlord_responses for this landlord's buildings
  let responseCount = 0;
  for (const addr of normalizedAddresses) {
    const { data: addrRows } = await supabase
      .from('addresses')
      .select('landlord_id')
      .ilike('address', `${addr}%`);

    if (addrRows && addrRows.length > 0) {
      const landlordIds = [...new Set(addrRows.map((a) => a.landlord_id).filter(Boolean))];
      if (landlordIds.length > 0) {
        const { count } = await supabase
          .from('landlord_responses')
          .select('*', { count: 'exact', head: true })
          .in('landlord_id', landlordIds)
          .like('violation_id', 'review_%');
        responseCount += count || 0;
      }
    }
  }

  const responseRate = totalReviews > 0
    ? Math.round((responseCount / totalReviews) * 100)
    : 0;

  return NextResponse.json({
    profile: {
      company_name: profile.company_name,
      bio: profile.bio,
      website: profile.website,
      public_phone: profile.public_phone,
      public_email: profile.public_email,
      logo_url: profile.logo_url,
      years_in_business: profile.years_in_business,
      verified: profile.verified,
    },
    buildings: buildingStats,
    stats: {
      totalBuildings: buildingList.length,
      avgRating,
      totalReviews,
      responseRate,
    },
  });
}
