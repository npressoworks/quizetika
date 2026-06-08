import type { User } from '@/types';
import type { SubscriptionStatus, SubscriptionTier } from '@/types/subscription';

const PAID_ACTIVE_STATUSES: SubscriptionStatus[] = ['active', 'trialing'];

export type PricingUiCtaMode = 'guest' | 'subscribe' | 'manage' | 'loading';

export interface PricingUiState {
  ctaMode: PricingUiCtaMode;
  subscriptionTier: SubscriptionTier;
  hasPaidEntitlements: boolean;
  showProBadge: boolean;
}

function resolveSubscriptionTier(user: User | null): SubscriptionTier {
  return user?.subscriptionTier ?? 'free';
}

function computeHasPaidEntitlements(user: User | null): boolean {
  if (!user) return false;

  const subscriptionTier = user.subscriptionTier ?? 'free';
  const subscriptionStatus = user.subscriptionStatus ?? null;

  return (
    (subscriptionTier === 'pro' || subscriptionTier === 'premium') &&
    subscriptionStatus !== null &&
    PAID_ACTIVE_STATUSES.includes(subscriptionStatus)
  );
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
  return computeHasPaidEntitlements(user);
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
      showProBadge: false,
    };
  }

  if (!user) {
    return {
      ctaMode: 'guest',
      subscriptionTier: 'free',
      hasPaidEntitlements: false,
      showProBadge: false,
    };
  }

  const subscriptionTier = resolveSubscriptionTier(user);
  const hasPaidEntitlements = computeHasPaidEntitlements(user);

  if (hasPaidEntitlements) {
    return {
      ctaMode: 'manage',
      subscriptionTier,
      hasPaidEntitlements: true,
      showProBadge: true,
    };
  }

  return {
    ctaMode: 'subscribe',
    subscriptionTier,
    hasPaidEntitlements: false,
    showProBadge: false,
  };
}
