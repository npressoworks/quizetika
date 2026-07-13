import { computeUserEntitlements } from '@/services/entitlement-shared';
import type { User } from '@/types';
import type { SubscriptionStatus, SubscriptionTier } from '@/types/subscription';

export type PricingUiCtaMode = 'guest' | 'subscribe' | 'manage' | 'loading';

export interface PricingUiState {
  ctaMode: PricingUiCtaMode;
  subscriptionTier: SubscriptionTier;
  hasPaidEntitlements: boolean;
}

function computeUserEntitlementsForUser(user: User | null) {
  // E2Eテスト用のモック判定
  if (typeof window !== 'undefined') {
    try {
      const e2eMock = window.localStorage.getItem('e2e-mock-pro-user');
      if (e2eMock) {
        const parsed = JSON.parse(e2eMock);
        if (
          (parsed.subscriptionTier === 'pro' ||
            parsed.subscriptionTier === 'player' ||
            parsed.subscriptionTier === 'creator' ||
            parsed.subscriptionTier === 'premium') &&
          parsed.subscriptionStatus === 'active'
        ) {
          return {
            subscriptionTier: (parsed.subscriptionTier === 'pro' ? 'creator' : parsed.subscriptionTier) as SubscriptionTier,
            subscriptionStatus: parsed.subscriptionStatus as SubscriptionStatus,
            currentPeriodEnd: null,
            hasPaidEntitlements: true,
            hasUnlimitedAiQuestions: true,
            hasCreatorEntitlements: true,
            isModerator: false,
          };
        }
      }
    } catch (e) {
      // 解析エラーは無視して通常の判定にフォールバック
    }
  }

  if (!user) {
    return {
      subscriptionTier: 'free' as SubscriptionTier,
      subscriptionStatus: null as SubscriptionStatus | null,
      currentPeriodEnd: null as Date | null,
      hasPaidEntitlements: false,
      hasUnlimitedAiQuestions: false,
      hasCreatorEntitlements: false,
      isModerator: false,
    };
  }

  return computeUserEntitlements({
    subscriptionTier: user.subscriptionTier,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
    moderationTier: user.moderationTier,
  });
}

/** Pro 限定公開範囲（private / followers）の設定可否（クライアント表示用。正本は quiz-access + Rules） */
export function hasProVisibilityEntitlementsForUser(user: User | null): boolean {
  if (!user) return false;
  if (
    user.moderationTier === 'moderator' ||
    user.moderationTier === 'senior_moderator'
  ) {
    return true;
  }
  return computeUserEntitlementsForUser(user).hasCreatorEntitlements;
}

/** 水平思考 AI 質問の無制限可否（クライアント表示用。制限判定の正本はサーバー） */
export function hasUnlimitedAiQuestionsForUser(user: User | null): boolean {
  if (!user) return false;
  if (
    user.moderationTier === 'moderator' ||
    user.moderationTier === 'senior_moderator'
  ) {
    return true;
  }
  return computeUserEntitlementsForUser(user).hasUnlimitedAiQuestions;
}

export function resolvePricingUiState(
  user: User | null,
  authLoading: boolean
): PricingUiState {
  if (authLoading) {
    return {
      ctaMode: 'loading',
      subscriptionTier: 'free',
      hasPaidEntitlements: false,
    };
  }

  if (!user) {
    return {
      ctaMode: 'guest',
      subscriptionTier: 'free',
      hasPaidEntitlements: false,
    };
  }

  const entitlements = computeUserEntitlementsForUser(user);
  const subscriptionTier = entitlements.subscriptionTier;
  const hasPaidEntitlements = entitlements.hasPaidEntitlements;

  if (hasPaidEntitlements) {
    return {
      ctaMode: 'manage',
      subscriptionTier,
      hasPaidEntitlements: true,
    };
  }

  return {
    ctaMode: 'subscribe',
    subscriptionTier,
    hasPaidEntitlements: false,
  };
}
