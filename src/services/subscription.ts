import { createAdminClient } from '@/lib/supabase/server';
import { getAppBaseUrl, getStripeClient } from '@/lib/stripe/server';
import { getPriceIdForInterval, getPaidTierDefinitions, priceIdToTier } from '@/lib/subscription-plans';
import { resolveUserEntitlements } from '@/services/entitlement';
import type { PriceInterval, SubscriptionTier } from '@/types/subscription';

export class AlreadySubscribedError extends Error {
  constructor() {
    super('既に有料プランに加入しています');
    this.name = 'AlreadySubscribedError';
  }
}

export class DowngradeNotAllowedError extends Error {
  constructor() {
    super('Creatorプラン契約中のため、Playerへのダウングレードはプラン変更機能をご利用ください');
    this.name = 'DowngradeNotAllowedError';
  }
}

export class NoActiveSubscriptionError extends Error {
  constructor() {
    super('有効な有料契約が見つかりません');
    this.name = 'NoActiveSubscriptionError';
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('ユーザーが見つかりません');
    this.name = 'UserNotFoundError';
  }
}

export interface CreateCheckoutSessionInput {
  uid: string;
  email: string;
  priceInterval: PriceInterval;
  plan: 'player' | 'creator';
}

export interface CreateCheckoutSessionResult {
  sessionUrl: string;
}

export interface CreatePortalSessionInput {
  uid: string;
}

/**
 * Firebase UID とメールから Stripe Customer を取得または新規作成する
 */
export async function getOrCreateStripeCustomer(uid: string, email: string): Promise<string> {
  const supabase = createAdminClient();
  const { data: userRow } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', uid)
    .maybeSingle();

  if (!userRow) {
    throw new UserNotFoundError();
  }

  if (userRow.stripe_customer_id) {
    return userRow.stripe_customer_id;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email,
    metadata: { userId: uid },
  });

  const { error } = await supabase
    .from('users')
    .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
    .eq('id', uid);

  if (error) {
    throw new Error(`Stripe Customer IDの保存に失敗しました: ${error.message}`);
  }

  return customer.id;
}

/**
 * 認証済み無料ユーザー向け Checkout Session を発行する
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<CreateCheckoutSessionResult> {
  const entitlements = await resolveUserEntitlements(input.uid);
  if (entitlements.hasPaidEntitlements) {
    if (entitlements.subscriptionTier === 'creator' && input.plan === 'player') {
      throw new DowngradeNotAllowedError();
    }
    throw new AlreadySubscribedError();
  }

  const customerId = await getOrCreateStripeCustomer(input.uid, input.email);
  const stripe = getStripeClient();

  // Live duplicate subscription check (29.14)
  const activeSubs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });
  if (activeSubs.data.length > 0) {
    throw new AlreadySubscribedError();
  }

  const priceId = getPriceIdForInterval(input.plan, input.priceInterval);
  const appUrl = getAppBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: input.uid,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/pricing?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=canceled`,
  });

  if (!session.url) {
    throw new Error('Stripe Checkout Session URL が取得できませんでした');
  }

  return { sessionUrl: session.url };
}

/**
 * 有効な有料契約者向け Customer Portal Session を発行する
 */
export async function createPortalSession(
  input: CreatePortalSessionInput
): Promise<{ sessionUrl: string }> {
  const supabase = createAdminClient();
  const { data: userRow } = await supabase
    .from('users')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('id', input.uid)
    .maybeSingle();

  if (!userRow) {
    throw new UserNotFoundError();
  }

  const stripeCustomerId = userRow.stripe_customer_id;
  if (!stripeCustomerId) {
    throw new NoActiveSubscriptionError();
  }

  const stripe = getStripeClient();
  const stripeSubscriptionId = userRow.stripe_subscription_id;

  const sessionParams: any = {
    customer: stripeCustomerId,
    return_url: `${getAppBaseUrl()}/pricing`,
  };

  if (stripeSubscriptionId) {
    sessionParams.flow_data = {
      type: 'subscription_update',
      subscription_update: {
        subscription: stripeSubscriptionId,
      },
    };
  }

  const session = await stripe.billingPortal.sessions.create(sessionParams);

  return { sessionUrl: session.url };
}

export class SamePlanError extends Error {
  constructor() {
    super('現在契約中のプランと同一のプランへの変更はできません');
    this.name = 'SamePlanError';
  }
}

/**
 * 有料プラン（player <-> creator）間の切替（proration_behavior: create_prorations）
 */
export async function changeSubscriptionPlan(
  uid: string,
  targetPlan: 'player' | 'creator'
): Promise<SubscriptionTier> {
  const entitlements = await resolveUserEntitlements(uid);
  if (!entitlements.hasPaidEntitlements) {
    throw new NoActiveSubscriptionError();
  }

  if (entitlements.subscriptionTier === targetPlan) {
    throw new SamePlanError();
  }

  const supabase = createAdminClient();
  const { data: userRow } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', uid)
    .maybeSingle();

  if (!userRow || !userRow.stripe_customer_id) {
    throw new NoActiveSubscriptionError();
  }

  const stripeCustomerId = userRow.stripe_customer_id;
  const stripe = getStripeClient();

  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
  });

  const activeSubs = subs.data.filter((s) =>
    ['active', 'trialing', 'past_due'].includes(s.status)
  );

  if (activeSubs.length === 0) {
    throw new NoActiveSubscriptionError();
  }

  // 最古のサブスクリプションを正として更新
  activeSubs.sort((a, b) => a.created - b.created);
  const currentSub = activeSubs[0]!;

  const currentPriceId = currentSub.items.data[0]?.price?.id;
  if (!currentPriceId) {
    throw new Error('現在のサブスクリプションから価格情報を取得できませんでした');
  }

  // 月額か年額かを判定
  const allTiers = getPaidTierDefinitions();
  let interval: 'monthly' | 'yearly' = 'monthly';
  for (const tierDef of allTiers) {
    if (tierDef.priceIds.monthly === currentPriceId) {
      interval = 'monthly';
      break;
    }
    if (tierDef.priceIds.yearly === currentPriceId) {
      interval = 'yearly';
      break;
    }
  }

  const targetPriceId = getPriceIdForInterval(targetPlan, interval);
  const currentItemId = currentSub.items.data[0]!.id;

  const updatedSub = await stripe.subscriptions.update(currentSub.id, {
    items: [{ id: currentItemId, price: targetPriceId }],
    proration_behavior: 'create_prorations',
  });

  const newPriceId = updatedSub.items.data[0]?.price?.id;
  return priceIdToTier(newPriceId ?? '') ?? targetPlan;
}

