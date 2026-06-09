import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { expandGenreIdsForQuery, quizMatchesGenreFilter } from '../lib/metadata-resolution';
import { quizzesRef, usersRef } from '../lib/firebase/firestore';
import {
  Attempt,
  Quiz,
  Question,
  PlayHistoryPage,
  PlayHistoryEntry,
  satisfiesMyQuizAttemptContract,
  satisfiesQuestionListAttemptContract,
} from '../types';
import {
  buildLeaderboardUpdatesForQuiz,
  isLeaderboardEligibleAttempt,
} from '../lib/leaderboard-update';

/** 新規 attempt 保存前: 同一 user+quiz の完了済み件数 */
async function countPriorCompletedAttempts(
  userId: string,
  quizId: string,
  excludeAttemptId?: string
): Promise<number> {
  const snap = await getDocs(
    query(
      attemptsCollection,
      where('userId', '==', userId),
      where('quizId', '==', quizId)
    )
  );

  return snap.docs.filter((d) => {
    if (excludeAttemptId && d.id === excludeAttemptId) return false;
    const data = d.data() as Attempt;
    return data.completedAt != null;
  }).length;
}
import {
  getPendingSyncAttempts,
  clearPendingSyncAttempt,
  PendingSyncAttempt,
} from './attempt-session';

const attemptsCollection = collection(db, 'attempts');

function isSingleQuestionAttemptMode(mode: Attempt['mode']): boolean {
  return mode === 'question-list' || mode === 'my-quiz';
}

/* ==========================================================================
   Attempt 保存
   ========================================================================== */

/**
 * プレイ結果を Firestore に保存する。
 * アトミックなトランザクション内で、attemptsへのレコード追加、
 * プレイ回数加算、初回／リプレイリーダーボード更新をすべて行う。
 */
export async function saveAttempt(
  attemptData: Omit<Attempt, 'id' | 'completedAt'>
): Promise<string> {
  const completedAt = new Date();
  const attemptDocRef = doc(attemptsCollection);

  const priorCompletedCount = isLeaderboardEligibleAttempt(attemptData)
    ? await countPriorCompletedAttempts(attemptData.userId, attemptData.quizId)
    : 0;

  const payload: Omit<Attempt, 'id'> = {
    ...attemptData,
    listId: attemptData.listId ?? null, // undefined は Firestore がエラーを吐くため、ここで null に変換
    sessionId: attemptData.sessionId ?? null,
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
    const quizQuestionIds = new Set((quiz.questions ?? []).map((q) => q.id));

    if (isSingleQuestionAttemptMode(attemptData.mode)) {
      if (attemptData.totalQuestions !== 1) {
        throw new Error(
          `1問プレイモードでは totalQuestions は 1 である必要があります。送信値: ${attemptData.totalQuestions}`
        );
      }
      if (
        attemptData.mode === 'question-list' &&
        !satisfiesQuestionListAttemptContract(attemptData)
      ) {
        throw new Error('question-list モードの attempt 契約を満たしていません');
      }
      if (
        attemptData.mode === 'my-quiz' &&
        !satisfiesMyQuizAttemptContract(attemptData)
      ) {
        throw new Error('my-quiz モードの attempt 契約を満たしていません');
      }
      if (attemptData.failedQuestionIds.length > 1) {
        throw new Error('1問プレイモードでは failedQuestionIds は最大1件です');
      }
    } else if (attemptData.totalQuestions !== actualTotalQuestions) {
      throw new Error(
        `問題数の不整合が検知されました。期待される問題数: ${actualTotalQuestions}, 送信された問題数: ${attemptData.totalQuestions}`
      );
    }

    // 送信された間違えた問題IDがすべて該当クイズに存在するか検証
    for (const failedId of attemptData.failedQuestionIds) {
      if (!quizQuestionIds.has(failedId)) {
        throw new Error(`該当クイズに存在しない不正な問題IDが解答履歴に含まれています: ${failedId}`);
      }
    }

    // 計算上の正解数と送信されたスコア（score）が合致するか検証
    const calculatedScore = isSingleQuestionAttemptMode(attemptData.mode)
      ? 1 - attemptData.failedQuestionIds.length
      : actualTotalQuestions - attemptData.failedQuestionIds.length;
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

    const quizUpdates: Record<string, unknown> = {
      playCount: increment(1),
      updatedAt: completedAt,
    };

    if (isLeaderboardEligibleAttempt(attemptData)) {
      const leaderboardEntry = {
        userId: attemptData.userId,
        displayName,
        score: attemptData.score,
        elapsedSeconds: attemptData.elapsedSeconds,
        completedAt,
      };
      const lbResult = buildLeaderboardUpdatesForQuiz(
        quiz,
        priorCompletedCount,
        leaderboardEntry,
        attemptData.mode
      );
      if (lbResult) {
        Object.assign(quizUpdates, lbResult.updates);
      }
    }

    transaction.update(quizDocRef, quizUpdates);
  });

  return attemptDocRef.id;
}

/**
 * ウミガメのスープ用: プレイ開始時に未完了 attempt を作成する。
 * saveAttempt とは異なり completedAt 付与・スコア検証・playCount 更新は行わない。
 */
