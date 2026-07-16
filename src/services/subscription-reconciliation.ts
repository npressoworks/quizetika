import { getStripeClient } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/server';
import { priceIdToTier } from '@/lib/subscription-plans';
import { applySubscriptionFromStripe, clearPaidEntitlements } from '@/services/entitlement';
import type { SubscriptionStatus, SubscriptionTier } from '@/types/subscription';

export interface ReconciliationSummary {
  evaluatedCount: number;
  correctedCount: number;
  skippedCount: number;
}

interface ReconciliationUserRow {
  id: string;
  stripe_customer_id: string;
  subscription_tier: string | null;
  subscription_status: string | null;
}

const PAGE_SIZE = 200;
const ACTIVE_STRIPE_STATUSES = ['active', 'trialing', 'past_due'];

/**
 * Stripe 実契約状態とローカル DB の突合・是正を行う定期整合性チェック。
 *
 * - `stripe_customer_id` を持つ全ユーザーをページングで取得する
 * - 各ユーザーについて Stripe 上の有効なサブスクリプション（active/trialing/past_due）を確認し、
 *   複数ある場合は最古のものを正として扱う
 * - ローカル DB の tier/status と乖離がある場合のみ是正し、監査レコードを1件挿入する
 * - 個々のユーザーの Stripe API 呼び出し失敗はスキップして処理を継続する
 * - ユーザー一覧取得自体（Supabase クエリ）が失敗した場合は処理を中断し例外を再スローする
 */
export async function reconcileSubscriptions(): Promise<ReconciliationSummary> {
  const supabase = createAdminClient();
  const stripe = getStripeClient();

  let evaluatedCount = 0;
  let correctedCount = 0;
  let skippedCount = 0;

  let page = 0;
  for (;;) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('users')
      .select('id, stripe_customer_id, subscription_tier, subscription_status')
      .not('stripe_customer_id', 'is', null)
      .range(from, to);

    if (error) {
      throw new Error(`ユーザー一覧の取得に失敗しました: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as ReconciliationUserRow[];
    if (rows.length === 0) {
      break;
    }

    for (const user of rows) {
      evaluatedCount += 1;
      const customerId = user.stripe_customer_id;

      let subscriptions: Array<{
        id: string;
        status: string;
        created: number;
        items?: {
          data?: Array<{
            price?: { id?: string };
            current_period_end?: number;
          }>;
        };
      }>;

      try {
        const response = await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
        });
        subscriptions = response.data as typeof subscriptions;
      } catch (stripeError) {
        skippedCount += 1;
        console.error(
          `[SubscriptionReconciliationService] Failed to fetch Stripe subscriptions for user ${user.id}:`,
          stripeError
        );
        continue;
      }

      const activeSubs = subscriptions.filter((sub) =>
        ACTIVE_STRIPE_STATUSES.includes(sub.status)
      );

      let hasActive = false;
      let desiredTier: SubscriptionTier = 'free';
      let desiredStatus: SubscriptionStatus | null = null;
      let desiredSubscriptionId: string | null = null;
      let desiredPeriodEnd: Date | null = null;

      if (activeSubs.length > 0) {
        activeSubs.sort((a, b) => a.created - b.created);
        const subscription = activeSubs[0]!;
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const tier = priceId ? priceIdToTier(priceId) : null;

        if (tier) {
          hasActive = true;
          desiredTier = tier;
          desiredStatus = subscription.status as SubscriptionStatus;
          desiredSubscriptionId = subscription.id;
          const periodEndUnix = subscription.items?.data?.[0]?.current_period_end;
          desiredPeriodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;
        }
      }

      const previousTier = (user.subscription_tier ?? 'free') as SubscriptionTier;
      const previousStatus = (user.subscription_status ?? null) as SubscriptionStatus | null;

      const matches = hasActive
        ? previousTier === desiredTier && previousStatus === desiredStatus
        : previousTier === 'free';

      if (matches) {
        continue;
      }

      if (hasActive) {
        await applySubscriptionFromStripe({
          uid: user.id,
          stripeCustomerId: customerId,
          stripeSubscriptionId: desiredSubscriptionId,
          subscriptionStatus: desiredStatus,
          subscriptionTier: desiredTier,
          currentPeriodEnd: desiredPeriodEnd,
        });
      } else {
        await clearPaidEntitlements(user.id, customerId);
      }

      correctedCount += 1;

      const { error: insertError } = await supabase
        .from('billing_reconciliation_corrections' as any)
        .insert({
          user_id: user.id,
          previous_tier: previousTier,
          previous_status: previousStatus,
          corrected_tier: hasActive ? desiredTier : 'free',
          corrected_status: hasActive ? desiredStatus : 'canceled',
        } as any);

      if (insertError) {
        console.error(
          `[SubscriptionReconciliationService] Failed to insert audit record for user ${user.id}:`,
          insertError
        );
      }
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }
    page += 1;
  }

  return { evaluatedCount, correctedCount, skippedCount };
}
