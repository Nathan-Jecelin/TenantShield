import { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const supabase = getSupabaseServer();

  const html = (title: string, message: string) =>
    new Response(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — TenantShield</title></head>
<body style="margin:0;padding:48px 20px;font-family:system-ui,-apple-system,sans-serif;color:#1f2328;background:#f6f8fa;display:flex;justify-content:center">
  <div style="max-width:480px;text-align:center;margin-top:60px">
    <h1 style="font-size:24px;font-weight:700;margin-bottom:12px">${title}</h1>
    <p style="font-size:15px;color:#57606a;line-height:1.6">${message}</p>
    <a href="https://mytenantshield.com" style="display:inline-block;margin-top:24px;padding:10px 24px;background:#1f6feb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">Back to TenantShield</a>
  </div>
</body>
</html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );

  if (!token || !supabase) {
    return html('Invalid Link', 'This unsubscribe link is invalid or has expired.');
  }

  const { data: subscriber } = await supabase
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('unsubscribe_token', token)
    .single();

  if (!subscriber) {
    return html('Invalid Link', 'This unsubscribe link is invalid or has expired.');
  }

  if (subscriber.status === 'unsubscribed') {
    return html('Already Unsubscribed', "You've already been unsubscribed from the TenantShield newsletter.");
  }

  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', subscriber.id);

  if (error) {
    return html('Error', 'Something went wrong. Please try again later.');
  }

  return html('Unsubscribed', "You've been unsubscribed from the TenantShield newsletter. You can re-subscribe anytime from our website.");
}
