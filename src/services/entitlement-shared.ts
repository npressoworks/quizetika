/**
 * entitlement-shared.ts
 *
 * ブラウザ・サーバー両方で使える純粋関数のみを定義します。
 * firebase-admin には依存しません。
 */
import { resolveSubscriptionTier } from '@/lib/subscription-plans';
import type {
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

  const hasPaidEntitlements =
    (subscriptionTier === 'pro' || subscriptionTier === 'premium') &&
    subscriptionStatus !== null &&
    PAID_ACTIVE_STATUSES.includes(subscriptionStatus);

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
  };
}
