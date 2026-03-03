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

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const todayStart = `${todayStr}T00:00:00Z`;

  // Dates for week/month boundaries
  const weekAgo = new Date(now);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const weekStr = weekAgo.toISOString().split('T')[0];

  const monthAgo = new Date(now);
  monthAgo.setUTCDate(monthAgo.getUTCDate() - 30);
  const monthStr = monthAgo.toISOString().split('T')[0];

  // Run queries in parallel
  const [
    todayLive,
    weekAgg,
    monthAgg,
    allTimeAgg,
    topWeek,
    topMonth,
    dailyVolume,
    buildingTrends,
  ] = await Promise.all([
    // Today's count (live from address_views since cron hasn't run yet)
    supabase
      .from('address_views')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart),

    // This week total from daily aggregates
    supabase
      .from('address_views_daily')
      .select('view_count')
      .gte('view_date', weekStr),

    // This month total from daily aggregates
    supabase
      .from('address_views_daily')
      .select('view_count')
      .gte('view_date', monthStr),

    // All time total from daily aggregates
    supabase
      .from('address_views_daily')
      .select('view_count'),

    // Top 50 addresses this week (RPC may not exist, wrap in promise)
    supabase.rpc('top_addresses_by_period', { start_date: weekStr, end_date: todayStr, lim: 50 }).then(
      (res) => res,
      () => null
    ),

    // Top 50 addresses this month
    supabase.rpc('top_addresses_by_period', { start_date: monthStr, end_date: todayStr, lim: 50 }).then(
      (res) => res,
      () => null
    ),

    // Daily volume for last 30 days
    supabase
      .from('address_views_daily')
      .select('view_date, view_count')
      .gte('view_date', monthStr)
      .order('view_date', { ascending: true }),

    // Building trends: top 20 buildings, last 7 days
    supabase
      .from('address_views_daily')
      .select('address, view_date, view_count')
      .gte('view_date', weekStr)
      .order('view_count', { ascending: false })
      .limit(200),
  ]);

  // Compute totals
  const todayCount = todayLive.count ?? 0;
  const weekTotal = (weekAgg.data || []).reduce((s, r) => s + (r.view_count || 0), 0) + todayCount;
  const monthTotal = (monthAgg.data || []).reduce((s, r) => s + (r.view_count || 0), 0) + todayCount;
  const allTimeTotal = (allTimeAgg.data || []).reduce((s, r) => s + (r.view_count || 0), 0) + todayCount;

  // Aggregate daily volume into { date, count } array
  const volumeMap = new Map<string, number>();
  for (const r of (dailyVolume.data || [])) {
    const d = r.view_date as string;
    volumeMap.set(d, (volumeMap.get(d) || 0) + (r.view_count as number));
  }
  const dailyVolumeArr = Array.from(volumeMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // If RPC doesn't exist yet, fall back to manual aggregation from address_views_daily
  let topWeekData = topWeek && 'data' in topWeek ? topWeek.data : null;
  let topMonthData = topMonth && 'data' in topMonth ? topMonth.data : null;

  if (!topWeekData) {
    const addrMap = new Map<string, { views: number; sessions: number }>();
    const { data: weekRows } = await supabase
      .from('address_views_daily')
      .select('address, view_count, unique_sessions')
      .gte('view_date', weekStr);
    for (const r of (weekRows || [])) {
      const a = r.address as string;
      const cur = addrMap.get(a) || { views: 0, sessions: 0 };
      cur.views += r.view_count as number;
      cur.sessions += r.unique_sessions as number;
      addrMap.set(a, cur);
    }
    topWeekData = Array.from(addrMap.entries())
      .map(([address, { views, sessions }]) => ({ address, view_count: views, unique_sessions: sessions }))
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, 50);
  }

  if (!topMonthData) {
    const addrMap = new Map<string, { views: number; sessions: number }>();
    const { data: monthRows } = await supabase
      .from('address_views_daily')
      .select('address, view_count, unique_sessions')
      .gte('view_date', monthStr);
    for (const r of (monthRows || [])) {
      const a = r.address as string;
      const cur = addrMap.get(a) || { views: 0, sessions: 0 };
      cur.views += r.view_count as number;
      cur.sessions += r.unique_sessions as number;
      addrMap.set(a, cur);
    }
    topMonthData = Array.from(addrMap.entries())
      .map(([address, { views, sessions }]) => ({ address, view_count: views, unique_sessions: sessions }))
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, 50);
  }

  // Build per-building sparkline data (top 20)
  const buildingDailyMap = new Map<string, Map<string, number>>();
  for (const r of (buildingTrends.data || [])) {
    const addr = r.address as string;
    if (!buildingDailyMap.has(addr)) buildingDailyMap.set(addr, new Map());
    const m = buildingDailyMap.get(addr)!;
    m.set(r.view_date as string, (m.get(r.view_date as string) || 0) + (r.view_count as number));
  }
  // Rank by total and take top 20
  const buildingTrendsArr = Array.from(buildingDailyMap.entries())
    .map(([address, daily]) => ({
      address,
      total: Array.from(daily.values()).reduce((s, v) => s + v, 0),
      daily: Array.from(daily.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  return NextResponse.json({
    totals: {
      today: todayCount,
      thisWeek: weekTotal,
      thisMonth: monthTotal,
      allTime: allTimeTotal,
    },
    topWeek: topWeekData,
    topMonth: topMonthData,
    dailyVolume: dailyVolumeArr,
    buildingTrends: buildingTrendsArr,
  });
}
