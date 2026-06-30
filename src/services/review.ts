import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  writeBatch,
  runTransaction,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { quizzesRef } from '../lib/firebase/firestore';
import { FeedbackReport, Quiz } from '../types';
import { calculateReviewScore, getReviewBadge, canVote } from './review-utils';

const feedbackReportsCollection = collection(db, 'feedbackReports');
const notificationsCollection = collection(db, 'notifications');
const quizReviewsCollection = collection(db, 'quizReviews');
const reviewResetRequestsCollection = collection(db, 'reviewResetRequests');

export interface QuizReview {
  id?: string; // ${reviewerId}_${quizId}
  quizId: string;
  reviewerId: string;
  type: 'positive' | 'negative';
  reason?: string | null;
  createdAt: Date;
}

export interface ReviewResetRequest {
  id?: string;
  quizId: string;
  requesterId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

/* ==========================================================================
   指摘フィードバック送信
   ========================================================================== */

export async function submitFeedbackReport(
  report: Omit<FeedbackReport, 'id' | 'status' | 'createdAt'>
): Promise<string> {
  const payload: Omit<FeedbackReport, 'id'> = {
    ...report,
    status: 'open',
    createdAt: new Date(),
  };
  const docRef = await addDoc(feedbackReportsCollection, payload);
  return docRef.id;
}

/** 作家ダッシュボード用: 未解決（open）の指摘一覧を取得 */
export async function getReportsForCreator(creatorId: string): Promise<FeedbackReport[]> {
  const q = query(
    feedbackReportsCollection,
    where('creatorId', '==', creatorId),
    where('status', '==', 'open')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedbackReport));
}

/**
 * 報告者(reporterId)が特定のクイズ(quizId)に対して送信した、
 * 未解決(status == 'open')の指摘レポート一覧を取得する。
 */
export async function getOpenReportsForQuiz(
  quizId: string,
  reporterId: string
): Promise<FeedbackReport[]> {
  const q = query(
    feedbackReportsCollection,
    where('quizId', '==', quizId),
    where('reporterId', '==', reporterId),
    where('status', '==', 'open')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedbackReport));
}

/**
 * 指摘レポートの内容を更新する。
 */
export async function updateFeedbackReport(
  reportId: string,
  category: 'typo' | 'fact' | 'alternative',
  content: string
): Promise<void> {
  const reportRef = doc(feedbackReportsCollection, reportId);
  await updateDoc(reportRef, {
    category,
    content,
    updatedAt: new Date(),
  });
}

export async function resolveReport(reportId: string, resolverNote?: string): Promise<void> {
  const reportRef = doc(feedbackReportsCollection, reportId);
  const reportSnap = await getDoc(reportRef);
  if (!reportSnap.exists()) throw new Error(`レポートが見つかりません: ${reportId}`);

  const report = reportSnap.data() as FeedbackReport;

  await updateDoc(reportRef, { status: 'resolved' });

  await addDoc(notificationsCollection, {
    userId: report.reporterId,
    type: 'correction_resolved',
    targetId: report.quizId,
    targetTitle: report.quizTitle,
    resolverNote: resolverNote ?? null,
    senderId: 'system',
    senderName: '運営',
    senderAvatar: '',
    isRead: false,
    createdAt: new Date(),
  });
}

/* ==========================================================================
   良問評価（👍/👎）
   ========================================================================== */

/**
 * 良問/悪問投票を送信し、クイズのカウンタをアトミックに更新する。
 * 二重投票防止のため、ドキュメントIDは `${reviewerId}_${quizId}` を使用する。
 */
