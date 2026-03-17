import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rate-limit';
import { Resend } from 'resend';
import { addressToSlug } from '@/lib/slugs';

const PROFANITY_WORDS = new Set([
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'dick', 'piss',
  'bastard', 'cunt', 'whore', 'slut', 'fag', 'retard',
]);

function containsProfanity(text: string): boolean {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  return words.some((w) => PROFANITY_WORDS.has(w));
}

function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  return letters.length > 10 && letters === letters.toUpperCase();
}

function moderateReview(review: {
  rating: number;
  goodText: string;
  badText: string;
  honeypot: string;
}): { status: 'approved' | 'pending' | 'rejected'; reason: string | null } {
  // Honeypot filled = bot
  if (review.honeypot) {
    return { status: 'rejected', reason: 'honeypot' };
  }

  const combinedText = `${review.goodText} ${review.badText}`.trim();
  const wordCount = combinedText.split(/\s+/).filter(Boolean).length;

  // Check profanity
  if (containsProfanity(combinedText)) {
    return { status: 'pending', reason: 'profanity' };
  }

  // Check all caps
  if (isAllCaps(combinedText)) {
    return { status: 'pending', reason: 'all_caps' };
  }

  // Auto-approve if 3+ words
  if (wordCount >= 3) {
    return { status: 'approved', reason: null };
  }

  // Short reviews get flagged
  if (wordCount > 0) {
    return { status: 'pending', reason: 'too_short' };
  }

  // No text at all — just a rating, still auto-approve
  return { status: 'approved', reason: null };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(ip, 5)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
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

  const {
    address,
    landlordName,
    rating,
    durationLived,
    wouldRecommend,
    goodText,
    badText,
    honeypot,
  } = body as {
    address?: string;
    landlordName?: string;
    rating?: number;
    durationLived?: string;
    wouldRecommend?: boolean;
    goodText?: string;
    badText?: string;
    honeypot?: string;
  };

  // Validate required fields
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating (1-5) is required' }, { status: 400 });
  }
  if (!address?.trim()) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  // Run moderation
  const moderation = moderateReview({
    rating,
    goodText: (goodText as string) || '',
    badText: (badText as string) || '',
    honeypot: (honeypot as string) || '',
  });

  // Silently reject bots (don't reveal detection)
  if (moderation.status === 'rejected') {
    return NextResponse.json({ success: true });
  }

  // Find or create landlord
  let landlordId: string | null = null;
  const name = (landlordName as string)?.trim();
  if (name) {
    const { data: existing } = await supabase
      .from('landlords')
      .select('id')
      .ilike('name', name)
      .limit(1)
      .maybeSingle();

    if (existing) {
      landlordId = existing.id;
    } else {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data: newLandlord } = await supabase
        .from('landlords')
        .insert({
          slug,
          name,
          neighborhood: '',
          type: 'Property Management Company',
          violations: 0,
          complaints: 0,
          review_count: 0,
          score_maintenance: 0,
          score_communication: 0,
          score_deposit: 0,
          score_honesty: 0,
          score_overall: 0,
        })
        .select('id')
        .single();

      if (newLandlord) {
        landlordId = newLandlord.id;
      }
    }
  }

  // If no landlord yet, try to find one by address
  if (!landlordId && address?.trim()) {
    const { data: addrMatch } = await supabase
      .from('addresses')
      .select('landlord_id')
      .ilike('address', address.trim())
      .limit(1)
      .maybeSingle();

    if (addrMatch?.landlord_id) {
      landlordId = addrMatch.landlord_id;
    }
  }

  // If still no landlord, create one from the address
  if (!landlordId && address?.trim()) {
    const addrName = address.trim();
    const slug = addrName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { data: newLandlord } = await supabase
      .from('landlords')
      .insert({
        slug,
        name: addrName,
        neighborhood: '',
        type: 'Residential Building',
        violations: 0,
        complaints: 0,
        review_count: 0,
        score_maintenance: 0,
        score_communication: 0,
        score_deposit: 0,
        score_honesty: 0,
        score_overall: 0,
      })
      .select('id')
      .single();

    if (newLandlord) {
      landlordId = newLandlord.id;
    }
  }

  if (!landlordId) {
    return NextResponse.json({ error: 'Could not process review. Please try again.' }, { status: 500 });
  }

  // Link address to landlord
  if (address?.trim()) {
    const { data: existingAddr } = await supabase
      .from('addresses')
      .select('id')
      .eq('landlord_id', landlordId)
      .ilike('address', address.trim())
      .maybeSingle();

    if (!existingAddr) {
      await supabase.from('addresses').insert({
        landlord_id: landlordId,
        address: address.trim(),
      });
    }
  }

  // Combine text for the review body
  const textParts: string[] = [];
  if (goodText && (goodText as string).trim()) textParts.push(`Good: ${(goodText as string).trim()}`);
  if (badText && (badText as string).trim()) textParts.push(`Bad: ${(badText as string).trim()}`);
  const reviewText = textParts.join('\n') || '';

  // Insert review
  const { error: insertError } = await supabase.from('reviews').insert({
    landlord_id: landlordId,
    author: 'Anonymous Tenant',
    rating,
    text: reviewText,
    helpful: 0,
    maintenance: null,
    communication: null,
    deposit: null,
    honesty: null,
    anonymous: true,
    duration_lived: durationLived || null,
    would_recommend: typeof wouldRecommend === 'boolean' ? wouldRecommend : null,
    good_text: (goodText as string)?.trim() || null,
    bad_text: (badText as string)?.trim() || null,
    moderation_status: moderation.status,
    flag_reason: moderation.reason,
  });

  if (insertError) {
    console.error('Review insert error:', insertError);
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
  }

  // Notify claimed building owners of new approved review
  if (moderation.status === 'approved' && address?.trim()) {
    try {
      const normalizedStreet = address.trim().toUpperCase().split(',')[0]
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
          description: `A tenant left a ${rating}-star review${(goodText as string)?.trim() || (badText as string)?.trim() ? '' : ' (rating only)'}. View your dashboard to read and respond.`,
          severity: rating <= 2 ? 'high' : rating <= 3 ? 'medium' : 'low',
        }));

        await supabase.from('landlord_alerts').insert(alertRows);

        // Send email notifications via Resend
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey) {
          const resend = new Resend(resendKey);
          const siteUrl = 'https://mytenantshield.com';

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const emails = (claimedBuildings as any[])
            .filter((b) => {
              const prof = Array.isArray(b.landlord_profiles) ? b.landlord_profiles[0] : b.landlord_profiles;
              return prof?.contact_email;
            })
            .map((b) => {
              const prof = Array.isArray(b.landlord_profiles) ? b.landlord_profiles[0] : b.landlord_profiles;
              return {
                from: 'TenantShield <alerts@mytenantshield.com>',
                to: prof.contact_email as string,
                subject: `TenantShield: New ${rating}-star review at ${b.address}`,
                html: buildReviewAlertEmail(b.address, rating, (goodText as string)?.trim() || null, (badText as string)?.trim() || null, siteUrl),
              };
            });

          if (emails.length > 0) {
            await resend.batch.send(emails).catch((err: unknown) => console.error('Resend review alert error:', err));
          }
        }
      }
    } catch (err) {
      console.error('Review notification error:', err);
    }
  }

  // Recalculate landlord scores if approved
  if (landlordId && moderation.status === 'approved') {
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('landlord_id', landlordId)
      .eq('moderation_status', 'approved');

    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      await supabase
        .from('landlords')
        .update({
          review_count: reviews.length,
          score_overall: Math.round(avg * 10) / 10,
        })
        .eq('id', landlordId);
    }
  }

  return NextResponse.json({ success: true, moderated: moderation.status === 'pending' });
}

function buildReviewAlertEmail(
  address: string,
  rating: number,
  goodText: string | null,
  badText: string | null,
  siteUrl: string,
): string {
  const slug = addressToSlug(address);
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

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
