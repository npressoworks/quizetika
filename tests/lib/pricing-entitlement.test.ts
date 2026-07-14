import { resolvePricingUiState } from '@/lib/pricing-entitlement';
import type { User } from '@/types';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'テストユーザー',
    avatarUrl: 'https://example.com/avatar.png',
    bio: '',
    followedGenres: [],
    badges: [],
    createdQuizzesCount: 0,
    totalPlayCount: 0,
    followersCount: 0,
    followingCount: 0,
    reputationScore: 0,
    moderationTier: 'newcomer',
    reputationHistory: [],
    lastReputationCalculatedAt: null,
    totalFailedQuestionsCount: 0,
    deleteStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('pricing-entitlement', () => {
  test('loading: ctaMode が loading', () => {
    const state = resolvePricingUiState(null, true);
    expect(state.ctaMode).toBe('loading');
    expect(state.hasPaidEntitlements).toBe(false);
  });

  test('guest: 未認証は guest CTA', () => {
    const state = resolvePricingUiState(null, false);
    expect(state.ctaMode).toBe('guest');
    expect(state.hasPaidEntitlements).toBe(false);
  });

  test('free: 無料 tier は subscribe CTA', () => {
    const state = resolvePricingUiState(makeUser({ subscriptionTier: 'free' }), false);
    expect(state.ctaMode).toBe('subscribe');
    expect(state.subscriptionTier).toBe('free');
    expect(state.hasPaidEntitlements).toBe(false);
  });

  test('player active: manage CTA と有料契約判定', () => {
    const state = resolvePricingUiState(
      makeUser({ subscriptionTier: 'player', subscriptionStatus: 'active' }),
      false
    );
    expect(state.ctaMode).toBe('manage');
    expect(state.subscriptionTier).toBe('player');
    expect(state.hasPaidEntitlements).toBe(true);
  });

  test('creator active: manage CTA と有料契約判定', () => {
    const state = resolvePricingUiState(
      makeUser({ subscriptionTier: 'creator', subscriptionStatus: 'active' }),
      false
    );
    expect(state.ctaMode).toBe('manage');
    expect(state.subscriptionTier).toBe('creator');
    expect(state.hasPaidEntitlements).toBe(true);
  });

  test('creator canceled: subscribe CTA、有料契約非アクティブ', () => {
    const state = resolvePricingUiState(
      makeUser({ subscriptionTier: 'creator', subscriptionStatus: 'canceled' }),
      false
    );
    expect(state.ctaMode).toBe('subscribe');
    expect(state.subscriptionTier).toBe('creator');
    expect(state.hasPaidEntitlements).toBe(false);
  });

  test('モデレーター免除: 契約バッジ対象外（有料契約ではない）', () => {
    const state = resolvePricingUiState(
      makeUser({ subscriptionTier: 'free', moderationTier: 'moderator' }),
      false
    );
    expect(state.ctaMode).toBe('subscribe');
    expect(state.subscriptionTier).toBe('free');
    expect(state.hasPaidEntitlements).toBe(false);
  });
});
