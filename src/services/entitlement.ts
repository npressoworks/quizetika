/**
 * entitlement.ts
 *
 * サーバー専用モジュール（Supabase Admin クライアント依存）。
 * ブラウザコンポーネントから直接インポートしないでください。
 *
 * ブラウザ・サーバー両対応の純粋関数は entitlement-shared.ts を使用してください。
 */
import { createAdminClient } from '@/lib/supabase/server';
import type { StripeSubscriptionSnapshot } from '@/types/subscription';

// 純粋関数・型は shared から re-export（後方互換）
export type { EntitlementUserFields } from './entitlement-shared';
export { computeUserEntitlements } from './entitlement-shared';

/**
 * サーバー側: UID から最新エンタイトルメントを解決する
 */
export async function resolveUserEntitlements(
  uid: string
): Promise<import('@/types/subscription').UserEntitlements> {
  const { computeUserEntitlements: compute } = await import('./entitlement-shared');
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('users')
    .select('subscription_tier, subscription_status, current_period_end, is_premium, moderation_tier')
    .eq('id', uid)
    .maybeSingle();

  if (!data) {
    return compute({});
  }

  return compute({
    subscriptionTier: data.subscription_tier as import('@/types/subscription').SubscriptionTier | null,
    subscriptionStatus: data.subscription_status as import('@/types/subscription').SubscriptionStatus | null,
    currentPeriodEnd: data.current_period_end,
    isPremium: data.is_premium,
    moderationTier: data.moderation_tier as import('./entitlement-shared').EntitlementUserFields['moderationTier'],
  });
}

/**
 * Stripe サブスクリプションイベントから users 課金フィールドを同期する（Admin クライアント）
 */
export async function applySubscriptionFromStripe(
  snapshot: StripeSubscriptionSnapshot
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('users')
    .update({
      subscription_tier: snapshot.subscriptionTier,
      subscription_status: snapshot.subscriptionStatus,
      stripe_customer_id: snapshot.stripeCustomerId,
      stripe_subscription_id: snapshot.stripeSubscriptionId,
      is_premium: snapshot.isPremium,
      current_period_end: snapshot.currentPeriodEnd ? snapshot.currentPeriodEnd.toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', snapshot.uid);

  if (error) {
    throw new Error(`サブスクリプション状態の同期に失敗しました: ${error.message}`);
  }
}

/**
 * 契約失効時に free tier へ戻す
 */
export async function clearPaidEntitlements(
  uid: string,
  stripeCustomerId: string
): Promise<void> {
  await applySubscriptionFromStripe({
    uid,
    stripeCustomerId,
    stripeSubscriptionId: null,
    subscriptionStatus: 'canceled',
    subscriptionTier: 'free',
    currentPeriodEnd: null,
    isPremium: false,
  });
}
