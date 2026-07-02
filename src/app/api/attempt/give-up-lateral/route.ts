/**
 * 水平思考クイズ諦め API
 * POST /api/attempt/give-up-lateral
 *
 * Phase 17: attempt を不合格完了として記録する（真相・解説は返却しない）
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { normalizeElapsedSeconds } from '@/lib/format-play-elapsed';
import { Attempt, Quiz, QuestionAnswerDetail } from '@/types';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { attemptId, userId, elapsedSeconds } = body as {
      attemptId: string;
      userId: string;
      elapsedSeconds?: number;
    };

    if (!attemptId || !userId) {
      return NextResponse.json(
        { error: 'missing-params', message: 'attemptId, userId は必須です' },
        { status: 400 }
      );
    }

    const token = extractBearerToken(request);
    const verifiedUid = await verifySupabaseAccessToken(token);

    if (!verifiedUid || verifiedUid !== userId) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗したか、本人の操作ではありません' },
        { status: 401 }
      );
    }

    const db = getAdminFirestore();
    const attemptRef = db.collection('attempts').doc(attemptId);
    const attemptSnap = await attemptRef.get();

    if (!attemptSnap.exists) {
      return NextResponse.json({ error: 'attempt-not-found' }, { status: 404 });
    }

    const attempt = attemptSnap.data() as Attempt;

    if (attempt.userId !== verifiedUid) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    if (attempt.completedAt != null) {
      return NextResponse.json(
        { error: 'already-completed', message: 'このプレイは既に完了しています' },
        { status: 409 }
      );
    }

    const quizRef = db.collection('quizzes').doc(attempt.quizId);
    const quizSnap = await quizRef.get();

    if (!quizSnap.exists) {
      return NextResponse.json({ error: 'quiz-not-found' }, { status: 404 });
    }

    const quiz = quizSnap.data() as Quiz;
    const lateralQuestion = quiz.questions.find((q) => q.type === 'lateral-thinking');

    if (!lateralQuestion) {
      return NextResponse.json({ error: 'no-lateral-question' }, { status: 400 });
    }

    const now = new Date();
    const savedElapsedSeconds = normalizeElapsedSeconds(
      elapsedSeconds,
      attempt.elapsedSeconds ?? 0
    );

    await db.runTransaction(async (transaction) => {
      const quizTransactionSnap = await transaction.get(quizRef);
      if (!quizTransactionSnap.exists) throw new Error('クイズが見つかりません。');

      const detailRecord: QuestionAnswerDetail = {
        questionId: lateralQuestion.id,
        questionType: 'lateral-thinking',
        isCorrect: false,
        elapsedSeconds: savedElapsedSeconds,
        hintsUsedCount: 0,
        aiTurnCount: attempt.aiTruthAttempts?.length ?? 0,
        truthSummary: null,
        lateralPlayEndedStatus: 'gave_up',
      };

      transaction.update(attemptRef, {
        completedAt: now,
        score: 0,
        gaveUpLateral: true,
        elapsedSeconds: savedElapsedSeconds,
        questionAnswerDetails: [detailRecord],
      });

      transaction.update(quizRef, {
        playCount: FieldValue.increment(1),
        updatedAt: now,
      });
    });

    return NextResponse.json({ completed: true });
  } catch (error) {
    console.error('[give-up-lateral] 予期しないエラー:', error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
