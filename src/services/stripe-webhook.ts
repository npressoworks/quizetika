import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe/server';
import { priceIdToTier } from '@/lib/subscription-plans';
import {
  applySubscriptionFromStripe,
  clearPaidEntitlements,
} from '@/services/entitlement';
import { resolveActiveSubscription } from '@/services/duplicate-subscription-guard';
import type {
  StripeSubscriptionSnapshot,
  SubscriptionStatus,
  SubscriptionTier,
} from '@/types/subscription';

export function resolveUidFromSubscription(
  subscription: Stripe.Subscription
): string | null {
  const metadataUid =
    subscription.metadata?.userId?.trim() || subscription.metadata?.firebaseUid?.trim();
  if (metadataUid) return metadataUid;
  return null;
}

export function buildSnapshotFromSubscription(
  subscription: Stripe.Subscription,
  uid: string
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
  const subscriptionTier: SubscriptionTier = mappedTier;
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? '';

  const periodEndUnix = subscription.items.data[0]?.current_period_end;
  const currentPeriodEnd =
    periodEndUnix != null ? new Date(periodEndUnix * 1000) : null;

  return {
    uid,
    stripeCustomerId: customerId,
    stripeSubscriptionId: status === 'canceled' ? null : subscription.id,
    subscriptionStatus: status,
    subscriptionTier,
    currentPeriodEnd,
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
  const uid = customer.metadata?.userId?.trim() || customer.metadata?.firebaseUid?.trim();
  return uid || null;
}

export async function handleStripeSubscriptionEvent(
  subscription: Stripe.Subscription,
  uid?: string | null
): Promise<void> {
  let resolvedUid = uid?.trim() || resolveUidFromSubscription(subscription);

  if (!resolvedUid) {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
    if (customerId) {
      resolvedUid = await resolveUidFromCustomer(customerId);
    }
  }

  if (!resolvedUid) {
    console.warn('[stripe-webhook] firebaseUid を解決できません:', subscription.id);
    return;
  }

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? '';

  if (subscription.status === 'canceled') {
    // 解約されたサブスクリプションを処理する際、他にもアクティブな契約が残っているか確認
    if (customerId) {
      const stripeClient = getStripeClient();
      const otherSubs = await stripeClient.subscriptions.list({
        customer: customerId,
      });
      const activeSubs = otherSubs.data.filter(
        (s) => s.id !== subscription.id && ['active', 'trialing', 'past_due'].includes(s.status)
      );

      if (activeSubs.length > 0) {
        // 残存する最古のアクティブなサブスクリプションで契約状態を更新
        activeSubs.sort((a, b) => a.created - b.created);
        const snapshot = buildSnapshotFromSubscription(activeSubs[0], resolvedUid);
        if (snapshot) {
          await applySubscriptionFromStripe(snapshot);
          return;
        }
      }
    }

    await clearPaidEntitlements(resolvedUid, customerId);
    return;
  }

  // 重複サブスクリプションの検知と是正
  let canceledSubscriptionIds: string[] = [];
  if (customerId && resolvedUid) {
    const resolution = await resolveActiveSubscription(customerId, resolvedUid);
    canceledSubscriptionIds = resolution.canceledSubscriptionIds;
  }

  // もし現在処理中のイベントが、重複検知によって既に解約されたサブスクリプションであれば適用をスキップ
  if (canceledSubscriptionIds.includes(subscription.id)) {
    console.log(
      `[stripe-webhook] Skipping apply subscription since this is a duplicate canceled subscription: ${subscription.id}`
    );
    return;
  }

  const snapshot = buildSnapshotFromSubscription(subscription, resolvedUid);
  if (!snapshot) return;

  await applySubscriptionFromStripe(snapshot);
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const uid = session.client_reference_id?.trim();
  if (!uid) {
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
  await handleStripeSubscriptionEvent(subscription, uid);
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
