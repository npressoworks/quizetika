/**
 * AI真相自動判定API Route
 * POST /api/attempt/verify-truth
 *
 * 処理フロー:
 * 1. リクエストバリデーション（真相要約は最大1000文字）
 * 2. Attempt と Quiz の裏設定を Firestore から取得
 * 3. Gemini API に真相要約を送信して合否を判定
 * 4. 合格時: attempt を completed にマークし、リーダーボードを更新
 * 5. 不合格時: AIアドバイスをレスポンスとして返す
 *
 * Requirements: 4.5, 4.6, 4.7
 * Boundary: VerifyTruthAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, doc, getDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { buildVerifyTruthPrompt, parseTruthVerifyResponse } from '@/services/verify-truth-utils';
import { Attempt, Quiz } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

const attemptsCollection = collection(db, 'attempts');
const quizzesCollection = collection(db, 'quizzes');

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { attemptId, userId, truthSummary, displayName } = body as {
      attemptId: string;
      userId: string;
      truthSummary: string;
      displayName?: string;
    };

    // 入力バリデーション
    if (!attemptId || !userId || !truthSummary) {
      return NextResponse.json(
        { error: 'missing-params', message: 'attemptId, userId, truthSummary は必須です' },
        { status: 400 }
      );
    }

    if (truthSummary.length > 1000) {
      return NextResponse.json(
        { error: 'too-long', message: '真相要約は1000文字以内で入力してください' },
        { status: 400 }
      );
    }

    // Attempt を取得
    const attemptRef = doc(attemptsCollection, attemptId);
    const attemptSnap = await getDoc(attemptRef);
    if (!attemptSnap.exists()) {
      return NextResponse.json({ error: 'attempt-not-found' }, { status: 404 });
    }
    const attempt = attemptSnap.data() as Attempt;

    // セキュリティチェック
    if (attempt.userId !== userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    // Quiz の裏設定を取得
    const quizRef = doc(quizzesCollection, attempt.quizId);
    const quizSnap = await getDoc(quizRef);
    if (!quizSnap.exists()) {
      return NextResponse.json({ error: 'quiz-not-found' }, { status: 404 });
    }
    const quiz = quizSnap.data() as Quiz;

    const lateralQuestion = quiz.questions.find((q) => q.type === 'lateral-thinking');
    if (!lateralQuestion?.aiContextDetails) {
      return NextResponse.json({ error: 'no-context' }, { status: 400 });
    }

    // Gemini API で真相判定
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = buildVerifyTruthPrompt(lateralQuestion.aiContextDetails, truthSummary);

    let isCorrect = false;
    let advice: string | null = null;

    try {
      const result = await model.generateContent(prompt);
      const parsed = parseTruthVerifyResponse(result.response.text());
      isCorrect = parsed.isCorrect;
      advice = parsed.advice;
    } catch (aiError) {
      console.error('[verify-truth] Gemini API エラー:', aiError);
      return NextResponse.json(
        { error: 'ai-error', message: 'AIの判定に失敗しました。しばらく後でもう一度お試しください。' },
        { status: 503 }
      );
    }

    if (isCorrect) {
      // 合格: Attempt を完了状態にマーク
      const completedAt = new Date();
      const elapsedSeconds = attempt.elapsedSeconds;

      await updateDoc(attemptRef, {
        completedAt,
        score: attempt.totalQuestions, // ウミガメは全問正解扱い
      });

      // リーダーボードにエントリを追加
      await updateDoc(quizRef, {
        leaderboard: arrayUnion({
          userId,
          displayName: displayName ?? '',
          score: attempt.totalQuestions,
          elapsedSeconds,
          completedAt,
        }),
        playCount: increment(1),
      });

      return NextResponse.json({ isCorrect: true, advice: null });
    } else {
      // 不合格: AIアドバイスを返す
      return NextResponse.json({ isCorrect: false, advice });
    }
  } catch (error) {
    console.error('[verify-truth] 予期しないエラー:', error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
