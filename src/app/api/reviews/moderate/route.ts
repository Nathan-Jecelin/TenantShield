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

  // If approving, recalculate landlord scores and send alerts
  if (action === 'approve') {
    const { data: review } = await supabase
      .from('reviews')
      .select('landlord_id, rating, good_text, bad_text')
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

      // Notify claimed building owners of the newly approved review
      try {
        const { data: addresses } = await supabase
          .from('addresses')
          .select('address')
          .eq('landlord_id', review.landlord_id);

        if (addresses && addresses.length > 0) {
          for (const addr of addresses) {
            const normalizedStreet = addr.address.toUpperCase().split(',')[0]
              .replace(/\b(CHICAGO|IL|ILLINOIS)\b/g, '')
              .replace(/\s+/g, ' ')
              .trim();

            const { data: claimedBuildings } = await supabase
              .from('claimed_buildings')
              .select('id, address, landlord_id, landlord_profiles(contact_email)')
              .eq('verification_status', 'approved')
              .ilike('address', `${normalizedStreet}%`);

            if (claimedBuildings && claimedBuildings.length > 0) {
              const alertRows = claimedBuildings.map((b: { id: string; address: string; landlord_id: string }) => ({
                landlord_id: b.landlord_id,
                building_id: b.id,
                alert_type: 'review',
                title: `New tenant review at ${b.address}`,
                description: `A tenant left a ${review.rating}-star review${review.good_text || review.bad_text ? '' : ' (rating only)'}. View your dashboard to read and respond.`,
                severity: review.rating <= 2 ? 'high' : review.rating <= 3 ? 'medium' : 'low',
              }));

              await supabase.from('landlord_alerts').insert(alertRows);

              // Send email notifications
              const resendKey = process.env.RESEND_API_KEY;
              if (resendKey) {
                const { Resend } = await import('resend');
                const { addressToSlug } = await import('@/lib/slugs');
                const resend = new Resend(resendKey);
                const siteUrl = 'https://mytenantshield.com';

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const emails = (claimedBuildings as any[])
                  .filter((b) => {
                    const p = Array.isArray(b.landlord_profiles) ? b.landlord_profiles[0] : b.landlord_profiles;
                    return p?.contact_email;
                  })
                  .map((b) => {
                    const p = Array.isArray(b.landlord_profiles) ? b.landlord_profiles[0] : b.landlord_profiles;
                    const slug = addressToSlug(b.address);
                    const stars = '\u2605'.repeat(review.rating) + '\u2606'.repeat(5 - review.rating);
                    let snippet = '';
                    if (review.good_text) snippet += `<div style="margin-bottom:8px"><strong style="color:#1a7f37">Good:</strong> ${review.good_text.slice(0, 150)}</div>`;
                    if (review.bad_text) snippet += `<div><strong style="color:#cf222e">Needs improvement:</strong> ${review.bad_text.slice(0, 150)}</div>`;

                    return {
                      from: 'TenantShield <alerts@mytenantshield.com>',
                      to: p.contact_email as string,
                      subject: `TenantShield: New ${review.rating}-star review at ${b.address}`,
                      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f6f8fa;font-family:system-ui,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 16px"><div style="background:linear-gradient(135deg,#1a6deb,#0550ae);border-radius:12px 12px 0 0;padding:28px 24px;text-align:center"><h1 style="font-size:20px;color:#fff;margin:0 0 6px;font-weight:700">New Tenant Review</h1><p style="font-size:13px;color:rgba(255,255,255,0.75);margin:0">${b.address}</p></div><div style="background:#fff;border-radius:0 0 12px 12px;padding:28px 24px;border:1px solid #e2e8f0;border-top:none"><div style="text-align:center;margin-bottom:20px"><div style="font-size:28px;letter-spacing:2px;color:#f59e0b">${stars}</div><div style="font-size:14px;color:#57606a;margin-top:4px">${review.rating} out of 5 stars</div></div>${snippet ? `<div style="background:#f6f8fa;border-radius:8px;padding:16px;margin-bottom:24px;border:1px solid #e8ecf0;font-size:14px;color:#1f2328;line-height:1.5">${snippet}</div>` : ''}<div style="text-align:center;margin-bottom:12px"><a href="${siteUrl}/landlord/dashboard" style="display:inline-block;padding:12px 32px;background:#1f6feb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View & Respond</a></div><div style="text-align:center"><a href="${siteUrl}/address/${slug}" style="font-size:13px;color:#1f6feb;text-decoration:none;font-weight:600">View Building Page</a></div></div></div></body></html>`,
                    };
                  });

                if (emails.length > 0) {
                  await resend.batch.send(emails).catch((err: unknown) => console.error('Resend review alert error:', err));
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Review approval notification error:', err);
      }
    }
  }

  return NextResponse.json({ success: true, status: newStatus });
}
