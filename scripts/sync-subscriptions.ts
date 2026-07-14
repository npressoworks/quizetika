import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local をロード
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
  console.error('環境変数が不足しています。.env.local を確認してください。');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16' as any,
});

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('ローカル DB 内の全ユーザーの Stripe 契約状態を同期中...');

  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*')
    .not('stripe_customer_id', 'is', null);

  if (userError || !users) {
    console.error('ユーザーの取得に失敗しました:', userError);
    return;
  }

  console.log(`${users.length} 件の顧客が見つかりました。`);

  for (const user of users) {
    const customerId = user.stripe_customer_id;
    console.log(`\nユーザー: ${user.email} (ID: ${user.id})`);
    console.log(`Stripe Customer ID: ${customerId}`);

    try {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
      });

      const activeSubs = subs.data.filter((s) =>
        ['active', 'trialing', 'past_due'].includes(s.status)
      );

      if (activeSubs.length === 0) {
        console.log('Stripe 上にアクティブなサブスクリプションがありません。free にリセットします。');
        await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_status: null,
            stripe_subscription_id: null,
            current_period_end: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        continue;
      }

      // 最古の有効な契約を取得
      activeSubs.sort((a, b) => a.created - b.created);
      const subscription = activeSubs[0];
      const priceId = subscription.items.data[0]?.price?.id;

      if (!priceId) {
        console.warn('サブスクリプション内に価格IDが見つかりません');
        continue;
      }

      let tier: 'free' | 'player' | 'creator' = 'free';
      if (
        priceId === process.env.STRIPE_PRICE_PLAYER_MONTHLY ||
        priceId === process.env.STRIPE_PRICE_PLAYER_YEARLY
      ) {
        tier = 'player';
      } else if (
        priceId === process.env.STRIPE_PRICE_CREATOR_MONTHLY ||
        priceId === process.env.STRIPE_PRICE_CREATOR_YEARLY
      ) {
        tier = 'creator';
      }

      console.log(`Stripe上の状態 ➔ プラン: ${tier}, ステータス: ${subscription.status}`);

      const periodEndUnix = subscription.items.data[0]?.current_period_end;
      const currentPeriodEnd = periodEndUnix
        ? new Date(periodEndUnix * 1000).toISOString()
        : null;

      const { error: updateError } = await supabase
        .from('users')
        .update({
          subscription_tier: tier,
          subscription_status: subscription.status,
          stripe_subscription_id: subscription.id,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('DB更新に失敗しました:', updateError);
      } else {
        console.log('同期完了！');
      }
    } catch (e) {
      console.error(`Stripe からの情報取得エラー:`, e);
    }
  }
}

main().catch(console.error);
