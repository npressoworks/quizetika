process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly_test';
process.env.STRIPE_PRICE_PRO_YEARLY = 'price_yearly_test';

import { hasFeature, resolveSubscriptionTier } from '@/lib/subscription-plans';

describe('subscription-plans', () => {
  const originalMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const originalYearly = process.env.STRIPE_PRICE_PRO_YEARLY;

  beforeEach(() => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly_test';
    process.env.STRIPE_PRICE_PRO_YEARLY = 'price_yearly_test';
    jest.resetModules();
  });

  afterEach(() => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = originalMonthly;
    process.env.STRIPE_PRICE_PRO_YEARLY = originalYearly;
  });

  it('未設定 subscriptionTier は free として解釈する', () => {
    expect(resolveSubscriptionTier(undefined)).toBe('free');
    expect(resolveSubscriptionTier(null)).toBe('free');
  });

  it('Pro の Price ID から pro tier を解決する', async () => {
    const { priceIdToTier: resolve } = await import('@/lib/subscription-plans');
    expect(resolve('price_monthly_test')).toBe('pro');
    expect(resolve('price_yearly_test')).toBe('pro');
    expect(resolve('price_unknown')).toBeNull();
  });

  it('interval から Price ID を取得する', async () => {
    const { getPriceIdForInterval: getPrice } = await import('@/lib/subscription-plans');
    expect(getPrice('monthly')).toBe('price_monthly_test');
    expect(getPrice('yearly')).toBe('price_yearly_test');
  });

  it('Pro tier は unlimited_ai_questions を持つ', () => {
    expect(hasFeature('pro', 'unlimited_ai_questions')).toBe(true);
    expect(hasFeature('free', 'unlimited_ai_questions')).toBe(false);
  });

  it('必須 env 未設定時に明確なエラーを返す', async () => {
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    jest.resetModules();
    await expect(async () => {
      const mod = await import('@/lib/subscription-plans');
      mod.getPaidTierDefinitions();
    }).rejects.toThrow('Missing required environment variable: STRIPE_PRICE_PRO_MONTHLY');
  });
});
