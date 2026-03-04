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

  // Normalize: uppercase, strip city/state, collapse whitespace
  const street = address
    .toUpperCase()
    .split(',')[0]
    .replace(/\b(CHICAGO|IL|ILLINOIS)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const { data, error } = await supabase
    .from('community_reviews')
    .select('*')
    .ilike('address', `%${street}%`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Community reviews lookup error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ review: null });
  }

  // reports may be a JSON string if stored via REST API
  let reports = data.reports ?? [];
  if (typeof reports === 'string') {
    try { reports = JSON.parse(reports); } catch { reports = []; }
  }

  return NextResponse.json({
    review: {
      overall_sentiment: data.overall_sentiment,
      overall_summary: data.overall_summary,
      key_themes: data.key_themes ?? [],
      raw_review_count: data.raw_review_count,
      relevant_review_count: data.relevant_review_count,
      reports,
      processed_at: data.processed_at,
    },
  });
}
