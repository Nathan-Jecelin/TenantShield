import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { Resend } from 'resend';
import { addressToSlug } from '@/lib/slugs';

const ADMIN_EMAILS = new Set(['njecelin17@gmail.com', 'nathan@mytenantshield.com']);

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const { createClient } = await import('@supabase/supabase-js');
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
  return !!(user?.email && ADMIN_EMAILS.has(user.email));
}

export async function POST(req: NextRequest) {
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

  const { type, claimId, reviewId } = body as {
    type?: 'claim_approved' | 'review_approved';
    claimId?: string;
    reviewId?: string;
  };

  if (type === 'claim_approved' && claimId) {
    // Fetch the claim with landlord profile info
    const { data: claim } = await supabase
      .from('claimed_buildings')
      .select('id, address, landlord_id, landlord_profiles(contact_email, company_name)')
      .eq('id', claimId)
      .single();

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // Create alert
    await supabase.from('landlord_alerts').insert({
      landlord_id: claim.landlord_id,
      building_id: claim.id,
      alert_type: 'claim_approved',
      title: `Your claim for ${claim.address} has been approved`,
      description: 'Your building claim has been verified. You can now monitor violations, complaints, and reviews for this property.',
      severity: 'low',
    });

    // Send email
    const resendKey = process.env.RESEND_API_KEY;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prof = Array.isArray((claim as any).landlord_profiles)
      ? (claim as any).landlord_profiles[0]
      : (claim as any).landlord_profiles;

    if (resendKey && prof?.contact_email) {
      const resend = new Resend(resendKey);
      const slug = addressToSlug(claim.address);
      const siteUrl = 'https://mytenantshield.com';

      await resend.emails.send({
        from: 'TenantShield <alerts@mytenantshield.com>',
        to: prof.contact_email,
        subject: `TenantShield: Your claim for ${claim.address} is approved`,
        html: buildClaimApprovedEmail(claim.address, prof.company_name, slug, siteUrl),
      }).catch((err: unknown) => console.error('Resend claim alert error:', err));
    }

    return NextResponse.json({ success: true });
  }

  if (type === 'review_approved' && reviewId) {
    // Fetch the review
    const { data: review } = await supabase
      .from('reviews')
      .select('id, rating, good_text, bad_text, landlord_id')
      .eq('id', reviewId)
      .single();

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Find claimed buildings linked to this landlord's addresses
    const { data: addresses } = await supabase
      .from('addresses')
      .select('address')
      .eq('landlord_id', review.landlord_id);

    if (!addresses || addresses.length === 0) {
      return NextResponse.json({ success: true, note: 'No addresses linked' });
    }

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
              return {
                from: 'TenantShield <alerts@mytenantshield.com>',
                to: p.contact_email as string,
                subject: `TenantShield: New ${review.rating}-star review at ${b.address}`,
                html: buildReviewAlertEmail(b.address, review.rating, review.good_text, review.bad_text, siteUrl),
              };
            });

          if (emails.length > 0) {
            await resend.batch.send(emails).catch((err: unknown) => console.error('Resend review alert error:', err));
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}

