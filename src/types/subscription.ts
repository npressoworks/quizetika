/**
 * サブスクリプション契約 tier（Phase 41: player/creator 追加）
 */
export type SubscriptionTier = 'free' | 'player' | 'creator' | 'premium';

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

/**
 * サブスクリプション機能権限（Phase 41）
 */
export type SubscriptionCapability =
  | 'ad_free'
  | 'unlimited_ai_questions'
  | 'quiz_visibility_control'
  | 'ai_authoring_assist';

export interface UserEntitlements {
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  hasPaidEntitlements: boolean;
  hasUnlimitedAiQuestions: boolean;
  /** creator/premium かつ有効契約のときのみ true（限定公開・AI作問アシスト） */
  hasCreatorEntitlements: boolean;
  /** モデレーターまたはシニアモデレーターの場合に true */
  isModerator: boolean;
}

export interface StripeSubscriptionSnapshot {
  uid: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionTier: SubscriptionTier;
  currentPeriodEnd: Date | null;
  isPremium: boolean;
}

