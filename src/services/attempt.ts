import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  runTransaction,
  increment,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { quizzesRef, usersRef } from '../lib/firebase/firestore';
import { Attempt, Quiz, Question } from '../types';
import {
  getPendingSyncAttempts,
  clearPendingSyncAttempt,
  PendingSyncAttempt,
} from './attempt-session';

const attemptsCollection = collection(db, 'attempts');

/* ==========================================================================
   Attempt 保存
   ========================================================================== */

/**
 * プレイ結果を Firestore に保存する。
 * アトミックなトランザクション内で、attemptsへのレコード追加、
 * プレイ回数加算、パーフェクト時のリーダーボード更新をすべて行う。
 */
export async function saveAttempt(
  attemptData: Omit<Attempt, 'id' | 'completedAt'>
): Promise<string> {
  const completedAt = new Date();
  const attemptDocRef = doc(attemptsCollection);

  const payload: Omit<Attempt, 'id'> = {
    ...attemptData,
    listId: attemptData.listId ?? null, // undefined は Firestore がエラーを吐くため、ここで null に変換
    completedAt,
  };

  const quizDocRef = doc(quizzesRef, attemptData.quizId);

  await runTransaction(db, async (transaction) => {
    const quizSnap = await transaction.get(quizDocRef);
    if (!quizSnap.exists()) {
      throw new Error(`クイズが見つかりません: ${attemptData.quizId}`);
    }

    const quiz = quizSnap.data() as Quiz;

    // ── セキュリティ対策（チート防止のためのサーバーサイド二重検証） ──
    const actualTotalQuestions = quiz.questions?.length ?? 0;
    if (attemptData.totalQuestions !== actualTotalQuestions) {
      throw new Error(`問題数の不整合が検知されました。期待される問題数: ${actualTotalQuestions}, 送信された問題数: ${attemptData.totalQuestions}`);
    }

    // 送信された間違えた問題IDがすべて該当クイズに存在するか検証
    const quizQuestionIds = new Set((quiz.questions ?? []).map((q) => q.id));
    for (const failedId of attemptData.failedQuestionIds) {
      if (!quizQuestionIds.has(failedId)) {
        throw new Error(`該当クイズに存在しない不正な問題IDが解答履歴に含まれています: ${failedId}`);
      }
    }

    // 計算上の正解数と送信されたスコア（score）が合致するか検証
    const calculatedScore = actualTotalQuestions - attemptData.failedQuestionIds.length;
    if (attemptData.score !== calculatedScore) {
      throw new Error(`スコアデータの不整合が検知されました。計算スコア: ${calculatedScore}, 送信スコア: ${attemptData.score}`);
    }
    // ───────────────────────────────────────────────────────────────

    // トランザクション内で最新のユーザーのdisplayNameを取得 (ゲストでない場合)
    let displayName = 'ゲストプレイヤー';
    if (attemptData.userId && attemptData.userId !== 'guest') {
      const userDocRef = doc(usersRef, attemptData.userId);
      const userSnap = await transaction.get(userDocRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        displayName = userData.displayName || '名無しさん';
      }
    }

    // attempt の追加
    transaction.set(attemptDocRef, payload);

    const quizUpdates: Record<string, any> = {
      playCount: increment(1),
      updatedAt: completedAt,
    };

    // パーフェクトスコア時はリーダーボードにエントリを追加
    if (attemptData.score === attemptData.totalQuestions) {
      const leaderboardEntry = {
        userId: attemptData.userId,
        displayName: displayName, // 取得したユーザー名を設定
        score: attemptData.score,
        elapsedSeconds: attemptData.elapsedSeconds,
        completedAt,
      };

      // クイズ内のリーダーボード配列を更新
      const newLeaderboard = [...(quiz.leaderboard ?? [])];
      newLeaderboard.push(leaderboardEntry);
      newLeaderboard.sort((a, b) => b.score - a.score || a.elapsedSeconds - b.elapsedSeconds);
      // 上位5名にスライス
      quizUpdates.leaderboard = newLeaderboard.slice(0, 5);
    }

    transaction.update(quizDocRef, quizUpdates);
  });

  return attemptDocRef.id;
}

/* ==========================================================================
   弱点克服プレイ (復習) 用メソッド
   ========================================================================== */

/**
 * 過去に自身が間違えた設問配列のみを抽出し、復習用データとして提供する。
 *
 * @param userId ユーザーID
 * @param quizId クイズID（指定された場合、そのクイズ内の間違いに絞る）
 * @param genreFilter ジャンル名（指定された場合、そのジャンルに属するクイズの間違いに絞る）
 */
