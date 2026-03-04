import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

const ADMIN_EMAILS = new Set(['njecelin17@gmail.com', 'nathan@mytenantshield.com']);

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const supabase = getSupabaseServer();
  if (!supabase) return false;

  const { createClient } = await import('@supabase/supabase-js');
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
  return !!(user?.email && ADMIN_EMAILS.has(user.email));
}

// GET: list flagged reviews
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const status = req.nextUrl.searchParams.get('status') || 'pending';

  const { data, error } = await supabase
    .from('reviews')
    .select('id, author, rating, text, good_text, bad_text, duration_lived, would_recommend, flag_reason, moderation_status, created_at, landlord_id')
    .eq('moderation_status', status)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }

  // Fetch landlord names for the reviews
  const landlordIds = [...new Set((data || []).map((r) => r.landlord_id).filter(Boolean))];
  let landlordMap: Record<string, string> = {};
  if (landlordIds.length > 0) {
    const { data: landlords } = await supabase
      .from('landlords')
      .select('id, name')
      .in('id', landlordIds);
    if (landlords) {
      landlordMap = Object.fromEntries(landlords.map((l) => [l.id, l.name]));
    }
  }

  const reviews = (data || []).map((r) => ({
    ...r,
    landlord_name: r.landlord_id ? landlordMap[r.landlord_id] || null : null,
  }));

  return NextResponse.json({ reviews });
}

// PATCH: approve or reject a review
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { reviewId, action } = body as { reviewId?: string; action?: string };
  if (!reviewId || !['approve', 'reject'].includes(action || '')) {
    return NextResponse.json({ error: 'reviewId and action (approve/reject) required' }, { status: 400 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  const { error } = await supabase
    .from('reviews')
    .update({ moderation_status: newStatus, flag_reason: null })
    .eq('id', reviewId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
  }

  // If approving, recalculate landlord scores
  if (action === 'approve') {
    const { data: review } = await supabase
      .from('reviews')
      .select('landlord_id')
      .eq('id', reviewId)
      .single();

    if (review?.landlord_id) {
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('landlord_id', review.landlord_id)
        .eq('moderation_status', 'approved');

      if (reviews && reviews.length > 0) {
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        await supabase
          .from('landlords')
          .update({
            review_count: reviews.length,
            score_overall: Math.round(avg * 10) / 10,
          })
          .eq('id', review.landlord_id);
      }
    }
  }

  return NextResponse.json({ success: true, status: newStatus });
}
