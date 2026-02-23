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
  const siteUrl = 'https://mytenantshield.com';

  const buildEmail = (unsubscribeToken: string) => {
    const postCount = newPosts?.length ?? 0;
    const weekOf = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    let html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a56db,#1f6feb);border-radius:12px 12px 0 0;padding:32px 24px;text-align:center">
      <div style="font-size:28px;margin-bottom:8px">&#x1f3e0;</div>
      <h1 style="font-size:24px;color:#ffffff;margin:0 0 4px;font-weight:700;letter-spacing:-0.3px">TenantShield Weekly</h1>
      <p style="font-size:13px;color:rgba(255,255,255,0.8);margin:0">Week of ${weekOf}</p>
    </div>

    <!-- Main content -->
    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:28px 24px;border:1px solid #e2e8f0;border-top:none">`;

    // Blog posts section
    if (postCount > 0) {
      html += `
      <div style="margin-bottom:24px">
        <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8b949e;margin:0 0 16px;font-weight:600">New on the Blog</h2>`;
      for (let i = 0; i < newPosts!.length; i++) {
        const post = newPosts![i];
        html += `
        <a href="${siteUrl}/blog/${post.slug}" style="display:block;text-decoration:none;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e8ecf0;${i < newPosts!.length - 1 ? 'margin-bottom:10px' : ''}">
          <div style="font-size:15px;font-weight:600;color:#1f2328;margin-bottom:6px">${post.title}</div>
          <div style="font-size:13px;color:#57606a;line-height:1.5">${post.excerpt}</div>
          <div style="font-size:12px;color:#1f6feb;font-weight:600;margin-top:8px">Read more &#x2192;</div>
        </a>`;
      }
      html += `
      </div>`;
    }

    // Activity summary
    const hasActivity = (newReviewCount && newReviewCount > 0) || topSearches.length > 0;
    if (hasActivity) {
      html += `
      <div style="background:#f0f6ff;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#1a56db;margin:0 0 12px;font-weight:600">This Week&rsquo;s Activity</h2>`;
      if (newReviewCount && newReviewCount > 0) {
        html += `
        <div style="font-size:14px;color:#1f2328;margin-bottom:6px">&#x1f4dd; <strong>${newReviewCount}</strong> new tenant review${newReviewCount === 1 ? '' : 's'} submitted</div>`;
      }
      if (topSearches.length > 0) {
        html += `
        <div style="font-size:14px;color:#1f2328">&#x1f50d; Trending: ${topSearches.map(s => `<strong>${s}</strong>`).join(', ')}</div>`;
      }
      html += `
      </div>`;
    }

    // No content fallback
    if (postCount === 0 && !hasActivity) {
      html += `
      <div style="text-align:center;padding:20px 0">
        <p style="font-size:14px;color:#57606a;line-height:1.6;margin:0">It was a quiet week on TenantShield. Check back for new reviews, blog posts, and building updates!</p>
      </div>`;
    }

    // CTA
    html += `
      <div style="text-align:center;padding-top:8px">
        <a href="${siteUrl}" style="display:inline-block;padding:12px 32px;background:#1f6feb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Search an Address</a>
        <div style="margin-top:16px;font-size:13px;color:#57606a;line-height:1.5">
          Had a good (or bad) experience with your landlord?<br>
          <a href="${siteUrl}" style="color:#1f6feb;text-decoration:none;font-weight:600">Leave a review</a> &mdash; it helps other Chicago renters.
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px 0;font-size:12px;color:#8b949e;line-height:1.8">
      <div>TenantShield &middot; Protecting Chicago renters</div>
      <div style="margin-top:4px">
        <a href="${siteUrl}/blog" style="color:#8b949e;text-decoration:none">Blog</a>
        &nbsp;&middot;&nbsp;
        <a href="${siteUrl}/privacy" style="color:#8b949e;text-decoration:none">Privacy</a>
        &nbsp;&middot;&nbsp;
        <a href="${siteUrl}/api/newsletter/unsubscribe?token=${unsubscribeToken}" style="color:#8b949e;text-decoration:underline">Unsubscribe</a>
      </div>
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
      from: 'TenantShield <newsletter@mytenantshield.com>',
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
