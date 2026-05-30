/**
 * モデレーションおよびメタデータ自治ガバナンスサービス
 *
 * 機能:
 * 1. flagContent      - コンテンツ通報とアトミックカウント更新・自動保留
 * 2. resolveFlag      - 管理者審査（公開復帰 / 永久削除）
 * 3. createMergeRequest - タグ/ジャンル仮想マージ提案
 * 4. voteOnMergeRequest - 重み付き投票
 * 5. submitGenreRequest - 新規ジャンル申請
 * 6. resolveGenreRequest - 可決/否決処理
 *
 * Boundary: ModerationService (Task 2.8)
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
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
import {
  isSuspendThresholdReached,
  calculateMergeVoteWeight,
  isGenreRequestApproved,
} from './moderation-utils';

const flagsCollection = collection(db, 'flags');
const mergeRequestsCollection = collection(db, 'mergeRequests');
const genreRequestsCollection = collection(db, 'genreRequests');
const metadataGenresCollection = collection(db, 'metadata_genres');
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

/* ==========================================================================
   タグ/ジャンル仮想マージ提案・投票
   ========================================================================== */

/**
 * 表記揺れタグ/ジャンルの仮想マージ提案を作成する
 */
export async function createMergeRequest(
  sourceId: string,
  targetId: string,
  type: 'tag' | 'genre',
  proposerId: string
): Promise<string> {
  const docRef = await addDoc(mergeRequestsCollection, {
    sourceId,
    targetId,
    type,
    proposerId,
    totalApproveWeight: 0,
    totalWeight: 0,
    status: 'open',
    createdAt: new Date(),
  });
  return docRef.id;
}

/**
 * マージ提案に重み付き投票する
 */
export async function voteOnMergeRequest(
  mergeRequestId: string,
  voterId: string,
  vote: 'approve' | 'reject'
): Promise<void> {
  const voterSnap = await getDoc(doc(usersRef, voterId));
  if (!voterSnap.exists()) throw new Error('投票者が見つかりません');

  const voter = voterSnap.data() as User;
  const weight = calculateMergeVoteWeight(voter.moderationTier);

  const mrRef = doc(mergeRequestsCollection, mergeRequestId);
  await updateDoc(mrRef, {
    totalWeight: increment(weight),
    ...(vote === 'approve' ? { totalApproveWeight: increment(weight) } : {}),
  });
}

/* ==========================================================================
   新規ジャンル申請・承認
   ========================================================================== */

/**
 * 新規ジャンル申請を送信する
 */
export async function submitGenreRequest(request: {
  genreId: string;
  displayName: string;
  iconUrl: string;
  requesterId: string;
}): Promise<string> {
  const docRef = await addDoc(genreRequestsCollection, {
    ...request,
    totalApproveWeight: 0,
    totalWeight: 0,
    status: 'pending',
    createdAt: new Date(),
  });
  return docRef.id;
}

/**
 * ジャンル申請を可決/否決する
 * 可決時は metadata_genres コレクションに自動登録する
 * @param genreRequestId ジャンル申請のドキュメントID
 * @param executorId 申請審査を実行するユーザーのUID (多重防衛用)
 */
export async function resolveGenreRequest(genreRequestId: string, executorId: string): Promise<void> {
  // 実行者の権限をFirestoreから引き直して検証 (CISO防衛制限)
  const executorSnap = await getDoc(doc(usersRef, executorId));
  if (!executorSnap.exists()) {
    throw new Error('実行ユーザーが見つかりません');
  }
  const executor = executorSnap.data() as User;
  const isAuthorized = ['contributor', 'moderator', 'senior_moderator'].includes(executor.moderationTier) || (executor as any).role === 'admin';
  if (!isAuthorized) {
    throw new Error('この操作を実行する権限がありません (CISOセキュリティ制限)');
  }

  const reqRef = doc(genreRequestsCollection, genreRequestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) throw new Error('申請が見つかりません');

  const req = reqSnap.data() as {
    genreId: string;
    displayName: string;
    iconUrl: string;
    requesterId: string;
    totalApproveWeight: number;
    totalWeight: number;
  };

  const approved = isGenreRequestApproved(req.totalApproveWeight, req.totalWeight);

  if (approved) {
    // ジャンルを自動登録・有効化
    await addDoc(metadataGenresCollection, {
      id: req.genreId,
      displayName: req.displayName,
      iconUrl: req.iconUrl,
      isEnabled: true,
      createdAt: new Date(),
    });
    await updateDoc(reqRef, { status: 'approved', resolvedAt: new Date() });
  } else {
    await updateDoc(reqRef, { status: 'rejected', resolvedAt: new Date() });
  }
}
