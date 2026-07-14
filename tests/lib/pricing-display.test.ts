import {
  getFreePlanForUi,
  getPricingPlansForUi,
  getPricingPlanForUi,
} from '@/lib/pricing-display';

describe('pricing-display', () => {
  test('getPricingPlansForUi: Free, Player, Creator の 3 件を返す', () => {
    const plans = getPricingPlansForUi();
    expect(plans).toHaveLength(3);
    expect(plans[0].tier).toBe('free');
    expect(plans[1].tier).toBe('player');
    expect(plans[2].tier).toBe('creator');
  });

  test('getFreePlanForUi: 無料プランの表示情報', () => {
    const plan = getFreePlanForUi();
    expect(plan.displayName).toBe('Free');
    const limited = plan.featureBullets.find((f) => f.id === 'limited_ai_questions');
    expect(limited).toBeDefined();
    expect(limited?.label).toContain('30回');
    expect(limited?.label).toContain('150回');

    const adEnabled = plan.featureBullets.find((f) => f.id === 'ad_enabled');
    expect(adEnabled).toBeDefined();
    expect(adEnabled?.label).toBe('広告表示あり');
  });

  test('getPricingPlanForUi: Player プランの表示情報', () => {
    const plan = getPricingPlanForUi('player');
    expect(plan.displayName).toBe('Player');
    expect(plan.featureBullets).toHaveLength(2);
    expect(plan.featureBullets[0].id).toBe('unlimited_ai_questions');
    expect(plan.featureBullets[1].id).toBe('ad_free');
  });

  test('getPricingPlanForUi: Creator プランの表示情報', () => {
    const plan = getPricingPlanForUi('creator');
    expect(plan.displayName).toBe('Creator');
    expect(plan.featureBullets).toHaveLength(4);
    expect(plan.featureBullets[0].id).toBe('unlimited_ai_questions');
    expect(plan.featureBullets[1].id).toBe('ad_free');
    expect(plan.featureBullets[2].id).toBe('quiz_visibility_control');
    expect(plan.featureBullets[3].id).toBe('ai_quiz_authoring');
  });
});
