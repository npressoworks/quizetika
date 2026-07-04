import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  runTransaction,
  increment,
  arrayRemove,
  documentId,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { expandGenreIdsForQuery, quizMatchesGenreFilter } from '../lib/metadata-resolution';
import { assertCanViewQuizAsync } from '../lib/quiz-access';
import { quizzesRef, usersRef } from '../lib/firebase/firestore';
import { createClient } from '../lib/supabase/client';
import { Database, Json } from '../lib/supabase/database.types';
import { getQuiz } from './quiz';
import {
  Attempt,
  Quiz,
  Question,
  PlayHistoryPage,
  PlayHistoryEntry,
  LeaderboardRecord,
  assertPlayModeAllowedForSave,
  satisfiesMyQuizAttemptContract,
} from '../types';
import {
  getPendingSyncAttempts,
  clearPendingSyncAttempt,
  PendingSyncAttempt,
} from './attempt-session';

const supabase = createClient();

const attemptsCollection = collection(db, 'attempts');

function isSingleQuestionAttemptMode(mode: Attempt['mode']): boolean {
  return mode === 'my-quiz';
}

/** ウミガメのスープ用セッション開始時のデフォルト質問ターン上限 */
const LATERAL_DEFAULT_AI_TURN_LIMIT = 30;

/** attempts テーブルの Row を Attempt 型オブジェクトへマッピングする */
export function mapRowToAttempt(row: Database['public']['Tables']['attempts']['Row']): Attempt {
  return {
    id: row.id,
    userId: row.user_id,
    quizId: row.quiz_id,
    listId: row.list_id,
    mode: row.mode as Attempt['mode'],
    sessionId: row.session_id ?? undefined,
    score: row.score,
    totalQuestions: row.total_questions,
    elapsedSeconds: row.elapsed_seconds,
    failedQuestionIds: row.failed_question_ids ?? [],
    questionAnswers: (row.question_answers as any) ?? undefined,
    questionAnswerDetails: (row.question_answer_details as any) ?? undefined,
    difficultyVote: row.difficulty_vote,
    aiQuestionsHistory: (row.ai_questions_history as any) ?? undefined,
    aiTruthAttempts: (row.ai_truth_attempts as any) ?? undefined,
    aiTurnCount: row.ai_turn_count ?? 0,
    aiTurnLimit: row.ai_turn_limit,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    gaveUpLateral: row.gave_up_lateral ?? undefined,
  };
}

/* ==========================================================================
   Attempt 保存
   ========================================================================== */

/**
 * プレイ結果を保存する。
 * クライアント側では対不正検証のうち RPC 側でカバーされない項目
 * （1問プレイ契約・解答詳細の整合性）のみを事前検証し、
 * 実際のレコード追加・プレイ回数加算・初回／リプレイリーダーボード更新は
 * `handle_save_attempt` RPC がアトミックに行う。
 */
