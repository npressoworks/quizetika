/**
 * AI真相自動判定API Route
 * POST /api/attempt/verify-truth
 *
 * 処理フロー:
 * 1. リクエストバリデーション（真相要約は最大1000文字）
 * 2. Attempt と Quiz の裏設定を Firestore から取得
 * 3. Gemini API に真相要約を送信して合否を判定
 * 4. 合格時: attempt を completed にマーク、履歴の追加、リーダーボード・プレイ数のトランザクション更新
 * 5. 不合格時: 履歴の追加、AIアドバイスをレスポンスとして返す
 *
 * Requirements: 4.5, 4.6, 4.7
 * Boundary: VerifyTruthAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, doc, getDoc, updateDoc, arrayUnion, increment, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  buildVerifyTruthPrompt,
  parseTruthVerifyResponse,
  verifyKeywords,
} from '@/services/verify-truth-utils';
import { Attempt, Quiz } from '@/types';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebase/auth-verify';

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

    // ── トークン検証による認証チェック ────────────────────
    const token = extractBearerToken(request);
    const verifiedUid = await verifyFirebaseIdToken(token, userId);

    if (!verifiedUid || verifiedUid !== userId) {
      console.warn(`[verify-truth] 認証に失敗しました。要求userId: ${userId}, 検証UID: ${verifiedUid}`);
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗したか、本人の操作ではありません' },
        { status: 401 }
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
    if (attempt.userId !== verifiedUid) {
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

    // ── B2 ハイブリッド判定 ────────────────────────────────
    let isCorrect = false;
    let advice: string | null = null;

    const hasKeywords = verifyKeywords(truthSummary, lateralQuestion.truthKeywords ?? []);

    if (hasKeywords) {
      // 1. キーワードがすべて含まれている場合: AIをバイパスして即合格 (CORRECT)
      isCorrect = true;
      advice = null;
    } else {
      // 2. キーワードが一部不足している場合: AIによるフォールバック意味判定を実行
      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL_ID ?? 'gemini-1.5-flash-latest' });
      const prompt = buildVerifyTruthPrompt(lateralQuestion.aiContextDetails, truthSummary);

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
    }

    const now = new Date();
    // 履歴追加用の解答レコード
    const newTruthAttempt = {
      id: `${attemptId}_truth_${Date.now()}`,
      truthText: truthSummary,
      isCorrect,
      aiFeedback: advice ?? '',
      createdAt: now,
    };

    if (isCorrect) {
      // 合格: トランザクションでアトミックに完了マーク、履歴追加、リーダーボード更新
      const elapsedSeconds = attempt.elapsedSeconds;

      await runTransaction(db, async (transaction) => {
        const quizTransactionSnap = await transaction.get(quizRef);
        if (!quizTransactionSnap.exists()) throw new Error('クイズが見つかりません。');
        const currentQuiz = quizTransactionSnap.data() as Quiz;

        // 1. attempt を完了、履歴追加
        transaction.update(attemptRef, {
          completedAt: now,
          score: attempt.totalQuestions, // ウミガメは全問正解扱い
          aiTruthAttempts: arrayUnion(newTruthAttempt),
        });

        // 2. クイズのリーダーボードとプレイ数インクリメント
        const leaderboardEntry = {
          userId,
          displayName: displayName ?? '',
          score: attempt.totalQuestions,
          elapsedSeconds,
          completedAt: now,
        };

        const newLeaderboard = [...(currentQuiz.leaderboard ?? [])];
        newLeaderboard.push(leaderboardEntry);
        newLeaderboard.sort((a, b) => b.score - a.score || a.elapsedSeconds - b.elapsedSeconds);
        const top5Leaderboard = newLeaderboard.slice(0, 5);

        transaction.update(quizRef, {
          leaderboard: top5Leaderboard,
          playCount: increment(1),
          updatedAt: now,
        });
      });

      return NextResponse.json({ isCorrect: true, advice: null });
    } else {
      // 不合格: 履歴の追加のみアトミックに行い、AIアドバイスを返す
      await updateDoc(attemptRef, {
        aiTruthAttempts: arrayUnion(newTruthAttempt),
      });

      return NextResponse.json({ isCorrect: false, advice });
    }
  } catch (error) {
    console.error('[verify-truth] 予期しないエラー:', error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
