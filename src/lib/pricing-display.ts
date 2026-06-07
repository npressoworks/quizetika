import type { SubscriptionTier } from '@/types/subscription';

export interface PricingFeatureBullet {
  id: string;
  label: string;
}

export interface PricingPlanDisplay {
  tier: 'free' | 'pro';
  displayName: string;
  monthlyPriceLabel: string;
  yearlyPriceLabel?: string;
  yearlySavingsLabel?: string;
  featureBullets: readonly PricingFeatureBullet[];
}

export const PRICING_PLANS_DISPLAY: readonly PricingPlanDisplay[] = [
  {
    tier: 'free',
    displayName: 'Free',
    monthlyPriceLabel: '¥0',
    featureBullets: [
      {
        id: 'quiz_create_play',
        label: 'クイズの作成・プレイが無料で利用可能',
      },
      {
        id: 'limited_ai_questions',
        label: 'ウミガメAIへの質問は1日20回まで',
      },
    ],
  },
  {
    tier: 'pro',
    displayName: 'Pro',
    monthlyPriceLabel: '¥980/月',
    yearlyPriceLabel: '¥9,800/年',
    yearlySavingsLabel: '年額で約2ヶ月分お得',
    featureBullets: [
      {
        id: 'unlimited_ai_questions',
        label: 'ウミガメAIへの質問が1日20回制限なし',
      },
    ],
  },
] as const;

export function getPricingPlansForUi(): readonly PricingPlanDisplay[] {
  return PRICING_PLANS_DISPLAY;
}

export function getPricingPlanForUi(
  tier: Extract<SubscriptionTier, 'free' | 'pro'>
): PricingPlanDisplay {
  const plan = PRICING_PLANS_DISPLAY.find((entry) => entry.tier === tier);
  if (!plan) {
    throw new Error(`Pricing plan not found for tier: ${tier}`);
  }
  return plan;
}

export function getFreePlanForUi(): PricingPlanDisplay {
  return getPricingPlanForUi('free');
}

export function getProPlanForUi(): PricingPlanDisplay {
  return getPricingPlanForUi('pro');
}
