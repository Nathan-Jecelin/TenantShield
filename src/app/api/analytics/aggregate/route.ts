import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  // Allow backfill via ?date=YYYY-MM-DD, default to yesterday
  const dateParam = req.nextUrl.searchParams.get('date');
  let targetDate: string;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    targetDate = dateParam;
  } else {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    targetDate = yesterday.toISOString().split('T')[0];
  }

  const dayStart = `${targetDate}T00:00:00Z`;
  const dayEnd = `${targetDate}T23:59:59.999Z`;

  // Fetch all views for the target date
  const { data: views, error } = await supabase
    .from('address_views')
    .select('address, session_id')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!views || views.length === 0) {
    return NextResponse.json({ date: targetDate, aggregated: 0 });
  }

  // Group by address
  const groups = new Map<string, { count: number; sessions: Set<string> }>();
  for (const v of views) {
    const addr = v.address as string;
    if (!groups.has(addr)) {
      groups.set(addr, { count: 0, sessions: new Set() });
    }
    const g = groups.get(addr)!;
    g.count++;
    if (v.session_id) g.sessions.add(v.session_id as string);
  }

  // Upsert into address_views_daily
  const rows = Array.from(groups.entries()).map(([address, g]) => ({
    address,
    view_date: targetDate,
    view_count: g.count,
    unique_sessions: g.sessions.size,
  }));

  const { error: upsertError } = await supabase
    .from('address_views_daily')
    .upsert(rows, { onConflict: 'address,view_date' });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ date: targetDate, aggregated: rows.length });
}
