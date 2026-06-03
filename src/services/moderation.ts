/**
 * モデレーションおよびメタデータ自治ガバナンスサービス
 *
 * 機能:
 * 1. flagContent      - コンテンツ通報とアトミックカウント更新・自動保留
 * 2. resolveFlag      - 管理者審査（公開復帰 / 永久削除）
 * マージ・ジャンル新設は TagMergeService (`tagMerge.ts`) に集約。
 *
 * Boundary: ModerationService (Task 2.8)
 * Requirements: 7.1, 7.2, 7.3
 */

import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { quizzesRef, usersRef } from '../lib/firebase/firestore';
import { Quiz, User } from '../types';
import { isSuspendThresholdReached } from './moderation-utils';

const flagsCollection = collection(db, 'flags');
const notificationsCollection = collection(db, 'notifications');

/* ==========================================================================
   コンテンツ通報
   ========================================================================== */

/**
 * コンテンツ（クイズ）を通報し、flagsCount をアトミックにインクリメントする。
 * 5回に達した場合は自動的に status を 'suspended' に変更する。
 *
 * @param quizId 通報対象のクイズID
 * @param reporterId 通報者のUID
 * @param reason 通報理由
 */
export async function flagContent(
  quizId: string,
  reporterId: string,
  reason: string
): Promise<void> {
  const quizDocRef = doc(quizzesRef, quizId);

  await runTransaction(db, async (transaction) => {
    const quizSnap = await transaction.get(quizDocRef);
    if (!quizSnap.exists()) throw new Error(`クイズが見つかりません: ${quizId}`);

    const quiz = quizSnap.data() as Quiz;
    const newFlagsCount = quiz.flagsCount + 1;

    // フラグを記録
    const flagRef = doc(flagsCollection, `${quizId}_${reporterId}`);
    transaction.set(flagRef, {
      quizId,
      reporterId,
      reason,
      createdAt: new Date(),
    });

    // flagsCount をインクリメント
    transaction.update(quizDocRef, { flagsCount: increment(1) });

    // 閾値到達で自動保留（非公開化）
    if (isSuspendThresholdReached(newFlagsCount)) {
      transaction.update(quizDocRef, { status: 'suspended' });
    }
  });
}

/**
 * 管理者による審査結果を反映する
 * @param quizId 審査対象のクイズID
 * @param action 'restore'（公開復帰） | 'delete'（永久削除）
 * @param executorId 審査を実行するユーザーのUID (多重防衛用)
 */
export async function resolveFlag(
  quizId: string,
  action: 'restore' | 'delete',
  executorId: string
): Promise<void> {
  // 実行者の権限をFirestoreから引き直して検証 (CISO防衛制限)
  const executorSnap = await getDoc(doc(usersRef, executorId));
  if (!executorSnap.exists()) {
    throw new Error('実行ユーザーが見つかりません');
  }
  const executor = executorSnap.data() as User;
  const isAuthorized = executor.moderationTier === 'senior_moderator' || (executor as any).role === 'admin';
  if (!isAuthorized) {
    throw new Error('この操作を実行する権限がありません (CISOセキュリティ制限)');
  }

  const quizDocRef = doc(quizzesRef, quizId);

  if (action === 'restore') {
    await updateDoc(quizDocRef, {
      status: 'published',
      flagsCount: 0,
      updatedAt: new Date(),
    });
  } else {
    const quizSnap = await getDoc(quizDocRef);
    if (quizSnap.exists()) {
      const quiz = quizSnap.data() as Quiz;
      // 作成者へ警告通知
      await addDoc(notificationsCollection, {
        recipientId: quiz.authorId,
        type: 'content_deleted',
        quizId,
        quizTitle: quiz.title,
        message: 'コミュニティガイドライン違反のため、コンテンツが削除されました。',
        isRead: false,
        createdAt: new Date(),
      });
    }
    await deleteDoc(quizDocRef);
  }
}

