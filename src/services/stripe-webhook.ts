import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe/server';
import { priceIdToTier } from '@/lib/subscription-plans';
import {
  applySubscriptionFromStripe,
  clearPaidEntitlements,
} from '@/services/entitlement';
import type {
  StripeSubscriptionSnapshot,
  SubscriptionStatus,
  SubscriptionTier,
} from '@/types/subscription';

const PAID_ACTIVE_STATUSES: SubscriptionStatus[] = ['active', 'trialing'];

export function resolveFirebaseUidFromSubscription(
  subscription: Stripe.Subscription
): string | null {
  const metadataUid = subscription.metadata?.firebaseUid?.trim();
  if (metadataUid) return metadataUid;
  return null;
}

export function buildSnapshotFromSubscription(
  subscription: Stripe.Subscription,
  firebaseUid: string
): StripeSubscriptionSnapshot | null {
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    console.warn('[stripe-webhook] subscription に price ID がありません:', subscription.id);
    return null;
  }

  const mappedTier = priceIdToTier(priceId);
  if (!mappedTier) {
    console.warn('[stripe-webhook] 未知の Price ID:', priceId);
    return null;
  }

  const status = subscription.status as SubscriptionStatus;
  const hasPaid =
    (mappedTier === 'pro' || mappedTier === 'premium') &&
    PAID_ACTIVE_STATUSES.includes(status);

  const subscriptionTier: SubscriptionTier = hasPaid ? mappedTier : 'free';
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? '';

  const periodEndUnix = subscription.items.data[0]?.current_period_end;
  const currentPeriodEnd =
    periodEndUnix != null ? new Date(periodEndUnix * 1000) : null;

  return {
    firebaseUid,
    stripeCustomerId: customerId,
    stripeSubscriptionId: status === 'canceled' ? null : subscription.id,
    subscriptionStatus: status,
    subscriptionTier,
    currentPeriodEnd,
    isPremium: hasPaid,
  };
}

export async function isStripeEventProcessed(eventId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('stripe_processed_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  return !!data;
}

export async function markStripeEventProcessed(
  eventId: string,
  type: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('stripe_processed_events')
    .insert({ event_id: eventId, type });

  if (error) {
    throw new Error(`Webhookイベント冪等性記録の保存に失敗しました: ${error.message}`);
  }
}

async function resolveUidFromCustomer(customerId: string): Promise<string | null> {
  const stripe = getStripeClient();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  const uid = customer.metadata?.firebaseUid?.trim();
  return uid || null;
}

export async function handleStripeSubscriptionEvent(
  subscription: Stripe.Subscription,
  firebaseUid?: string | null
): Promise<void> {
  let uid = firebaseUid?.trim() || resolveFirebaseUidFromSubscription(subscription);

  if (!uid) {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
    if (customerId) {
      uid = await resolveUidFromCustomer(customerId);
    }
  }

  if (!uid) {
    console.warn('[stripe-webhook] firebaseUid を解決できません:', subscription.id);
    return;
  }

  if (subscription.status === 'canceled') {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id ?? '';
    await clearPaidEntitlements(uid, customerId);
    return;
  }

  const snapshot = buildSnapshotFromSubscription(subscription, uid);
  if (!snapshot) return;

  await applySubscriptionFromStripe(snapshot);
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const firebaseUid = session.client_reference_id?.trim();
  if (!firebaseUid) {
    console.warn('[stripe-webhook] checkout.session に client_reference_id がありません');
    return;
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    console.warn('[stripe-webhook] checkout.session に subscription がありません');
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await handleStripeSubscriptionEvent(subscription, firebaseUid);
}

function resolveSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parentSubscription = invoice.parent?.subscription_details?.subscription;
  if (!parentSubscription) return null;
  return typeof parentSubscription === 'string'
    ? parentSubscription
    : parentSubscription.id;
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = resolveSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await handleStripeSubscriptionEvent(subscription);
}
