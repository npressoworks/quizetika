import { getStripeClient } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/server';

export interface DuplicateSubscriptionResolution {
  keptSubscriptionId: string;
  canceledSubscriptionIds: string[];
}

export async function resolveActiveSubscription(
  customerId: string,
  userId: string
): Promise<DuplicateSubscriptionResolution> {
  const stripe = getStripeClient();

  // 1. Stripe 顧客の全サブスクリプションをリスト
  const response = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
  });

  // 有効なサブスクリプションのみをフィルタリング
  const activeSubs = response.data.filter((sub) =>
    ['active', 'trialing', 'past_due'].includes(sub.status)
  );

  if (activeSubs.length <= 1) {
    return {
      keptSubscriptionId: activeSubs[0]?.id || '',
      canceledSubscriptionIds: [],
    };
  }

  // 2. 作成日時順（昇順、最古が最初）にソート
  activeSubs.sort((a, b) => a.created - b.created);

  const keptSub = activeSubs[0]!;
  const toCancel = activeSubs.slice(1);
  const canceledSubscriptionIds: string[] = [];

  const supabase = createAdminClient();

  for (const sub of toCancel) {
    // a. 即座に解約
    await stripe.subscriptions.cancel(sub.id);
    canceledSubscriptionIds.push(sub.id);

    let refundedAmount: number | null = null;
    let refundCurrency: string | null = null;

    // b. 最新インボイスに基づく返金処理
    const invoiceId =
      typeof sub.latest_invoice === 'string'
        ? sub.latest_invoice
        : sub.latest_invoice?.id;

    if (invoiceId) {
      try {
        const invoice = (await stripe.invoices.retrieve(invoiceId)) as any;
        const paymentIntentId =
          typeof invoice.payment_intent === 'string'
            ? invoice.payment_intent
            : invoice.payment_intent?.id;
        const chargeId =
          typeof invoice.charge === 'string' ? invoice.charge : invoice.charge?.id;

        let refund = null;
        if (paymentIntentId) {
          refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
        } else if (chargeId) {
          refund = await stripe.refunds.create({ charge: chargeId });
        }

        if (refund) {
          refundedAmount = refund.amount;
          refundCurrency = refund.currency;
        }
      } catch (refundError) {
        // 返金失敗時はログ出力のみ行い、解約処理自体は継続
        console.error(
          `[DuplicateSubscriptionGuard] Failed to refund for subscription ${sub.id}:`,
          refundError
        );
      }
    }

    // c. 監査ログテーブルへレコード挿入
    try {
      const { error } = await supabase
        .from('billing_duplicate_subscription_incidents' as any)
        .insert({
          user_id: userId,
          kept_subscription_id: keptSub.id,
          canceled_subscription_id: sub.id,
          refunded_amount: refundedAmount,
          refund_currency: refundCurrency,
        } as any);

      if (error) {
        console.error(
          '[DuplicateSubscriptionGuard] Failed to insert audit record:',
          error
        );
      }
    } catch (dbError) {
      console.error(
        '[DuplicateSubscriptionGuard] Database insert threw exception:',
        dbError
      );
    }
  }

  return {
    keptSubscriptionId: keptSub.id,
    canceledSubscriptionIds,
  };
}
