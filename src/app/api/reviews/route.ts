import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rate-limit';

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
