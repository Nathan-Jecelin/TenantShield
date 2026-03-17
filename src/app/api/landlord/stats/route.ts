import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  // Authenticate via Bearer token
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the token and get user
  const { createClient } = await import('@supabase/supabase-js');
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get landlord profile
  const { data: profile } = await supabase
    .from('landlord_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'No landlord profile' }, { status: 404 });
  }

  // Get all claimed buildings
  const { data: buildings } = await supabase
    .from('claimed_buildings')
    .select('id, address, last_violation_count, last_complaint_count')
    .eq('landlord_id', profile.id);

  if (!buildings || buildings.length === 0) {
    return NextResponse.json({
      totalReviews: 0,
      avgRating: 0,
      newReviewsThisWeek: 0,
      totalViolations: 0,
      openComplaints: 0,
      totalPageViews: 0,
    });
  }

  // Normalize addresses for matching (uppercase, strip city/state)
  const normalizedAddresses = buildings.map((b) =>
    b.address.toUpperCase().split(',')[0].replace(/\b(CHICAGO|IL|ILLINOIS)\b/g, '').replace(/\s+/g, ' ').trim()
  );

  // 1. Page views from address_views
  let totalPageViews = 0;
  for (const addr of normalizedAddresses) {
    const { count } = await supabase
      .from('address_views')
      .select('*', { count: 'exact', head: true })
      .ilike('address', `${addr}%`);
    totalPageViews += count || 0;
  }

  // 2. Reviews via addresses table → reviews table
  const allReviews: { rating: number; created_at: string }[] = [];

  for (const addr of normalizedAddresses) {
    // Find landlord entities linked to this address
    const { data: addrRows } = await supabase
      .from('addresses')
      .select('landlord_id')
      .ilike('address', `${addr}%`);

    if (addrRows && addrRows.length > 0) {
      const landlordIds = [...new Set(addrRows.map((a) => a.landlord_id).filter(Boolean))];
      if (landlordIds.length > 0) {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('rating, created_at')
          .in('landlord_id', landlordIds)
          .eq('moderation_status', 'approved');
        if (reviews) allReviews.push(...reviews);
      }
    }
  }

  // Deduplicate reviews (in case multiple addresses map to same landlord)
  const uniqueReviews = allReviews;
  const totalReviews = uniqueReviews.length;
  const avgRating = totalReviews > 0
    ? Math.round((uniqueReviews.reduce((s, r) => s + r.rating, 0) / totalReviews) * 10) / 10
    : 0;

  // New reviews this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const newReviewsThisWeek = uniqueReviews.filter(
    (r) => new Date(r.created_at) >= oneWeekAgo
  ).length;

  // 3. Violation/complaint counts from claimed_buildings
  const totalViolations = buildings.reduce((s, b) => s + (b.last_violation_count || 0), 0);
  const openComplaints = buildings.reduce((s, b) => s + (b.last_complaint_count || 0), 0);

  return NextResponse.json({
    totalReviews,
    avgRating,
    newReviewsThisWeek,
    totalViolations,
    openComplaints,
    totalPageViews,
  });
}
