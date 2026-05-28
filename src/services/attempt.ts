/**
 * プレイ履歴（Attempt）Firestore 永続化サービス
 *
 * 機能:
 * 1. saveAttempt    - プレイ結果を Firestore の attempts コレクションに保存
 * 2. syncPendingAttempts - localStorage の未同期データをオンライン復帰時に一括同期
 *
 * Boundary: AttemptService (Task 2.3)
 * Requirements: 3.1, 3.3, 5.5
 */

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { quizzesRef } from '../lib/firebase/firestore';
import { Attempt } from '../types';
import {
  getPendingSyncAttempts,
  clearPendingSyncAttempt,
  PendingSyncAttempt,
} from './attempt-session';

/** Firestore の attempts コレクション参照（型コンバーターなしで直接使用） */
const attemptsCollection = collection(db, 'attempts');

/* ==========================================================================
   Attempt 保存
   ========================================================================== */

/**
 * プレイ結果を Firestore に保存する。
 * 同時に:
 * - quizzes/{quizId}.playCount をインクリメント
 * - パーフェクトスコア時はリーダーボードを更新
 *
 * @param attemptData 保存するプレイ結果データ（id と completedAt を除く）
 * @returns 作成された Attempt ドキュメントID
 */
export async function saveAttempt(
  attemptData: Omit<Attempt, 'id' | 'completedAt'>
): Promise<string> {
  const completedAt = new Date();

  const payload: Omit<Attempt, 'id'> = {
    ...attemptData,
    completedAt,
  };

  // Firestore にプレイ履歴を保存
  const docRef = await addDoc(attemptsCollection, payload);

  // クイズのプレイ回数をインクリメント（非同期で実行）
  const quizDocRef = doc(quizzesRef, attemptData.quizId);
  updateDoc(quizDocRef, { playCount: increment(1) }).catch((e) =>
    console.warn('[AttemptService] playCount インクリメントに失敗:', e)
  );

  // パーフェクトスコア時はリーダーボードにエントリを追加
  if (attemptData.score === attemptData.totalQuestions) {
    const leaderboardEntry = {
      userId: attemptData.userId,
      displayName: '', // 呼び出し元で非正規化した名前を設定
      score: attemptData.score,
      elapsedSeconds: attemptData.elapsedSeconds,
      completedAt,
    };
    updateDoc(quizDocRef, {
      leaderboard: arrayUnion(leaderboardEntry),
    }).catch((e) => console.warn('[AttemptService] リーダーボード更新に失敗:', e));
  }

  return docRef.id;
}

/* ==========================================================================
   ユーザーの間違い問題記録更新
   ========================================================================== */

/**
 * ユーザーの totalFailedQuestionsCount を更新する
 * （プレイ後に未復習問題数を正確に反映するために呼び出す）
 *
 * @param uid ユーザーID
 * @param delta 増減値（正: 増加、負: 減少）
 */
export async function updateFailedQuestionsCount(uid: string, delta: number): Promise<void> {
  if (delta === 0) return;
  const { usersRef } = await import('../lib/firebase/firestore');
  const userDocRef = doc(usersRef, uid);
  await updateDoc(userDocRef, {
    totalFailedQuestionsCount: increment(delta),
    updatedAt: new Date(),
  });
}

/* ==========================================================================
   オフライン未同期データの Firestore バッチ同期
   ========================================================================== */

/**
 * localStorage に退避された未同期 Attempt を Firestore に一括送信する。
 * ネットワーク復帰時（online イベント等）に呼び出すことを想定。
 *
 * @returns 同期に成功した件数
 */
export async function syncPendingAttempts(): Promise<number> {
  const pending = getPendingSyncAttempts();
  if (pending.length === 0) return 0;

  let successCount = 0;

  for (const pendingAttempt of pending) {
    try {
      const attempt = pendingSyncToAttempt(pendingAttempt);
      await addDoc(attemptsCollection, attempt);
      // 同期成功したものをキューから除去
      clearPendingSyncAttempt(pendingAttempt.localId);
      successCount++;
    } catch (e) {
      // 個別失敗は次の同期機会に再試行するためスキップ
      console.warn(`[AttemptService] 未同期データの同期に失敗 (localId=${pendingAttempt.localId}):`, e);
    }
  }

  return successCount;
}

/**
 * PendingSyncAttempt を Attempt オブジェクト（Firestore 保存用）に変換する
 */
function pendingSyncToAttempt(pending: PendingSyncAttempt): Omit<Attempt, 'id'> {
  return {
    userId: pending.userId,
    quizId: pending.quizId,
    listId: pending.listId,
    mode: pending.mode,
    score: pending.score,
    totalQuestions: pending.totalQuestions,
    elapsedSeconds: pending.elapsedSeconds,
    failedQuestionIds: pending.failedQuestionIds,
    difficultyVote: pending.difficultyVote ?? null,
    aiTurnCount: pending.aiTurnCount,
    aiTurnLimit: pending.aiTurnLimit,
    completedAt: new Date(pending.completedAt),
  };
}
