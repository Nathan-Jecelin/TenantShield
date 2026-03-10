import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import { PAID_PLANS } from '@/lib/plans';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { priceId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Missing priceId' }, { status: 400 });
  }

  const { priceId } = body;
  if (!priceId) {
    return NextResponse.json({ error: 'Missing priceId' }, { status: 400 });
  }

  // Validate the priceId is one of our known plans
  const validPriceIds = PAID_PLANS.map((p) => p.stripePriceId);
  if (!validPriceIds.includes(priceId)) {
    return NextResponse.json({ error: 'Invalid priceId' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseServer = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile, error: profError } = await supabaseServer
    .from('landlord_profiles')
    .select('id, contact_email, stripe_customer_id')
    .eq('user_id', user.id)
    .single();

  if (profError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const stripe = getStripe();

  let customerId = profile.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.contact_email || user.email || undefined,
      metadata: { landlord_profile_id: profile.id, supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabaseServer
      .from('landlord_profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', profile.id);
  }

  const origin = req.headers.get('origin') || 'https://mytenantshield.com';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/landlord/dashboard?upgraded=true`,
    cancel_url: `${origin}/landlord/dashboard`,
    subscription_data: {
      metadata: { landlord_profile_id: profile.id },
    },
  });

  return NextResponse.json({ url: session.url });
}