function buildClaimApprovedEmail(
  address: string,
  companyName: string | null,
  slug: string,
  siteUrl: string,
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8fa;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <div style="background:linear-gradient(135deg,#1a7f37,#16a34a);border-radius:12px 12px 0 0;padding:28px 24px;text-align:center">
      <h1 style="font-size:20px;color:#ffffff;margin:0 0 6px;font-weight:700">Claim Approved!</h1>
      <p style="font-size:13px;color:rgba(255,255,255,0.75);margin:0">${address}</p>
    </div>

    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:28px 24px;border:1px solid #e2e8f0;border-top:none">

      <p style="font-size:14px;color:#1f2328;line-height:1.6;margin:0 0 16px">
        ${companyName ? `Hi ${companyName},` : 'Hi there,'}<br><br>
        Great news! Your building claim for <strong>${address}</strong> has been verified and approved.
      </p>

      <p style="font-size:14px;color:#1f2328;line-height:1.6;margin:0 0 24px">
        You can now monitor violations, 311 complaints, and tenant reviews for this property from your dashboard.
      </p>

      <div style="text-align:center;margin-bottom:12px">
        <a href="${siteUrl}/landlord/dashboard" style="display:inline-block;padding:12px 32px;background:#1f6feb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Go to Dashboard</a>
      </div>
      <div style="text-align:center">
        <a href="${siteUrl}/address/${slug}" style="font-size:13px;color:#1f6feb;text-decoration:none;font-weight:600">View Building Page &rarr;</a>
      </div>
    </div>

    <div style="text-align:center;padding:20px 0;font-size:12px;color:#8b949e;line-height:1.8">
      <div>TenantShield &middot; Protecting Chicago renters</div>
      <div style="margin-top:4px">
        <a href="${siteUrl}" style="color:#8b949e;text-decoration:none">Home</a>
        &nbsp;&middot;&nbsp;
        <a href="${siteUrl}/privacy" style="color:#8b949e;text-decoration:none">Privacy</a>
      </div>
    </div>

  </div>
</body>
</html>`;
}

function buildReviewAlertEmail(
  address: string,
  rating: number,
  goodText: string | null,
  badText: string | null,
  siteUrl: string,
): string {
  const slug = addressToSlug(address);
  const stars = '\u2605'.repeat(rating) + '\u2606'.repeat(5 - rating);

  let reviewSnippet = '';
  if (goodText) {
    reviewSnippet += `<div style="margin-bottom:8px"><strong style="color:#1a7f37">Good:</strong> ${goodText.length > 150 ? goodText.slice(0, 150) + '...' : goodText}</div>`;
  }
  if (badText) {
    reviewSnippet += `<div><strong style="color:#cf222e">Needs improvement:</strong> ${badText.length > 150 ? badText.slice(0, 150) + '...' : badText}</div>`;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8fa;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <div style="background:linear-gradient(135deg,#1a6deb,#0550ae);border-radius:12px 12px 0 0;padding:28px 24px;text-align:center">
      <h1 style="font-size:20px;color:#ffffff;margin:0 0 6px;font-weight:700">New Tenant Review</h1>
      <p style="font-size:13px;color:rgba(255,255,255,0.75);margin:0">${address}</p>
    </div>

    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:28px 24px;border:1px solid #e2e8f0;border-top:none">

      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:28px;letter-spacing:2px;color:#f59e0b">${stars}</div>
        <div style="font-size:14px;color:#57606a;margin-top:4px">${rating} out of 5 stars</div>
      </div>

      ${reviewSnippet ? `<div style="background:#f6f8fa;border-radius:8px;padding:16px;margin-bottom:24px;border:1px solid #e8ecf0;font-size:14px;color:#1f2328;line-height:1.5">${reviewSnippet}</div>` : ''}

      <div style="text-align:center;margin-bottom:12px">
        <a href="${siteUrl}/landlord/dashboard" style="display:inline-block;padding:12px 32px;background:#1f6feb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View & Respond</a>
      </div>
      <div style="text-align:center">
        <a href="${siteUrl}/address/${slug}" style="font-size:13px;color:#1f6feb;text-decoration:none;font-weight:600">View Building Page &rarr;</a>
      </div>
    </div>

    <div style="text-align:center;padding:20px 0;font-size:12px;color:#8b949e;line-height:1.8">
      <div>TenantShield &middot; Protecting Chicago renters</div>
      <div style="margin-top:4px">
        <a href="${siteUrl}" style="color:#8b949e;text-decoration:none">Home</a>
        &nbsp;&middot;&nbsp;
        <a href="${siteUrl}/privacy" style="color:#8b949e;text-decoration:none">Privacy</a>
      </div>
    </div>

  </div>
</body>
</html>`;
}
