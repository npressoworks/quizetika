import {
  computeUserEntitlements,
  applySubscriptionFromStripe,
} from '@/services/entitlement';

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
      subscriptionTier: 'pro',
      subscriptionStatus: 'active',
    });
    expect(entitlements.hasPaidEntitlements).toBe(true);
    expect(entitlements.hasUnlimitedAiQuestions).toBe(true);
  });

  it('解約済み pro は hasPaidEntitlements が false', () => {
    const entitlements = computeUserEntitlements({
      subscriptionTier: 'pro',
      subscriptionStatus: 'canceled',
    });
    expect(entitlements.hasPaidEntitlements).toBe(false);
    expect(entitlements.hasUnlimitedAiQuestions).toBe(false);
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
      subscriptionTier: 'pro',
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
      subscriptionTier: 'pro',
      currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_tier: 'pro',
        stripe_customer_id: 'cus_1',
        stripe_subscription_id: 'sub_1',
      })
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 'uid-1');
  });
});
