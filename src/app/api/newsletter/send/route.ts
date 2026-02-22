import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { Resend } from 'resend';

const BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  const resendKey = process.env.RESEND_API_KEY;
  if (!supabase || !resendKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  // Check if 7+ days since last send
  const { data: lastSend } = await supabase
    .from('newsletter_sends')
    .select('sent_at')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (lastSend) {
    const daysSince = (Date.now() - new Date(lastSend.sent_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      return NextResponse.json({ message: `Last send was ${daysSince.toFixed(1)} days ago. Skipping.` });
    }
  }

  // Get active subscribers
  const { data: subscribers } = await supabase
    .from('newsletter_subscribers')
    .select('email, unsubscribe_token')
    .eq('status', 'active');

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ message: 'No active subscribers.' });
  }

  // Get new blog posts from last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: newPosts } = await supabase
    .from('blog_posts')
    .select('title, slug, excerpt')
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: false });

  // Get review count from last 7 days
  const { count: newReviewCount } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo);

  // Get popular searches from analytics
  const { data: searches } = await supabase
    .from('analytics_events')
    .select('event_data')
    .eq('event_type', 'search')
    .gte('created_at', weekAgo)
    .limit(100);

  const searchCounts: Record<string, number> = {};
  if (searches) {
    for (const s of searches) {
      const q = (s.event_data as { query?: string })?.query?.trim();
      if (q) searchCounts[q] = (searchCounts[q] || 0) + 1;
    }
  }
  const topSearches = Object.entries(searchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([query]) => query);

  // Build email HTML
  const siteUrl = 'https://tenantshield.org';

  const buildEmail = (unsubscribeToken: string) => {
    let html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8fa;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px">
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="font-size:22px;color:#1f2328;margin:0 0 4px">TenantShield Weekly</h1>
      <p style="font-size:13px;color:#8b949e;margin:0">Your weekly Chicago renter update</p>
    </div>
    <div style="background:#fff;border-radius:8px;border:1px solid #e8ecf0;padding:24px;margin-bottom:16px">`;

    // Blog posts section
    if (newPosts && newPosts.length > 0) {
      html += `
      <h2 style="font-size:16px;color:#1f2328;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e8ecf0">New on the Blog</h2>`;
      for (const post of newPosts) {
        html += `
      <div style="margin-bottom:16px">
        <a href="${siteUrl}/blog/${post.slug}" style="font-size:15px;font-weight:600;color:#1f6feb;text-decoration:none">${post.title}</a>
        <p style="font-size:13px;color:#57606a;margin:4px 0 0;line-height:1.5">${post.excerpt}</p>
      </div>`;
      }
    }

    // Activity summary
    const hasActivity = (newReviewCount && newReviewCount > 0) || topSearches.length > 0;
    if (hasActivity) {
      html += `
      <h2 style="font-size:16px;color:#1f2328;margin:24px 0 12px;padding-top:16px;border-top:1px solid #e8ecf0">This Week on TenantShield</h2>
      <ul style="padding-left:20px;margin:0;color:#57606a;font-size:14px;line-height:1.8">`;
      if (newReviewCount && newReviewCount > 0) {
        html += `<li><strong>${newReviewCount}</strong> new tenant review${newReviewCount === 1 ? '' : 's'} submitted</li>`;
      }
      if (topSearches.length > 0) {
        html += `<li>Trending searches: ${topSearches.join(', ')}</li>`;
      }
      html += `</ul>`;
    }

    // No content fallback
    if ((!newPosts || newPosts.length === 0) && !hasActivity) {
      html += `
      <p style="font-size:14px;color:#57606a;line-height:1.6">It was a quiet week on TenantShield. Check back for new reviews, blog posts, and building updates!</p>`;
    }

    // CTA
    html += `
      <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e8ecf0">
        <a href="${siteUrl}" style="display:inline-block;padding:10px 28px;background:#1f6feb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">Search an Address</a>
      </div>
    </div>
    <div style="text-align:center;padding:16px 0;font-size:12px;color:#8b949e">
      <a href="${siteUrl}/api/newsletter/unsubscribe?token=${unsubscribeToken}" style="color:#8b949e;text-decoration:underline">Unsubscribe</a>
      &nbsp;·&nbsp; TenantShield · Protecting Chicago renters
    </div>
  </div>
</body>
</html>`;
    return html;
  };

  // Send via Resend in batches
  const resend = new Resend(resendKey);
  let totalSent = 0;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    const emails = batch.map((sub) => ({
      from: 'TenantShield <newsletter@tenantshield.org>',
      to: sub.email,
      subject: newPosts && newPosts.length > 0
        ? `TenantShield Weekly: ${newPosts[0].title}`
        : 'TenantShield Weekly Update',
      html: buildEmail(sub.unsubscribe_token),
    }));

    try {
      await resend.batch.send(emails);
      totalSent += batch.length;
    } catch (err) {
      console.error('Resend batch error:', err);
      // Log partial failure but continue
      await supabase.from('newsletter_sends').insert({
        subscriber_count: totalSent,
        blog_post_count: newPosts?.length ?? 0,
        status: 'failed',
      });
      return NextResponse.json({ error: 'Partial send failure', sent: totalSent }, { status: 500 });
    }
  }

  // Log successful send
  await supabase.from('newsletter_sends').insert({
    subscriber_count: totalSent,
    blog_post_count: newPosts?.length ?? 0,
    status: 'sent',
  });

  return NextResponse.json({
    message: `Newsletter sent to ${totalSent} subscribers.`,
    blogPosts: newPosts?.length ?? 0,
  });
}
