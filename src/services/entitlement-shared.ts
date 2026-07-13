/**
 * entitlement-shared.ts
 *
 * ブラウザ・サーバー両方で使える純粋関数のみを定義します。
 * firebase-admin には依存しません。
 */
import { resolveSubscriptionTier } from '@/lib/subscription-plans';
import type {
  SubscriptionCapability,
  SubscriptionStatus,
  SubscriptionTier,
  UserEntitlements,
} from '@/types/subscription';
import type { User } from '@/types';

export interface EntitlementUserFields {
  subscriptionTier?: SubscriptionTier | null;
  subscriptionStatus?: SubscriptionStatus | null;
  currentPeriodEnd?: Date | { toDate(): Date } | string | null;
  isPremium?: boolean | null;
  moderationTier?: User['moderationTier'];
}

function toDate(value: EntitlementUserFields['currentPeriodEnd']): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

const PAID_ACTIVE_STATUSES: SubscriptionStatus[] = ['active', 'trialing'];

/**
 * tier ごとの capability 集合マップ（Phase 41）
 *
 * - player: 広告非表示 + AI質問無制限
 * - creator: player の全機能 + 限定公開 + AI作問アシスト
 * - premium: creator の全機能（将来拡張用）
 */
const TIER_CAPABILITIES: Record<Exclude<SubscriptionTier, 'free'>, readonly SubscriptionCapability[]> = {
  player: ['ad_free', 'unlimited_ai_questions'],
  creator: ['ad_free', 'unlimited_ai_questions', 'quiz_visibility_control', 'ai_authoring_assist'],
  premium: ['ad_free', 'unlimited_ai_questions', 'quiz_visibility_control', 'ai_authoring_assist'],
};

/**
 * 指定 tier が特定の capability を持つかどうかを判定する
 */
export function tierHasCapability(
  tier: SubscriptionTier,
  capability: SubscriptionCapability
): boolean {
  if (tier === 'free') return false;
  return TIER_CAPABILITIES[tier].includes(capability);
}

/** 有料 tier かどうか（free 以外はすべて有料） */
function isPaidTier(tier: SubscriptionTier): boolean {
  return tier !== 'free';
}

/** creator 以上の tier かどうか */
function isCreatorTier(tier: SubscriptionTier): boolean {
  return tier === 'creator' || tier === 'premium';
}

/**
 * Supabase ユーザーフィールドからエンタイトルメントを解釈する（純粋関数）
 * ブラウザ・サーバー両方から呼び出し可能です。
 */
export function computeUserEntitlements(
  fields: EntitlementUserFields
): UserEntitlements {
  const subscriptionTier = resolveSubscriptionTier(
    fields.subscriptionTier ?? undefined
  );
  const subscriptionStatus = fields.subscriptionStatus ?? null;
  const currentPeriodEnd = toDate(fields.currentPeriodEnd ?? null);

  const isActiveSubscription =
    subscriptionStatus !== null &&
    PAID_ACTIVE_STATUSES.includes(subscriptionStatus);

  const hasPaidEntitlements =
    isPaidTier(subscriptionTier) && isActiveSubscription;

  const hasCreatorEntitlements =
    isCreatorTier(subscriptionTier) && isActiveSubscription;

  const isModeratorExempt =
    fields.moderationTier === 'moderator' ||
    fields.moderationTier === 'senior_moderator';

  const hasUnlimitedAiQuestions = hasPaidEntitlements || isModeratorExempt;

  return {
    subscriptionTier,
    subscriptionStatus,
    currentPeriodEnd,
    hasPaidEntitlements,
    hasUnlimitedAiQuestions,
    hasCreatorEntitlements,
    isModerator: isModeratorExempt,
  };
}

