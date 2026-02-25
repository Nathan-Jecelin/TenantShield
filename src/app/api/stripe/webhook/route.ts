import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getSupabaseServer } from '@/lib/supabase-server';
import Stripe from 'stripe';

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  const firstItem = subscription.items?.data?.[0];
  if (firstItem?.current_period_end) {
    return new Date(firstItem.current_period_end * 1000).toISOString();
  }
  return null;
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === 'string' ? sub : sub.id;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;
      const customerId = typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const profileId = subscription.metadata.landlord_profile_id;
        if (profileId) {
          const periodEnd = getSubscriptionPeriodEnd(subscription);
          await supabase
            .from('landlord_profiles')
            .update({
              plan: 'pro',
              plan_status: 'active',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              ...(periodEnd && { current_period_end: periodEnd }),
            })
            .eq('id', profileId);
        }
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getSubscriptionIdFromInvoice(invoice);
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const profileId = subscription.metadata.landlord_profile_id;
        if (profileId) {
          const periodEnd = getSubscriptionPeriodEnd(subscription);
          await supabase
            .from('landlord_profiles')
            .update({
              plan_status: 'active',
              ...(periodEnd && { current_period_end: periodEnd }),
            })
            .eq('id', profileId);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getSubscriptionIdFromInvoice(invoice);
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const profileId = subscription.metadata.landlord_profile_id;
        if (profileId) {
          await supabase
            .from('landlord_profiles')
            .update({ plan_status: 'past_due' })
            .eq('id', profileId);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const profileId = subscription.metadata.landlord_profile_id;
      if (profileId) {
        await supabase
          .from('landlord_profiles')
          .update({
            plan: 'free',
            plan_status: 'canceled',
            stripe_subscription_id: null,
          })
          .eq('id', profileId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
