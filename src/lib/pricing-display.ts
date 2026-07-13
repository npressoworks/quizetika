import type { SubscriptionTier } from '@/types/subscription';

export interface PricingFeatureBullet {
  id: string;
  label: string;
}

export interface PricingPlanDisplay {
  tier: 'free' | 'player' | 'creator';
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
    tier: 'player',
    displayName: 'Player',
    featureBullets: [
      {
        id: 'unlimited_ai_questions',
        label: 'ウミガメAIへの質問が日次制限なし',
      },
      {
        id: 'ad_free',
        label: '広告非表示',
      },
    ],
  },
  {
    tier: 'creator',
    displayName: 'Creator',
    featureBullets: [
      {
        id: 'unlimited_ai_questions',
        label: 'ウミガメAIへの質問が日次制限なし',
      },
      {
        id: 'ad_free',
        label: '広告非表示',
      },
      {
        id: 'quiz_visibility_control',
        label: 'クイズの限定公開（非公開・フォロワー限定など）',
      },
      {
        id: 'ai_quiz_authoring',
        label: 'AI作問アシスタント（AI作問・サムネイル自動生成）',
      },
    ],
  },
] as const;

export function getPricingPlansForUi(): readonly PricingPlanDisplay[] {
  return PRICING_PLANS_DISPLAY;
}

export function getPricingPlanForUi(
  tier: 'free' | 'player' | 'creator'
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
