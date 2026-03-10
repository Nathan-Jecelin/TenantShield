import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getPlanByPriceId, PLANS, type PlanId } from '@/lib/plans';
import { Resend } from 'resend';
import Stripe from 'stripe';

const ADMIN_EMAIL = 'njecelin17@gmail.com';

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

function resolvePlanFromSubscription(subscription: Stripe.Subscription): string {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (priceId) {
    const plan = getPlanByPriceId(priceId);
    if (plan) return plan;
  }
  // Fallback for legacy subscriptions
  return 'professional';
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
          const plan = resolvePlanFromSubscription(subscription);
          await supabase
            .from('landlord_profiles')
            .update({
              plan,
              plan_status: 'active',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              ...(periodEnd && { current_period_end: periodEnd }),
            })
            .eq('id', profileId);

          // Notify admin of new paid subscription
          await notifyAdminNewSubscription(supabase, profileId, plan);
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const profileId = subscription.metadata.landlord_profile_id;
      if (profileId) {
        const periodEnd = getSubscriptionPeriodEnd(subscription);
        const plan = resolvePlanFromSubscription(subscription);
        const status = subscription.status === 'active' ? 'active'
          : subscription.status === 'past_due' ? 'past_due'
          : subscription.status === 'canceled' ? 'canceled'
          : 'active';
        await supabase
          .from('landlord_profiles')
          .update({
            plan,
            plan_status: status,
            ...(periodEnd && { current_period_end: periodEnd }),
          })
          .eq('id', profileId);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyAdminNewSubscription(supabase: any, profileId: string, planId: string) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return;

    const { data: profile } = await supabase
      .from('landlord_profiles')
      .select('company_name, contact_email')
      .eq('id', profileId)
      .single();

    if (!profile) return;

    const planConfig = PLANS[planId as PlanId] || PLANS.professional;
    const resend = new Resend(resendKey);
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

    await resend.emails.send({
      from: 'TenantShield <alerts@mytenantshield.com>',
      to: ADMIN_EMAIL,
      subject: `New ${planConfig.name} subscriber — $${planConfig.price}/mo`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 16px">

    <div style="text-align:center;margin-bottom:32px">
      <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);line-height:64px;text-align:center;font-size:28px">
        &#128176;
      </div>
    </div>

    <div style="background:linear-gradient(135deg,#065f46,#047857);border-radius:16px 16px 0 0;padding:32px 28px;text-align:center">
      <h1 style="font-size:24px;color:#ffffff;margin:0 0 8px;font-weight:800;letter-spacing:-0.5px">Ka-ching! New Subscriber</h1>
      <p style="font-size:15px;color:#a7f3d0;margin:0;font-weight:600">+$${planConfig.price}/mo recurring revenue</p>
    </div>

    <div style="background:#ffffff;padding:32px 28px;border:1px solid #e2e8f0;border-top:none">

      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0f3f6;color:#6b7280;font-weight:600;width:120px">Company</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0f3f6;color:#111827;font-weight:700">${profile.company_name || 'Not set'}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0f3f6;color:#6b7280;font-weight:600">Email</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0f3f6;color:#111827">${profile.contact_email || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0f3f6;color:#6b7280;font-weight:600">Plan</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0f3f6">
            <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${planId === 'enterprise' ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : planId === 'portfolio' ? 'linear-gradient(135deg,#1f6feb,#0550ae)' : '#1f6feb'};color:#fff">${planConfig.name}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0f3f6;color:#6b7280;font-weight:600">Revenue</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0f3f6;color:#059669;font-weight:800;font-size:18px">$${planConfig.price}/mo</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:#6b7280;font-weight:600">Date</td>
          <td style="padding:12px 0;color:#6b7280;font-size:13px">${dateStr} at ${timeStr}</td>
        </tr>
      </table>

    </div>

    <div style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 28px;border:1px solid #e2e8f0;border-top:none;text-align:center">
      <a href="https://dashboard.stripe.com/customers" style="display:inline-block;padding:10px 28px;background:#111827;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;margin-right:8px">View in Stripe</a>
      <a href="https://mytenantshield.com/admin/claims" style="display:inline-block;padding:10px 28px;background:#1f6feb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px">Admin Dashboard</a>
    </div>

    <div style="text-align:center;padding:24px 0;font-size:12px;color:#6b7280">
      TenantShield &middot; Revenue notification
    </div>

  </div>
</body>
</html>`,
    }).catch((err: unknown) => console.error('Admin subscription notification error:', err));
  } catch (err) {
    console.error('Failed to notify admin of new subscription:', err);
  }
}