export async function getFailedQuestions(
  userId: string,
  quizId?: string,
  genreFilter?: string | null
): Promise<Question[]> {
  // 1. ユーザーの過去の attempts を取得
  let attemptsQuery = query(attemptsCollection, where('userId', '==', userId));
  if (quizId) {
    attemptsQuery = query(attemptsQuery, where('quizId', '==', quizId));
  }
  const attemptsSnap = await getDocs(attemptsQuery);

  // 間違えた問題IDの重複排除セットを作成
  const failedIds = new Set<string>();
  const quizIdToFailedIds: Record<string, string[]> = {};

  attemptsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Attempt;
    if (data.failedQuestionIds && data.failedQuestionIds.length > 0) {
      if (!quizIdToFailedIds[data.quizId]) {
        quizIdToFailedIds[data.quizId] = [];
      }
      data.failedQuestionIds.forEach((qId) => {
        failedIds.add(qId);
        if (!quizIdToFailedIds[data.quizId].includes(qId)) {
          quizIdToFailedIds[data.quizId].push(qId);
        }
      });
    }
  });

  if (failedIds.size === 0) return [];

  // 2. 対象となるクイズデータをまとめてフェッチし、問題オブジェクトを抽出する
  const failedQuestions: Question[] = [];

  for (const qId of Object.keys(quizIdToFailedIds)) {
    const quizDocRef = doc(quizzesRef, qId);
    const quizSnap = await getDoc(quizDocRef);

    if (quizSnap.exists()) {
      const quiz = quizSnap.data() as Quiz;
      // ジャンルフィルタのチェック
      if (genreFilter && genreFilter !== 'all' && quiz.genre !== genreFilter) {
        continue;
      }

      const qIds = quizIdToFailedIds[qId];
      quiz.questions.forEach((q) => {
        if (qIds.includes(q.id)) {
          // クライアント側で一括削除のために逆引きできるように quizId を注入
          (q as any).quizId = qId;
          failedQuestions.push(q);
        }
      });
    }
  }

  return failedQuestions;
}

/**
 * 復習プレイで正解した設問を、ユーザーの過去の間違いリストからアトミックに削除する。
 * 同時に、users.totalFailedQuestionsCount もアトミックに減算する。
 */
export async function updateFailedQuestions(
  userId: string,
  quizId: string,
  solvedQuestionIds: string[]
): Promise<void> {
  if (solvedQuestionIds.length === 0) return;

  const userDocRef = doc(usersRef, userId);

  // 過去の該当クイズの attempts をすべて走査して、failedQuestionIds からアトミックに正解した問題を除去
  const attemptsQuery = query(
    attemptsCollection,
    where('userId', '==', userId),
    where('quizId', '==', quizId)
  );
  const attemptsSnap = await getDocs(attemptsQuery);

  await runTransaction(db, async (transaction) => {
    // 1. 各 attempts の failedQuestionIds から solvedQuestionIds を除去
    attemptsSnap.docs.forEach((docSnap) => {
      transaction.update(docSnap.ref, {
        failedQuestionIds: arrayRemove(...solvedQuestionIds),
      });
    });

    // 2. ユーザーの totalFailedQuestionsCount を減算
    transaction.update(userDocRef, {
      totalFailedQuestionsCount: increment(-solvedQuestionIds.length),
      updatedAt: new Date(),
    });
  });
}

/**
 * ユーザーの totalFailedQuestionsCount を更新する（既存スタブ）
 */
export async function updateFailedQuestionsCount(uid: string, delta: number): Promise<void> {
  if (delta === 0) return;
  const userDocRef = doc(usersRef, uid);
  await updateDoc(userDocRef, {
    totalFailedQuestionsCount: increment(delta),
    updatedAt: new Date(),
  });
}

/* ==========================================================================
   オフライン未同期データの Firestore バッチ同期
   ========================================================================== */

export async function syncPendingAttempts(): Promise<number> {
  const pending = getPendingSyncAttempts();
  if (pending.length === 0) return 0;

  let successCount = 0;

  for (const pendingAttempt of pending) {
    try {
      const attempt = pendingSyncToAttempt(pendingAttempt);
      await saveAttempt(attempt); // トランザクション版を呼び出して同期
      clearPendingSyncAttempt(pendingAttempt.localId);
      successCount++;
    } catch (e) {
      console.warn(`[AttemptService] 未同期データの同期に失敗 (localId=${pendingAttempt.localId}):`, e);
    }
  }

  return successCount;
}

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
    questionAnswers: pending.questionAnswers,
    difficultyVote: pending.difficultyVote ?? null,
    aiTurnCount: pending.aiTurnCount,
    aiTurnLimit: pending.aiTurnLimit,
    completedAt: new Date(pending.completedAt),
  };
}
