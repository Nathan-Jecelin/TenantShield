import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ reviews: [] });
  }

  // Fetch 5 most recent approved reviews that have text content
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, good_text, bad_text, created_at, landlord_id, duration_lived')
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!reviews || reviews.length === 0) {
    return NextResponse.json({ reviews: [] });
  }

  // Get landlord IDs to fetch addresses
  const landlordIds = [...new Set(reviews.map((r) => r.landlord_id).filter(Boolean))];

  let addressMap: Record<string, string> = {};
  if (landlordIds.length > 0) {
    const { data: addresses } = await supabase
      .from('addresses')
      .select('landlord_id, address')
      .in('landlord_id', landlordIds);

    if (addresses) {
      // Take first address per landlord
      for (const a of addresses) {
        if (!addressMap[a.landlord_id]) {
          addressMap[a.landlord_id] = a.address;
        }
      }
    }
  }

  // Filter to reviews that have an address and some text, take top 5
  const enriched = reviews
    .filter((r) => addressMap[r.landlord_id] && (r.good_text || r.bad_text))
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      good_text: r.good_text,
      bad_text: r.bad_text,
      created_at: r.created_at,
      address: addressMap[r.landlord_id],
      duration_lived: r.duration_lived,
    }));

  return NextResponse.json(
    { reviews: enriched },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
}
