import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

const ADMIN_EMAILS = new Set(['njecelin17@gmail.com', 'nathan@mytenantshield.com']);

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  // Admin auth
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user || !user.email || !ADMIN_EMAILS.has(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const period = req.nextUrl.searchParams.get('period') || 'month';
  const daysBack = period === 'week' ? 7 : 30;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - daysBack);
  const sinceStr = since.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('address_views_daily')
    .select('address, view_date, view_count, unique_sessions')
    .gte('view_date', sinceStr)
    .order('view_date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate per address
  const addrMap = new Map<string, { views: number; sessions: number; days: Set<string> }>();
  for (const r of (data || [])) {
    const a = r.address as string;
    const cur = addrMap.get(a) || { views: 0, sessions: 0, days: new Set<string>() };
    cur.views += r.view_count as number;
    cur.sessions += r.unique_sessions as number;
    cur.days.add(r.view_date as string);
    addrMap.set(a, cur);
  }

  const rows = Array.from(addrMap.entries())
    .map(([address, { views, sessions, days }]) => ({
      address,
      views,
      sessions,
      daysActive: days.size,
    }))
    .sort((a, b) => b.views - a.views);

  // Build CSV
  const csvLines = ['Address,Total Views,Unique Sessions,Days Active'];
  for (const r of rows) {
    const escaped = r.address.includes(',') ? `"${r.address}"` : r.address;
    csvLines.push(`${escaped},${r.views},${r.sessions},${r.daysActive}`);
  }
  const csv = csvLines.join('\n');

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="address-views-${period}-${sinceStr}.csv"`,
    },
  });
}
