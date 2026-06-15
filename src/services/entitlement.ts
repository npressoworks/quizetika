/**
 * entitlement.ts
 *
 * サーバー専用モジュール（firebase-admin 依存）。
 * ブラウザコンポーネントから直接インポートしないでください。
 *
 * ブラウザ・サーバー両対応の純粋関数は entitlement-shared.ts を使用してください。
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';
import type { StripeSubscriptionSnapshot } from '@/types/subscription';

// 純粋関数・型は shared から re-export（後方互換）
export type { EntitlementUserFields } from './entitlement-shared';
export { computeUserEntitlements } from './entitlement-shared';

/**
 * サーバー側: UID から最新エンタイトルメントを解決する
 */
export async function resolveUserEntitlements(
  uid: string
): Promise<import('@/types/subscription').UserEntitlements> {
  const { computeUserEntitlements: compute } = await import('./entitlement-shared');
  const db = getAdminFirestore();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) {
    return compute({});
  }
  const data = snap.data() as import('./entitlement-shared').EntitlementUserFields;
  return compute(data);
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
