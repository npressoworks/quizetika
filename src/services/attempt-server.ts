import { getAdminFirestore } from '@/lib/firebase/admin';
import type { Attempt } from '@/types';

/**
 * サーバー専用: 本人の attempt を Admin SDK で取得する。
 * Firestore Rules は attempts の read に認証を要求するため、RSC ではクライアント SDK 不可。
 */
export async function getAttemptByIdForUser(
  attemptId: string,
  userId: string
): Promise<Attempt | null> {
  const db = getAdminFirestore();
  const snap = await db.collection('attempts').doc(attemptId).get();

  if (!snap.exists) {
    return null;
  }

  const data = snap.data()!;
  if (data.userId !== userId) {
    return null;
  }

  const completedAt = data.completedAt?.toDate
    ? data.completedAt.toDate()
    : new Date(data.completedAt);

  return { ...data, id: snap.id, completedAt } as Attempt;
}
