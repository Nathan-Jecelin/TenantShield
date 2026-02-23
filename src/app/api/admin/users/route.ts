import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

const ADMIN_EMAIL = 'njecelin17@gmail.com';

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  // Verify the caller is the admin by checking their auth token
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all users from auth.users via admin API
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  // Fetch all reviews with user_id
  const { data: reviews } = await supabase
    .from('reviews')
    .select('user_id, created_at, rating, landlords(name)')
    .order('created_at', { ascending: false });

  // Build user list with email and review info
  const userList = (users || []).map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    provider: u.app_metadata?.provider || 'email',
  }));

  // Build reviewer list (users who have reviews)
  const reviewerMap = new Map<string, { email: string; reviewCount: number; lastReview: string; landlords: string[] }>();
  for (const r of (reviews || [])) {
    const userId = r.user_id as string;
    if (!userId) continue;
    const user = userList.find((u) => u.id === userId);
    if (!user) continue;
    const landlordData = r.landlords as { name: string } | { name: string }[] | null;
    const landlordName = Array.isArray(landlordData) ? landlordData[0]?.name || 'Unknown' : landlordData?.name || 'Unknown';
    if (reviewerMap.has(userId)) {
      const existing = reviewerMap.get(userId)!;
      existing.reviewCount++;
      if (!existing.landlords.includes(landlordName)) existing.landlords.push(landlordName);
    } else {
      reviewerMap.set(userId, {
        email: user.email || '',
        reviewCount: 1,
        lastReview: r.created_at as string,
        landlords: [landlordName],
      });
    }
  }

  return NextResponse.json({
    users: userList,
    reviewers: Array.from(reviewerMap.values()).sort((a, b) => b.reviewCount - a.reviewCount),
  });
}