export async function submitReview(
  quizId: string,
  reviewerId: string,
  type: 'positive' | 'negative',
  reason?: string | null
): Promise<void> {
  const quizDocRef = doc(quizzesRef, quizId);
  const voteDocId = `${reviewerId}_${quizId}`;
  const voteDocRef = doc(quizReviewsCollection, voteDocId);

  await runTransaction(db, async (transaction) => {
    const quizSnap = await transaction.get(quizDocRef);
    if (!quizSnap.exists()) throw new Error(`クイズが見つかりません: ${quizId}`);
    const quiz = quizSnap.data() as Quiz;

    if (!canVote(reviewerId, quiz.authorId)) {
      throw new Error('クイズの作成者は評価できません');
    }

    const voteSnap = await transaction.get(voteDocRef);
    const isResetPeriod = quiz.isReviewMasked;
    const now = new Date();

    const updates: Record<string, any> = {
      updatedAt: now,
    };

    if (voteSnap.exists()) {
      // 投票の変更
      const oldVote = voteSnap.data() as QuizReview;
      if (oldVote.type !== type) {
        const positiveField = isResetPeriod ? 'tempPositiveCount' : 'positiveCount';
        const negativeField = isResetPeriod ? 'tempNegativeCount' : 'negativeCount';

        if (type === 'positive') {
          updates[positiveField] = increment(1);
          updates[negativeField] = increment(-1);
        } else {
          updates[positiveField] = increment(-1);
          updates[negativeField] = increment(1);
        }

        // スコアとバッジを更新 (非マスク期間のみ)
        if (!isResetPeriod) {
          const newPositive = (quiz.positiveCount ?? 0) + (type === 'positive' ? 1 : -1);
          const newNegative = (quiz.negativeCount ?? 0) + (type === 'negative' ? 1 : -1);
          const newScore = calculateReviewScore(newPositive, newNegative);
          updates.reviewScore = newScore;
          updates.reviewBadge = getReviewBadge(newScore);
        }

        transaction.update(voteDocRef, {
          type,
          reason: reason ?? null,
          updatedAt: Timestamp.fromDate(now),
        });
      }
    } else {
      // 新規投票
      const positiveField = isResetPeriod ? 'tempPositiveCount' : 'positiveCount';
      const negativeField = isResetPeriod ? 'tempNegativeCount' : 'negativeCount';

      updates[type === 'positive' ? positiveField : negativeField] = increment(1);

      if (!isResetPeriod) {
        const newPositive = (quiz.positiveCount ?? 0) + (type === 'positive' ? 1 : 0);
        const newNegative = (quiz.negativeCount ?? 0) + (type === 'negative' ? 1 : 0);
        const newScore = calculateReviewScore(newPositive, newNegative);
        updates.reviewScore = newScore;
        updates.reviewBadge = getReviewBadge(newScore);
      }

      const newReview: QuizReview = {
        quizId,
        reviewerId,
        type,
        reason: reason ?? null,
        createdAt: now,
      };

      transaction.set(voteDocRef, newReview);
    }

    transaction.update(quizDocRef, updates);
  });
}

/**
 * ユーザーの良問/悪問投票を取り消し、クイズのカウンタをアトミックに減算する。
 * 取り消し後は `quizReviews` のドキュメントを物理削除する。
 */
export async function retractReview(
  quizId: string,
  reviewerId: string,
): Promise<void> {
  const quizDocRef = doc(quizzesRef, quizId);
  const voteDocId = `${reviewerId}_${quizId}`;
  const voteDocRef = doc(quizReviewsCollection, voteDocId);

  await runTransaction(db, async (transaction) => {
    const quizSnap = await transaction.get(quizDocRef);
    if (!quizSnap.exists()) throw new Error(`クイズが見つかりません: ${quizId}`);
    const quiz = quizSnap.data() as Quiz;

    const voteSnap = await transaction.get(voteDocRef);
    if (!voteSnap.exists()) {
      // すでに取り消し済みの場合は何もしない
      return;
    }

    const oldVote = voteSnap.data() as QuizReview;
    const isResetPeriod = quiz.isReviewMasked;
    const now = new Date();

    const positiveField = isResetPeriod ? 'tempPositiveCount' : 'positiveCount';
    const negativeField = isResetPeriod ? 'tempNegativeCount' : 'negativeCount';

    const updates: Record<string, any> = { updatedAt: now };

    // 削除する投票の分だけカウンタを減算
    if (oldVote.type === 'positive') {
      updates[positiveField] = increment(-1);
    } else {
      updates[negativeField] = increment(-1);
    }

    // スコアとバッジを再計算 (非マスク期間のみ)
    if (!isResetPeriod) {
      const newPositive = (quiz.positiveCount ?? 0) - (oldVote.type === 'positive' ? 1 : 0);
      const newNegative = (quiz.negativeCount ?? 0) - (oldVote.type === 'negative' ? 1 : 0);
      const newScore = calculateReviewScore(Math.max(0, newPositive), Math.max(0, newNegative));
      updates.reviewScore = newScore;
      updates.reviewBadge = getReviewBadge(newScore);
    }

    // 投票ドキュメントを物理削除
    transaction.delete(voteDocRef);
    transaction.update(quizDocRef, updates);
  });
}

/**
 * 指定クイズの良問率・良問数・悪問数・バッジ指定を取得。
 * 仮リセット期間中の場合は temp カウンタを返し、過去の評価をマスクする。
 */
export async function getReviewStats(
  quizId: string
): Promise<{
  reviewScore: number | null;
  positiveCount: number;
  negativeCount: number;
  reviewBadge: string | null;
  tempPositiveCount?: number;
  tempNegativeCount?: number;
}> {
  const quizDocRef = doc(quizzesRef, quizId);
  const snap = await getDoc(quizDocRef);

  if (!snap.exists()) {
    return {
      reviewScore: null,
      positiveCount: 0,
      negativeCount: 0,
      reviewBadge: null,
    };
  }

  const quiz = snap.data() as Quiz;

  if (quiz.isReviewMasked) {
    // マスク期間中: temp を正規カウンタとみなして表示し、過去の評価をマスク
    const score = calculateReviewScore(quiz.tempPositiveCount, quiz.tempNegativeCount);
    return {
      reviewScore: score,
      positiveCount: quiz.tempPositiveCount,
      negativeCount: quiz.tempNegativeCount,
      reviewBadge: getReviewBadge(score),
      tempPositiveCount: quiz.tempPositiveCount,
      tempNegativeCount: quiz.tempNegativeCount,
    };
  }

  return {
    reviewScore: quiz.reviewScore ?? null,
    positiveCount: quiz.positiveCount ?? 0,
    negativeCount: quiz.negativeCount ?? 0,
    reviewBadge: quiz.reviewBadge ?? null,
  };
}

