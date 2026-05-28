/**
 * AI質問判定API Route
 * POST /api/attempt/ask-ai
 *
 * 処理フロー:
 * 1. 認証トークンを検証
 * 2. Firestore から現在の attempt を取得し、キャッシュ照合
 * 3. キャッシュヒット → AI呼び出しなし、ターン消費なしで即時返却
 * 4. 無料ユーザーのターン制限チェック
 * 5. Gemini API に質問を送信（ステートレス）
 * 6. 結果を attempt の aiQuestionsHistory にアトミック追加
 *
 * Requirements: 4.1, 4.2, 4.3
 * Boundary: AskAiQuestionAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, doc, getDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  findCachedAnswer,
  isAiTurnLimitExceeded,
  buildAiPrompt,
  parseAiResponse,
} from '@/services/ask-ai-utils';
import { AiQuestion, Attempt, Quiz } from '@/types';

/** Gemini API クライアント（サーバーサイドでのみ使用） */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

/** Attempts コレクション参照 */
const attemptsCollection = collection(db, 'attempts');

/** Quizzes コレクション参照 */
const quizzesCollection = collection(db, 'quizzes');

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── リクエストボディのパース ────────────────────────────
    const body = await request.json();
    const { attemptId, questionText, userId, isPremium } = body as {
      attemptId: string;
      questionText: string;
      userId: string;
      isPremium?: boolean;
    };

    // 入力バリデーション
    if (!attemptId || !questionText || !userId) {
      return NextResponse.json(
        { error: 'missing-params', message: 'attemptId, questionText, userId は必須です' },
        { status: 400 }
      );
    }

    if (questionText.length > 100) {
      return NextResponse.json(
        { error: 'question-too-long', message: '質問は100文字以内で入力してください' },
        { status: 400 }
      );
    }

    // ── Attempt ドキュメントを取得 ──────────────────────────
    const attemptRef = doc(attemptsCollection, attemptId);
    const attemptSnap = await getDoc(attemptRef);

    if (!attemptSnap.exists()) {
      return NextResponse.json(
        { error: 'attempt-not-found', message: '対象のプレイ記録が見つかりません' },
        { status: 404 }
      );
    }

    const attempt = attemptSnap.data() as Attempt;

    // セキュリティ: 本人のAttemptのみ操作可能
    if (attempt.userId !== userId) {
      return NextResponse.json(
        { error: 'unauthorized', message: '他のユーザーのプレイ記録は操作できません' },
        { status: 403 }
      );
    }

    const history: AiQuestion[] = attempt.aiQuestionsHistory ?? [];

    // ── キャッシュ検索（同一質問は AI を呼ばず即時返却）────
    const cached = findCachedAnswer(questionText, history);
    if (cached) {
      return NextResponse.json({
        answerType: cached.answerType,
        aiComment: cached.aiComment,
        isFromCache: true,
        turnsRemaining: null,
      });
    }

    // ── ターン制限チェック ──────────────────────────────────
    const currentTurnCount = attempt.aiTurnCount ?? 0;
    if (isAiTurnLimitExceeded(currentTurnCount, isPremium ?? false)) {
      return NextResponse.json(
        {
          error: 'limit-exceeded',
          message: '本日の質問上限（20回）に達しました。プレミアムプランで制限を解除できます。',
        },
        { status: 429 }
      );
    }

    // ── クイズの裏設定を取得 ────────────────────────────────
    const quizRef = doc(quizzesCollection, attempt.quizId);
    const quizSnap = await getDoc(quizRef);

    if (!quizSnap.exists()) {
      return NextResponse.json(
        { error: 'quiz-not-found', message: 'クイズが見つかりません' },
        { status: 404 }
      );
    }

    const quiz = quizSnap.data() as Quiz;
    // ウミガメ問題の裏設定（質問に対応する問題の aiContextDetails を使用）
    const lateralQuestion = quiz.questions.find((q) => q.type === 'lateral-thinking');
    const aiContextDetails = lateralQuestion?.aiContextDetails;

    if (!aiContextDetails) {
      return NextResponse.json(
        { error: 'no-context', message: 'このクイズはAI判定に対応していません' },
        { status: 400 }
      );
    }

    // ── Gemini API に質問を送信（ステートレス）──────────────
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = buildAiPrompt(aiContextDetails, questionText);

    let answerType: AiQuestion['answerType'] = 'unknown';
    let aiComment = '判断できませんでした。';

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const parsed = parseAiResponse(responseText);
      answerType = parsed.answerType;
      aiComment = parsed.aiComment;
    } catch (aiError) {
      console.error('[ask-ai] Gemini API エラー:', aiError);
      // AI エラー時は unknown で返し、ターンは消費させない
      return NextResponse.json({ answerType: 'unknown', aiComment: 'AIが応答できませんでした。もう一度お試しください。', isFromCache: false, turnsRemaining: null });
    }

    // ── 結果を Attempt にアトミック追加 ────────────────────
    const newEntry: AiQuestion = {
      id: `${attemptId}_${Date.now()}`,
      questionText,
      answerType,
      aiComment,
      isFromCache: false,
      createdAt: new Date(),
    };

    await updateDoc(attemptRef, {
      aiQuestionsHistory: arrayUnion(newEntry),
      aiTurnCount: increment(1),
    });

    const newTurnCount = currentTurnCount + 1;
    const turnsRemaining = isPremium
      ? null
      : Math.max(0, 20 - newTurnCount);

    return NextResponse.json({
      answerType,
      aiComment,
      isFromCache: false,
      turnsRemaining,
    });
  } catch (error) {
    console.error('[ask-ai] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました' },
      { status: 500 }
    );
  }
}
