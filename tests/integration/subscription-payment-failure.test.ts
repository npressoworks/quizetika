/**
 * 結合テスト: 支払い失敗(past_due)と復帰(active)のシナリオ
 *
 * Phase 42 (要件36.1, 36.3, 36.4, 36.6, 36.7 のうち 36.1/36.3/36.4 を担当)
 *
 * 目的:
 * - `@/services/entitlement` と `@/services/stripe-webhook` はモックせず、実際の関数チェーン
 *   (`handleStripeSubscriptionEvent` → `buildSnapshotFromSubscription` → `applySubscriptionFromStripe`)
 *   を通して、past_due 受信時に tier が維持されたまま status のみ変わり Supabase へ書き込まれることを検証する。
 * - past_due → active への復帰時に、その書き込まれた値を `computeUserEntitlements()` に渡すと
 *   `hasPaidEntitlements` が再び true になることを検証する(要件36.3: 支払い成功時の復帰)。
 *
 * モック対象は `@/lib/supabase/server` の `createAdminClient()` と `@/lib/stripe/server` の
 * `getStripeClient()` のみ。
 *
 * GET /api/cron/sync-subscriptions の認可・実行結合テストは
 * `tests/api/sync-subscriptions.test.ts` (30.4) で既にカバー済みのため、ここでは扱わない。
 */
import type Stripe from 'stripe';
import {
  handleStripeSubscriptionEvent,
} from '@/services/stripe-webhook';
import { computeUserEntitlements } from '@/services/entitlement';

const mockSubscriptionsList = jest.fn();
const mockUsersUpdate = jest.fn();

jest.mock('@/lib/stripe/server', () => ({
  getStripeClient: () => ({
    customers: {
      retrieve: jest.fn().mockResolvedValue({
        deleted: false,
        metadata: {},
      }),
    },
    subscriptions: {
      retrieve: jest.fn(),
      cancel: jest.fn(),
      list: (...args: unknown[]) => mockSubscriptionsList(...args),
    },
    invoices: {
      retrieve: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
  }),
}));

jest.mock('@/lib/supabase/server', () => {
  const createUsersChain = () => {
    const chain: any = {
      update: jest.fn((payload: Record<string, unknown>) => {
        mockUsersUpdate(payload);
        return chain;
      }),
      eq: jest.fn((_col: string, _value: string) => Promise.resolve({ error: null })),
    };
    return chain;
  };

  return {
    createAdminClient: () => ({
      from: jest.fn(() => createUsersChain()),
    }),
  };
});

function buildCreatorSubscription(status: Stripe.Subscription['status']): Stripe.Subscription {
  return {
    id: 'sub_creator_1',
    customer: 'cus_1',
    status,
    items: {
      data: [
        {
          price: { id: 'price_creator_monthly_test' },
          current_period_end: 1782864000,
        },
      ],
    },
    metadata: { userId: 'uid-1' },
  } as unknown as Stripe.Subscription;
}

describe('結合テスト: サブスクリプション支払い失敗・復帰フロー (Phase 42)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_PRICE_PLAYER_MONTHLY = 'price_player_monthly_test';
    process.env.STRIPE_PRICE_PLAYER_YEARLY = 'price_player_yearly_test';
    process.env.STRIPE_PRICE_CREATOR_MONTHLY = 'price_creator_monthly_test';
    process.env.STRIPE_PRICE_CREATOR_YEARLY = 'price_creator_yearly_test';
  });

  it('customer.subscription.updated (past_due) 受信時、tier は維持されたまま status のみ past_due で DB へ書き込まれる (要件36.1)', async () => {
    const subscription = buildCreatorSubscription('past_due');
    // resolveActiveSubscription の重複検知チェックで自分自身のみが返るようにする
    mockSubscriptionsList.mockResolvedValue({ data: [subscription] });

    await handleStripeSubscriptionEvent(subscription);

    expect(mockUsersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_tier: 'creator',
        subscription_status: 'past_due',
      })
    );
  });

  it('past_due から active へ復帰した際、DB更新値が hasPaidEntitlements: true を再度もたらす (要件36.3)', async () => {
    // 1. past_due 状態を作る
    const pastDueSubscription = buildCreatorSubscription('past_due');
    mockSubscriptionsList.mockResolvedValue({ data: [pastDueSubscription] });
    await handleStripeSubscriptionEvent(pastDueSubscription);

    expect(mockUsersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_tier: 'creator',
        subscription_status: 'past_due',
      })
    );

    mockUsersUpdate.mockClear();

    // 2. active への復帰イベントを受信
    const activeSubscription = buildCreatorSubscription('active');
    mockSubscriptionsList.mockResolvedValue({ data: [activeSubscription] });
    await handleStripeSubscriptionEvent(activeSubscription);

    expect(mockUsersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_tier: 'creator',
        subscription_status: 'active',
      })
    );

    // 3. 実際に DB へ書き込まれた値(モック経由で記録された引数)を computeUserEntitlements に渡す
    const writtenFields = mockUsersUpdate.mock.calls[mockUsersUpdate.mock.calls.length - 1][0];
    const entitlements = computeUserEntitlements({
      subscriptionTier: writtenFields.subscription_tier,
      subscriptionStatus: writtenFields.subscription_status,
      currentPeriodEnd: writtenFields.current_period_end,
    });

    expect(entitlements.hasPaidEntitlements).toBe(true);
    expect(entitlements.hasCreatorEntitlements).toBe(true);
  });
});