export async function saveAttempt(
  attemptData: Omit<Attempt, 'id' | 'completedAt'>
): Promise<string> {
  assertPlayModeAllowedForSave(attemptData.mode);

  const quiz = await getQuiz(attemptData.quizId);
  if (!quiz) {
    throw new Error(`クイズが見つかりません: ${attemptData.quizId}`);
  }

  const viewerUid =
    attemptData.userId && attemptData.userId !== 'guest' ? attemptData.userId : null;
  await assertCanViewQuizAsync(quiz, viewerUid);

  const actualTotalQuestions = quiz.questions?.length ?? 0;
  const quizQuestionIds = new Set((quiz.questions ?? []).map((q: Question) => q.id));

  // ── セキュリティ対策（チート防止のためのクライアント側事前検証。RPC 側でも再検証される） ──
  if (isSingleQuestionAttemptMode(attemptData.mode)) {
    if (attemptData.totalQuestions !== 1) {
      throw new Error(
        `1問プレイモードでは totalQuestions は 1 である必要があります。送信値: ${attemptData.totalQuestions}`
      );
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

  if (attemptData.questionAnswerDetails && attemptData.questionAnswerDetails.length > 0) {
    const details = attemptData.questionAnswerDetails;
    if (details.length !== attemptData.totalQuestions) {
      throw new Error(
        `解答詳細の件数が不整合です。期待される問題数: ${attemptData.totalQuestions}, 送信された詳細件数: ${details.length}`
      );
    }
    const detailsCorrectCount = details.filter((d) => d.isCorrect).length;
    if (detailsCorrectCount !== attemptData.score) {
      throw new Error(
        `解答詳細の正解数 (${detailsCorrectCount}) が送信されたスコア (${attemptData.score}) と一致しません`
      );
    }
    for (const detail of details) {
      if (!quizQuestionIds.has(detail.questionId)) {
        throw new Error(
          `該当クイズに存在しない不正な問題IDが解答詳細に含まれています: ${detail.questionId}`
        );
      }
    }
  }
  // ───────────────────────────────────────────────────────────────

  const { data: attemptId, error } = await supabase.rpc('handle_save_attempt', {
    p_user_id: attemptData.userId,
    p_quiz_id: attemptData.quizId,
    p_mode: attemptData.mode,
    p_score: attemptData.score,
    p_total_questions: attemptData.totalQuestions,
    p_elapsed_seconds: attemptData.elapsedSeconds,
    p_failed_question_ids: attemptData.failedQuestionIds,
    p_question_answers: (attemptData.questionAnswers ?? []) as unknown as Json,
    p_question_answer_details: (attemptData.questionAnswerDetails ?? []) as unknown as Json,
  });

  if (error || !attemptId) {
    throw new Error(`プレイ結果の保存に失敗しました: ${error?.message ?? '不明なエラー'}`);
  }

  return attemptId;
}

/**
 * ウミガメのスープ用: プレイ開始時に未完了 attempt を作成する。
 * saveAttempt とは異なり completedAt 付与・スコア検証・playCount 更新は行わない。
 */
export async function createLateralAttemptSession(
  userId: string,
  quizId: string,
  questionIds: string[]
): Promise<string> {
  const { data: attemptId, error } = await supabase.rpc('handle_start_lateral_attempt', {
    p_user_id: userId,
    p_quiz_id: quizId,
    p_total_questions: questionIds.length,
    p_ai_turn_limit: LATERAL_DEFAULT_AI_TURN_LIMIT,
  });

  if (error || !attemptId) {
    throw new Error(`水平思考クイズセッションの開始に失敗しました: ${error?.message ?? '不明なエラー'}`);
  }

  return attemptId;
}

/* ==========================================================================
   リーダーボード読み取り
   ========================================================================== */

/**
 * クイズの初回プレイ／リプレイ別リーダーボードを上位N件取得する。
 */
export async function getLeaderboard(
  quizId: string,
  board: 'first_play' | 'replay',
  limit: number = 5
): Promise<LeaderboardRecord[]> {
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('type', board)
    .order('score', { ascending: false })
    .order('elapsed_seconds', { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    score: row.score,
    elapsedSeconds: row.elapsed_seconds,
    completedAt: new Date(row.completed_at),
  }));
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
  const targetQuizIds = Object.keys(quizIdToFailedIds);
  const quizMap = new Map<string, Quiz>();

  if (targetQuizIds.length > 0) {
    const chunks = [];
    for (let i = 0; i < targetQuizIds.length; i += 30) {
      chunks.push(targetQuizIds.slice(i, i + 30));
    }
    const snaps = await Promise.all(
      chunks.map((chunk) => getDocs(query(quizzesRef, where(documentId(), 'in', chunk))))
    );
    snaps.forEach((snap) => {
      snap.forEach((d) => {
        quizMap.set(d.id, d.data() as Quiz);
      });
    });
  }

  for (const qId of targetQuizIds) {
    const quiz = quizMap.get(qId);
    if (quiz) {
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

function encodePlayHistoryCursor(completedAt: Date, attemptId: string): string {
  const str = JSON.stringify({ completedAt: completedAt.toISOString(), attemptId });
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodePlayHistoryCursor(
  cursor: string
): { completedAt: Date; attemptId: string } | null {
  try {
    let padded = cursor.replace(/-/g, '+').replace(/_/g, '/');
    while (padded.length % 4) {
      padded += '=';
    }
    const raw = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
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

  let attemptsQuery = supabase
    .from('attempts')
    .select('*')
    .eq('user_id', params.uid)
    .not('completed_at', 'is', null)
    .not('mode', 'in', `(${[...NON_PERSISTED_PLAY_MODES].join(',')})`)
    .order('completed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);

  if (decoded) {
    const isoCursor = decoded.completedAt.toISOString();
    attemptsQuery = attemptsQuery.or(
      `completed_at.lt.${isoCursor},and(completed_at.eq.${isoCursor},id.lt.${decoded.attemptId})`
    );
  }

  const { data, error } = await attemptsQuery;
  if (error) {
    throw new Error(`プレイ履歴の取得に失敗しました: ${error.message}`);
  }

  const rows = (data ?? []) as Database['public']['Tables']['attempts']['Row'][];
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

  // クイズIDをユニーク化して一括取得する
  const quizIds = [...new Set(pageRows.map((r) => r.quiz_id).filter(Boolean))];
  const quizTitleCache = new Map<string, string>();

  if (quizIds.length > 0) {
    const { data: quizRows } = await supabase
      .from('quizzes')
      .select('id, title')
      .in('id', quizIds);
    (quizRows ?? []).forEach((q) => quizTitleCache.set(q.id, q.title));
  }

  const items: PlayHistoryEntry[] = pageRows.map((row) => ({
    attemptId: row.id,
    quizId: row.quiz_id,
    quizTitle: quizTitleCache.get(row.quiz_id) ?? '（削除されたクイズ）',
    score: row.score,
    totalQuestions: row.total_questions,
    mode: row.mode as Attempt['mode'],
    completedAt: new Date(row.completed_at as string),
    elapsedSeconds: row.elapsed_seconds,
  }));

  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last
      ? encodePlayHistoryCursor(new Date(last.completed_at as string), last.id)
      : null;

  return { items, nextCursor };
}

/**
 * 本人が完了済みプレイしたクイズ ID の一覧（重複除去）。ホームのプレイ状況フィルタ用。
 */
export async function listUserPlayedQuizIds(uid: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('attempts')
    .select('quiz_id, mode, completed_at')
    .eq('user_id', uid)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(500);

  if (error || !data) return [];

  const ids = new Set<string>();
  for (const row of data) {
    if (NON_PERSISTED_PLAY_MODES.has(row.mode as Attempt['mode'])) continue;
    ids.add(row.quiz_id);
  }

  return [...ids];
}

/* ==========================================================================
   オフライン未同期データのバッチ同期
   ========================================================================== */

export async function syncPendingAttempts(): Promise<number> {
  const pending = getPendingSyncAttempts();
  if (pending.length === 0) return 0;

  let successCount = 0;

  for (const pendingAttempt of pending) {
    try {
      const attempt = pendingSyncToAttempt(pendingAttempt);
      await saveAttempt(attempt); // RPC版を呼び出して同期
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
    questionAnswerDetails: pending.questionAnswerDetails,
    difficultyVote: pending.difficultyVote ?? null,
    aiTurnCount: pending.aiTurnCount,
    aiTurnLimit: pending.aiTurnLimit,
    completedAt: new Date(pending.completedAt),
  };
}
