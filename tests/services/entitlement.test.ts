import {
  computeUserEntitlements,
  applySubscriptionFromStripe,
} from '@/services/entitlement';
import type { SubscriptionTier } from '@/types/subscription';

/**
 * Phase 41 以前の DB に残り得る旧tier値。resolveSubscriptionTier() が 'creator' へ
 * マッピングする後方互換パスを検証するため、型システムをあえて迂回して使用する。
 */
const LEGACY_PRO_TIER = 'pro' as unknown as SubscriptionTier;

const createChainMock = (resolveValue: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    update: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(resolveValue)),
    then: jest.fn((onFulfilled: any) => Promise.resolve(resolveValue).then(onFulfilled)),
  };
  return chain;
};

let chain: any;

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: jest.fn(() => chain),
  }),
}));

describe('EntitlementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chain = createChainMock({ data: null, error: null });
  });

  it('free ユーザーは hasUnlimitedAiQuestions が false', () => {
    const entitlements = computeUserEntitlements({
      subscriptionTier: 'free',
    });
    expect(entitlements.hasPaidEntitlements).toBe(false);
    expect(entitlements.hasUnlimitedAiQuestions).toBe(false);
  });

  it('active pro ユーザーは hasUnlimitedAiQuestions が true', () => {
    const entitlements = computeUserEntitlements({
      subscriptionTier: LEGACY_PRO_TIER,
      subscriptionStatus: 'active',
    });
    expect(entitlements.hasPaidEntitlements).toBe(true);
    expect(entitlements.hasUnlimitedAiQuestions).toBe(true);
  });

  it('解約済み pro は hasPaidEntitlements が false', () => {
    const entitlements = computeUserEntitlements({
      subscriptionTier: LEGACY_PRO_TIER,
      subscriptionStatus: 'canceled',
    });
    expect(entitlements.hasPaidEntitlements).toBe(false);
    expect(entitlements.hasUnlimitedAiQuestions).toBe(false);
  });

  it('支払い失敗中（past_due）の creator は tier を維持したままエンタイトルメントが false になる（要件36.5回帰確認）', () => {
    const entitlements = computeUserEntitlements({
      subscriptionTier: 'creator',
      subscriptionStatus: 'past_due',
    });
    expect(entitlements.subscriptionTier).toBe('creator');
    expect(entitlements.subscriptionStatus).toBe('past_due');
    expect(entitlements.hasPaidEntitlements).toBe(false);
    expect(entitlements.hasUnlimitedAiQuestions).toBe(false);
    expect(entitlements.hasCreatorEntitlements).toBe(false);
  });

  it('支払い失敗中（past_due）の player は tier を維持したままエンタイトルメントが false になる（要件36.5回帰確認）', () => {
    const entitlements = computeUserEntitlements({
      subscriptionTier: 'player',
      subscriptionStatus: 'past_due',
    });
    expect(entitlements.subscriptionTier).toBe('player');
    expect(entitlements.subscriptionStatus).toBe('past_due');
    expect(entitlements.hasPaidEntitlements).toBe(false);
    expect(entitlements.hasUnlimitedAiQuestions).toBe(false);
    expect(entitlements.hasCreatorEntitlements).toBe(false);
  });

  it('モデレーターは契約なしでも hasUnlimitedAiQuestions が true', () => {
    const entitlements = computeUserEntitlements({
      subscriptionTier: 'free',
      moderationTier: 'moderator',
    });
    expect(entitlements.hasPaidEntitlements).toBe(false);
    expect(entitlements.hasUnlimitedAiQuestions).toBe(true);
  });

  it('Postgres の ISO文字列形式の currentPeriodEnd を正しく Date へ変換する', () => {
    const entitlements = computeUserEntitlements({
      subscriptionTier: LEGACY_PRO_TIER,
      subscriptionStatus: 'active',
      currentPeriodEnd: '2026-07-01T00:00:00.000Z',
    });
    expect(entitlements.currentPeriodEnd).toEqual(new Date('2026-07-01T00:00:00.000Z'));
  });

  it('applySubscriptionFromStripe が users に課金フィールドを書き込む', async () => {
    chain = createChainMock({ error: null });

    await applySubscriptionFromStripe({
      uid: 'uid-1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      subscriptionStatus: 'active',
      subscriptionTier: 'creator',
      currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_tier: 'creator',
        stripe_customer_id: 'cus_1',
        stripe_subscription_id: 'sub_1',
      })
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 'uid-1');
  });
});
