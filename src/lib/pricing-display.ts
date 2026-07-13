import type { SubscriptionTier } from '@/types/subscription';

export interface PricingFeatureBullet {
  id: string;
  label: string;
}

export interface PricingPlanDisplay {
  tier: 'free' | 'pro' | 'player' | 'creator';
  displayName: string;
  featureBullets: readonly PricingFeatureBullet[];
}

export const PRICING_PLANS_DISPLAY: readonly PricingPlanDisplay[] = [
  {
    tier: 'free',
    displayName: 'Free',
    featureBullets: [
      {
        id: 'quiz_create_play',
        label: 'クイズの作成・プレイが無料で利用可能',
      },
      {
        id: 'limited_ai_questions',
        label: 'ウミガメAIへの質問は同一クイズ30回/日・全クイズ横断150回/日まで',
      },
    ],
  },
  {
    tier: 'pro',
    displayName: 'Pro',
    featureBullets: [
      {
        id: 'unlimited_ai_questions',
        label: 'ウミガメAIへの質問が日次制限なし',
      },
      {
        id: 'ai_quiz_authoring',
        label: 'AI 作問（1日100回）・サムネイル AI 生成（1日20回）',
      },
    ],
  },
] as const;

export function getPricingPlansForUi(): readonly PricingPlanDisplay[] {
  return PRICING_PLANS_DISPLAY;
}

export function getPricingPlanForUi(
  tier: 'free' | 'pro' | 'player' | 'creator'
): PricingPlanDisplay {
  const planTier = tier === 'creator' || tier === 'player' ? 'pro' : tier;
  const plan = PRICING_PLANS_DISPLAY.find((entry) => entry.tier === planTier);
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

