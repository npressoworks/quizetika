/**
 * AI質問判定API Route
 * POST /api/attempt/ask-ai
 *
 * Phase 17: 二層日次制限（30/クイズ・150/日横断）、正規化キャッシュ、limitType 付き 429
 *
 * Boundary: AskAiQuestionAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  findCachedAnswer,
  checkAiTurnLimits,
  parseAiResponse,
  mapHistoryToGeminiContents,
  buildAiSystemInstruction,
  DAILY_AI_TURN_GLOBAL_DOC_ID,
  FREE_TIER_PER_QUIZ_LIMIT,
  FREE_TIER_GLOBAL_DAILY_LIMIT,
  type AiTurnLimitType,
} from '@/services/ask-ai-utils';
import { AiQuestion, Attempt, Quiz } from '@/types';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { resolveUserEntitlements } from '@/services/entitlement';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

function getTodayString(): string {
  const d = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(d.getTime() + jstOffset);
  const yyyy = jstDate.getUTCFullYear();
  const mm = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jstDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function readDailyCount(
  data: { count?: number; lastUpdatedDate?: string } | undefined,
  todayStr: string
): number {
  if (!data || data.lastUpdatedDate !== todayStr) return 0;
  return data.count ?? 0;
}

function limitExceededMessage(limitType: AiTurnLimitType): string {
  if (limitType === 'per-quiz') {
    return `本日のこのクイズに対する質問上限（${FREE_TIER_PER_QUIZ_LIMIT}回）に達しました。Pro プランで制限を解除できます。`;
  }
  return `本日の全クイズ横断の質問上限（${FREE_TIER_GLOBAL_DAILY_LIMIT}回）に達しました。Pro プランで制限を解除できます。`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { attemptId, questionText, userId } = body as {
      attemptId: string;
      questionText: string;
      userId: string;
    };

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

    const token = extractBearerToken(request);
    const verifiedUid = await verifySupabaseAccessToken(token);

    if (!verifiedUid || verifiedUid !== userId) {
      console.warn(`[ask-ai] 認証に失敗しました。要求userId: ${userId}, 検証UID: ${verifiedUid}`);
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗したか、本人の操作ではありません' },
        { status: 401 }
      );
    }

    const db = getAdminFirestore();

    let hasUnlimitedAiQuestions = false;
    try {
      const entitlements = await resolveUserEntitlements(verifiedUid);
      hasUnlimitedAiQuestions = entitlements.hasUnlimitedAiQuestions;
    } catch (dbErr) {
      console.error('[ask-ai] ユーザーエンタイトルメント解決エラー (非致命的):', dbErr);
    }

    const attemptRef = db.collection('attempts').doc(attemptId);
    const attemptSnap = await attemptRef.get();

    if (!attemptSnap.exists) {
      return NextResponse.json(
        { error: 'attempt-not-found', message: '対象 of プレイ記録が見つかりません' },
        { status: 404 }
      );
    }

    const attempt = attemptSnap.data() as Attempt;

    if (attempt.userId !== verifiedUid) {
      return NextResponse.json(
        { error: 'unauthorized', message: '他のユーザーのプレイ記録は操作できません' },
        { status: 403 }
      );
    }

    const history: AiQuestion[] = attempt.aiQuestionsHistory ?? [];
    const todayStr = getTodayString();

    const perQuizCountRef = db
      .collection('users')
      .doc(userId)
      .collection('dailyAiTurnCounts')
      .doc(attempt.quizId);
    const globalCountRef = db
      .collection('users')
      .doc(userId)
      .collection('dailyAiTurnCounts')
      .doc(DAILY_AI_TURN_GLOBAL_DOC_ID);

    const [perQuizSnap, globalSnap] = await Promise.all([
      perQuizCountRef.get(),
      globalCountRef.get(),
    ]);

    const perQuizCount = readDailyCount(
      perQuizSnap.data() as { count?: number; lastUpdatedDate?: string },
      todayStr
    );
    const globalDailyCount = readDailyCount(
      globalSnap.data() as { count?: number; lastUpdatedDate?: string },
      todayStr
    );

    const limitCheck = checkAiTurnLimits({
      perQuizCount,
      globalDailyCount,
      hasUnlimitedAiQuestions,
    });

    const cached = findCachedAnswer(questionText, history);
    if (cached) {
      return NextResponse.json({
        answerType: cached.answerType,
        aiComment: cached.aiComment,
        isFromCache: true,
        turnsRemaining: limitCheck.turnsRemaining,
      });
    }

    if (limitCheck.exceeded && limitCheck.limitType) {
      return NextResponse.json(
        {
          error: 'limit-exceeded',
          limitType: limitCheck.limitType,
          message: limitExceededMessage(limitCheck.limitType),
        },
        { status: 429 }
      );
    }

    const quizRef = db.collection('quizzes').doc(attempt.quizId);
    const quizSnap = await quizRef.get();

    if (!quizSnap.exists) {
      return NextResponse.json(
        { error: 'quiz-not-found', message: 'クイズが見つかりません' },
        { status: 404 }
      );
    }

    const quiz = quizSnap.data() as Quiz;
    const lateralQuestion = quiz.questions.find((q) => q.type === 'lateral-thinking');
    const aiContextDetails = lateralQuestion?.aiContextDetails;

    if (!aiContextDetails) {
      return NextResponse.json(
        { error: 'no-context', message: 'このクイズはAI判定に対応していません' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL_ID ?? 'gemini-1.5-flash-latest',
      systemInstruction: buildAiSystemInstruction(aiContextDetails),
    });

    const mappedHistory = mapHistoryToGeminiContents(history);
    const chat = model.startChat({
      history: mappedHistory,
      generationConfig: {
        maxOutputTokens: 200,
      },
    });

    let answerType: AiQuestion['answerType'] = 'unknown';
    let aiComment = '判断できませんでした。';

    try {
      const result = await chat.sendMessage(questionText);
      const responseText = result.response.text();
      const parsed = parseAiResponse(responseText);
      answerType = parsed.answerType;
      aiComment = parsed.aiComment;
    } catch (aiError) {
      console.error('[ask-ai] Gemini API エラー:', aiError);
      return NextResponse.json({
        answerType: 'unknown',
        aiComment: 'AIが応答できませんでした。もう一度お試しください。',
        isFromCache: false,
        turnsRemaining: limitCheck.turnsRemaining,
      });
    }

    const newEntry: AiQuestion = {
      id: `${attemptId}_${Date.now()}`,
      questionText,
      answerType,
      aiComment,
      isFromCache: false,
      createdAt: new Date(),
    };

    const nextPerQuizCount = perQuizCount + 1;
    const nextGlobalCount = globalDailyCount + 1;

    await db.runTransaction(async (transaction) => {
      transaction.update(attemptRef, {
        aiQuestionsHistory: FieldValue.arrayUnion(newEntry),
        aiTurnCount: FieldValue.increment(1),
      });

      transaction.set(
        perQuizCountRef,
        { count: nextPerQuizCount, lastUpdatedDate: todayStr },
        { merge: true }
      );

      transaction.set(
        globalCountRef,
        { count: nextGlobalCount, lastUpdatedDate: todayStr },
        { merge: true }
      );
    });

    const afterLimit = checkAiTurnLimits({
      perQuizCount: nextPerQuizCount,
      globalDailyCount: nextGlobalCount,
      hasUnlimitedAiQuestions,
    });

    return NextResponse.json({
      answerType,
      aiComment,
      isFromCache: false,
      turnsRemaining: afterLimit.turnsRemaining,
    });
  } catch (error) {
    console.error('[ask-ai] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました' },
      { status: 500 }
    );
  }
}
