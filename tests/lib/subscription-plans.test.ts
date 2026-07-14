process.env.STRIPE_PRICE_PLAYER_MONTHLY = 'price_player_monthly_test';
process.env.STRIPE_PRICE_PLAYER_YEARLY = 'price_player_yearly_test';
process.env.STRIPE_PRICE_CREATOR_MONTHLY = 'price_creator_monthly_test';
process.env.STRIPE_PRICE_CREATOR_YEARLY = 'price_creator_yearly_test';

import { hasFeature, resolveSubscriptionTier } from '@/lib/subscription-plans';

describe('subscription-plans', () => {
  const originalPlayerMonthly = process.env.STRIPE_PRICE_PLAYER_MONTHLY;
  const originalPlayerYearly = process.env.STRIPE_PRICE_PLAYER_YEARLY;
  const originalCreatorMonthly = process.env.STRIPE_PRICE_CREATOR_MONTHLY;
  const originalCreatorYearly = process.env.STRIPE_PRICE_CREATOR_YEARLY;

  beforeEach(() => {
    process.env.STRIPE_PRICE_PLAYER_MONTHLY = 'price_player_monthly_test';
    process.env.STRIPE_PRICE_PLAYER_YEARLY = 'price_player_yearly_test';
    process.env.STRIPE_PRICE_CREATOR_MONTHLY = 'price_creator_monthly_test';
    process.env.STRIPE_PRICE_CREATOR_YEARLY = 'price_creator_yearly_test';
    jest.resetModules();
  });

  afterEach(() => {
    process.env.STRIPE_PRICE_PLAYER_MONTHLY = originalPlayerMonthly;
    process.env.STRIPE_PRICE_PLAYER_YEARLY = originalPlayerYearly;
    process.env.STRIPE_PRICE_CREATOR_MONTHLY = originalCreatorMonthly;
    process.env.STRIPE_PRICE_CREATOR_YEARLY = originalCreatorYearly;
  });

  it('未設定 subscriptionTier は free として解釈する', () => {
    expect(resolveSubscriptionTier(undefined)).toBe('free');
    expect(resolveSubscriptionTier(null)).toBe('free');
  });

  it('Player / Creator の Price ID から tier を解決する', async () => {
    const { priceIdToTier: resolve } = await import('@/lib/subscription-plans');
    expect(resolve('price_player_monthly_test')).toBe('player');
    expect(resolve('price_player_yearly_test')).toBe('player');
    expect(resolve('price_creator_monthly_test')).toBe('creator');
    expect(resolve('price_creator_yearly_test')).toBe('creator');
    expect(resolve('price_unknown')).toBeNull();
  });

  it('interval と tier から Price ID を取得する', async () => {
    const { getPriceIdForInterval: getPrice } = await import('@/lib/subscription-plans');
    expect(getPrice('player', 'monthly')).toBe('price_player_monthly_test');
    expect(getPrice('player', 'yearly')).toBe('price_player_yearly_test');
    expect(getPrice('creator', 'monthly')).toBe('price_creator_monthly_test');
    expect(getPrice('creator', 'yearly')).toBe('price_creator_yearly_test');
  });

  it('player/creator tier は unlimited_ai_questions を持つ', () => {
    expect(hasFeature('player', 'unlimited_ai_questions')).toBe(true);
    expect(hasFeature('creator', 'unlimited_ai_questions')).toBe(true);
    expect(hasFeature('free', 'unlimited_ai_questions')).toBe(false);
  });

  it('必須 env 未設定時に明確なエラーを返す', async () => {
    delete process.env.STRIPE_PRICE_PLAYER_MONTHLY;
    jest.resetModules();
    await expect(async () => {
      const mod = await import('@/lib/subscription-plans');
      mod.getPaidTierDefinitions();
    }).rejects.toThrow('Missing required environment variable: STRIPE_PRICE_PLAYER_MONTHLY');
  });
});