export async function createLateralAttemptSession(
  userId: string,
  quizId: string,
  questionIds: string[],
  listId?: string | null
): Promise<string> {
  const attemptDocRef = doc(attemptsCollection);
  const totalQuestions = questionIds.length;

  await setDoc(attemptDocRef, {
    userId,
    quizId,
    listId: listId ?? null,
    mode: listId ? 'list' : 'normal',
    score: 0,
    totalQuestions,
    elapsedSeconds: 0,
    failedQuestionIds: questionIds,
    aiQuestionsHistory: [],
    aiTurnCount: 0,
    aiTurnLimit: 30,
  });

  return attemptDocRef.id;
}

/* ==========================================================================
   弱点克服プレイ (復習) 用メソッド
   ========================================================================== */

/**
 * 過去に自身が間違えた問題配列のみを抽出し、復習用データとして提供する。
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

  let genreIdSet: Set<string> | null = null;
  if (genreFilter && genreFilter !== 'all') {
    const expanded = await expandGenreIdsForQuery(genreFilter);
    genreIdSet = new Set(expanded);
  }

  // 2. 対象となるクイズデータをまとめてフェッチし、問題オブジェクトを抽出する
  const failedQuestions: Question[] = [];

  for (const qId of Object.keys(quizIdToFailedIds)) {
    const quizDocRef = doc(quizzesRef, qId);
    const quizSnap = await getDoc(quizDocRef);

    if (quizSnap.exists()) {
      const quiz = quizSnap.data() as Quiz;
      if (genreIdSet && !quizMatchesGenreFilter(quiz, genreIdSet)) {
        continue;
      }

      const qIds = quizIdToFailedIds[qId];
      (quiz.questions ?? []).forEach((q) => {
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
 * 復習プレイで正解した問題を、ユーザーの過去の間違いリストからアトミックに削除する。
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

const PLAY_HISTORY_PAGE_SIZE = 20;
const NON_PERSISTED_PLAY_MODES = new Set<Attempt['mode']>(['test-play']);

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return new Date(0);
}

function encodePlayHistoryCursor(completedAt: Date, attemptId: string): string {
  return Buffer.from(
    JSON.stringify({ completedAt: completedAt.toISOString(), attemptId }),
    'utf8'
  ).toString('base64url');
}

function decodePlayHistoryCursor(
  cursor: string
): { completedAt: Date; attemptId: string } | null {
  try {
    const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      completedAt: string;
      attemptId: string;
    };
    if (!raw.completedAt || !raw.attemptId) return null;
    return { completedAt: new Date(raw.completedAt), attemptId: raw.attemptId };
  } catch {
    return null;
  }
}

/**
 * 本人のプレイ履歴（完了済み attempts）をページング取得する。
 */
export async function listUserPlayHistory(params: {
  uid: string;
  limit?: number;
  cursor?: string | null;
}): Promise<PlayHistoryPage> {
  const pageSize = params.limit ?? PLAY_HISTORY_PAGE_SIZE;
  const decoded = params.cursor ? decodePlayHistoryCursor(params.cursor) : null;

  let attemptsQuery = query(
    attemptsCollection,
    where('userId', '==', params.uid),
    orderBy('completedAt', 'desc'),
    limit(pageSize + 1)
  );

  if (decoded) {
    const cursorSnap = await getDoc(doc(attemptsCollection, decoded.attemptId));
    if (cursorSnap.exists()) {
      attemptsQuery = query(
        attemptsCollection,
        where('userId', '==', params.uid),
        orderBy('completedAt', 'desc'),
        startAfter(cursorSnap),
        limit(pageSize + 1)
      );
    }
  }

  const snap = await getDocs(attemptsQuery);
  const docs = snap.docs.filter((d) => {
    const mode = (d.data() as Attempt).mode;
    return !NON_PERSISTED_PLAY_MODES.has(mode);
  });

  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

  const quizTitleCache = new Map<string, string>();
  const items: PlayHistoryEntry[] = [];

  for (const docSnap of pageDocs) {
    const data = docSnap.data() as Attempt;
    if (!data.completedAt) continue;

    let quizTitle = quizTitleCache.get(data.quizId);
    if (!quizTitle) {
      const quizSnap = await getDoc(doc(quizzesRef, data.quizId));
      quizTitle = quizSnap.exists()
        ? (quizSnap.data() as Quiz).title
        : '（削除されたクイズ）';
      quizTitleCache.set(data.quizId, quizTitle);
    }

    items.push({
      attemptId: docSnap.id,
      quizId: data.quizId,
      quizTitle,
      score: data.score,
      totalQuestions: data.totalQuestions,
      mode: data.mode,
      completedAt: toDate(data.completedAt),
      elapsedSeconds: data.elapsedSeconds,
    });
  }

  const last = pageDocs[pageDocs.length - 1];
  const nextCursor =
    hasMore && last
      ? encodePlayHistoryCursor(
        toDate((last.data() as Attempt).completedAt),
        last.id
      )
      : null;

  return { items, nextCursor };
}

/**
 * 本人が完了済みプレイしたクイズ ID の一覧（重複除去）。ホームのプレイ状況フィルタ用。
 */
export async function listUserPlayedQuizIds(uid: string): Promise<string[]> {
  const attemptsQuery = query(attemptsCollection, where('userId', '==', uid));
  const snap = await getDocs(attemptsQuery);
  const ids = new Set<string>();

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Attempt;
    if (!data.completedAt) continue;
    if (NON_PERSISTED_PLAY_MODES.has(data.mode)) continue;
    ids.add(data.quizId);
  }

  return [...ids];
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
