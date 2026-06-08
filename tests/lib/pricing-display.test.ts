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
    const limited = plan.featureBullets.find((f) => f.id === 'limited_ai_questions');
    expect(limited).toBeDefined();
    expect(limited?.label).toContain('30回');
    expect(limited?.label).toContain('150回');
    expect('monthlyPriceLabel' in plan).toBe(false);
  });

  test('getProPlanForUi: 特典 bullet を含み価格フィールドは持たない', () => {
    const plan = getProPlanForUi();
    expect(plan.displayName).toBe('Pro');
    expect(plan.featureBullets.length).toBeGreaterThanOrEqual(1);
    expect(plan.featureBullets[0].id).toBe('unlimited_ai_questions');
    expect('monthlyPriceLabel' in plan).toBe(false);
    expect('yearlyPriceLabel' in plan).toBe(false);
  });
});
