import {
  getFreePlanForUi,
  getPricingPlansForUi,
  getProPlanForUi,
} from '@/lib/pricing-display';

describe('pricing-display', () => {
  test('getPricingPlansForUi: Free と Pro の 2 件を返す', () => {
    const plans = getPricingPlansForUi();
    expect(plans).toHaveLength(2);
    expect(plans[0].tier).toBe('free');
    expect(plans[1].tier).toBe('pro');
  });

  test('getFreePlanForUi: 無料プランの表示情報', () => {
    const plan = getFreePlanForUi();
    expect(plan.displayName).toBe('Free');
    expect(plan.monthlyPriceLabel).toBe('¥0');
    expect(plan.featureBullets.some((f) => f.id === 'limited_ai_questions')).toBe(true);
  });

  test('getProPlanForUi: 月額・年額ラベルと特典 bullet を含む', () => {
    const plan = getProPlanForUi();
    expect(plan.displayName).toBe('Pro');
    expect(plan.monthlyPriceLabel).toMatch(/¥/);
    expect(plan.yearlyPriceLabel).toMatch(/¥/);
    expect(plan.featureBullets.length).toBeGreaterThanOrEqual(1);
    expect(plan.featureBullets[0].id).toBe('unlimited_ai_questions');
  });
});