/* ==========================================================================
   評価リセット申請
   ========================================================================== */

/**
 * 「要改善」バッジのクイズの評価リセット申請を登録し、仮リセット期間（マスク）に入る
 */
export async function submitReviewResetRequest(
  quizId: string,
  requesterId: string
): Promise<string> {
  const quizDocRef = doc(quizzesRef, quizId);

  return await runTransaction(db, async (transaction) => {
    const quizSnap = await transaction.get(quizDocRef);
    if (!quizSnap.exists()) throw new Error(`クイズが見つかりません: ${quizId}`);
    const quiz = quizSnap.data() as Quiz;

    if (quiz.authorId !== requesterId) {
      throw new Error('クイズの作成者のみがリセット申請を起案できます。');
    }

    const now = new Date();
    const requestPayload: Omit<ReviewResetRequest, 'id'> = {
      quizId,
      requesterId,
      status: 'pending',
      createdAt: now,
    };

    const newReqRef = doc(reviewResetRequestsCollection);
    transaction.set(newReqRef, requestPayload);

    // クイズを仮リセット期間に移行
    transaction.update(quizDocRef, {
      isReviewMasked: true,
      activeResetRequestId: newReqRef.id,
      tempPositiveCount: 0,
      tempNegativeCount: 0,
      updatedAt: Timestamp.fromDate(now),
    });

    return newReqRef.id;
  });
}

/**
 * 評価リセット承認時に過去の quizReviews レコードを100件チャンクで物理削除する。
 * その後、tempカウンターの値を正規カウンターに昇格しマスクを解除する。
 */
export async function resetReviews(quizId: string): Promise<void> {
  const q = query(quizReviewsCollection, where('quizId', '==', quizId));
  let hasMore = true;
  const CHUNK_SIZE = 100;

  try {
    while (hasMore) {
      const snap = await getDocs(query(q, limit(CHUNK_SIZE)));
      if (snap.empty) {
        hasMore = false;
        break;
      }

      const batch = writeBatch(db);
      snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();

      if (snap.docs.length < CHUNK_SIZE) {
        hasMore = false;
      }
    }

    // temp カウンタを正式カウンタに昇格し、マスクを解除
    const quizDocRef = doc(quizzesRef, quizId);
    await runTransaction(db, async (transaction) => {
      const quizSnap = await transaction.get(quizDocRef);
      if (!quizSnap.exists()) return;

      const quiz = quizSnap.data() as Quiz;
      const newPositive = quiz.tempPositiveCount ?? 0;
      const newNegative = quiz.tempNegativeCount ?? 0;
      const newScore = calculateReviewScore(newPositive, newNegative);

      transaction.update(quizDocRef, {
        positiveCount: newPositive,
        negativeCount: newNegative,
        tempPositiveCount: 0,
        tempNegativeCount: 0,
        reviewScore: newScore,
        reviewBadge: getReviewBadge(newScore),
        isReviewMasked: false,
        activeResetRequestId: null,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    });
  } catch (err) {
    console.error('[ReviewReset] リセット過去データ削除エラー:', err);
    throw err;
  }
}

/**
 * 指定されたクイズIDに関連する未解決（open）の指摘一覧を取得する。
 */
export async function getOpenReportsByQuizId(quizId: string, creatorId: string): Promise<FeedbackReport[]> {
  const q = query(
    feedbackReportsCollection,
    where('quizId', '==', quizId),
    where('creatorId', '==', creatorId),
    where('status', '==', 'open')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedbackReport));
}

/**
 * 指定された指摘レポートを却下（rejected）にする。
 * 却下時は報告者への通知は行わない。
 */
export async function rejectReport(reportId: string): Promise<void> {
  const reportRef = doc(feedbackReportsCollection, reportId);
  const reportSnap = await getDoc(reportRef);
  if (!reportSnap.exists()) throw new Error(`レポートが見つかりません: ${reportId}`);

  await updateDoc(reportRef, { status: 'rejected' });
}

/**
 * ログインユーザーが指定したクイズに対して行った投票（良問👍/微妙👎）を取得する。
 */
export async function getUserReviewForQuiz(
  quizId: string,
  reviewerId: string
): Promise<'positive' | 'negative' | null> {
  const voteDocId = `${reviewerId}_${quizId}`;
  const voteDocRef = doc(quizReviewsCollection, voteDocId);
  const snap = await getDoc(voteDocRef);
  if (!snap.exists()) return null;
  const data = snap.data() as QuizReview;
  return data.type;
}


