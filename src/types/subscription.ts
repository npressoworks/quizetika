/**
 * サブスクリプション契約 tier（Phase 14）
 */
export type SubscriptionTier = 'free' | 'pro' | 'premium';

/**
 * Stripe サブスクリプション状態
 */
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid'
  | 'paused';

export type PriceInterval = 'monthly' | 'yearly';

export interface UserEntitlements {
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  hasPaidEntitlements: boolean;
  hasUnlimitedAiQuestions: boolean;
}

export interface StripeSubscriptionSnapshot {
  firebaseUid: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionTier: SubscriptionTier;
  currentPeriodEnd: Date | null;
  isPremium: boolean;
}
