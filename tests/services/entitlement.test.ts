import {
  computeUserEntitlements,
  applySubscriptionFromStripe,
} from '@/services/entitlement';

jest.mock('@/lib/firebase/admin', () => {
  const mockSet = jest.fn().mockResolvedValue(undefined);
  const mockDoc = jest.fn(() => ({ set: mockSet }));
  const mockCollection = jest.fn(() => ({ doc: mockDoc }));
  return {
    getAdminFirestore: () => ({ collection: mockCollection }),
    __mockSet: mockSet,
    __mockDoc: mockDoc,
  };
});

describe('EntitlementService', () => {
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

  it('applySubscriptionFromStripe が users に課金フィールドを書き込む', async () => {
    const admin = jest.requireMock('@/lib/firebase/admin');
    await applySubscriptionFromStripe({
      firebaseUid: 'uid-1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      subscriptionStatus: 'active',
      subscriptionTier: 'pro',
      currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
      isPremium: true,
    });

    expect(admin.__mockDoc).toHaveBeenCalledWith('uid-1');
    expect(admin.__mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionTier: 'pro',
        isPremium: true,
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
      }),
      { merge: true }
    );
  });
});
