import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { resolveSubscriptionTier } from '@/lib/subscription-plans';
import type {
  StripeSubscriptionSnapshot,
  SubscriptionStatus,
  SubscriptionTier,
  UserEntitlements,
} from '@/types/subscription';
import type { User } from '@/types';

const PAID_ACTIVE_STATUSES: SubscriptionStatus[] = ['active', 'trialing'];

export interface EntitlementUserFields {
  subscriptionTier?: SubscriptionTier | null;
  subscriptionStatus?: SubscriptionStatus | null;
  currentPeriodEnd?: Date | { toDate(): Date } | null;
  isPremium?: boolean | null;
  moderationTier?: User['moderationTier'];
}

function toDate(value: EntitlementUserFields['currentPeriodEnd']): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/**
 * Firestore ユーザーフィールドからエンタイトルメントを解釈する（純粋関数）
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

/**
 * サーバー側: UID から最新エンタイトルメントを解決する
 */
export async function resolveUserEntitlements(uid: string): Promise<UserEntitlements> {
  const db = getAdminFirestore();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) {
    return computeUserEntitlements({});
  }
  const data = snap.data() as EntitlementUserFields;
  return computeUserEntitlements(data);
}

/**
 * Stripe サブスクリプションイベントから users 課金フィールドを同期する（Admin SDK）
 */
export async function applySubscriptionFromStripe(
  snapshot: StripeSubscriptionSnapshot
): Promise<void> {
  const db = getAdminFirestore();
  const userRef = db.collection('users').doc(snapshot.firebaseUid);

  const update: Record<string, unknown> = {
    subscriptionTier: snapshot.subscriptionTier,
    subscriptionStatus: snapshot.subscriptionStatus,
    stripeCustomerId: snapshot.stripeCustomerId,
    stripeSubscriptionId: snapshot.stripeSubscriptionId,
    isPremium: snapshot.isPremium,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (snapshot.currentPeriodEnd) {
    update.currentPeriodEnd = Timestamp.fromDate(snapshot.currentPeriodEnd);
  } else {
    update.currentPeriodEnd = FieldValue.delete();
  }

  await userRef.set(update, { merge: true });
}

/**
 * 契約失効時に free tier へ戻す
 */
export async function clearPaidEntitlements(
  firebaseUid: string,
  stripeCustomerId: string
): Promise<void> {
  await applySubscriptionFromStripe({
    firebaseUid,
    stripeCustomerId,
    stripeSubscriptionId: null,
    subscriptionStatus: 'canceled',
    subscriptionTier: 'free',
    currentPeriodEnd: null,
    isPremium: false,
  });
}
