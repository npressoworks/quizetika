/**
 * AI質問判定API Route
 * POST /api/attempt/ask-ai
 *
 * Phase 17: 二層日次制限（30/クイズ・150/日横断）、正規化キャッシュ、limitType 付き 429
 * Supabase 正規化対応: 日次カウンタは ai_turn_counts_per_quiz / ai_turn_counts_global を
 * 事前参照して fail-fast し、実際の加算・上限判定・履歴追記は handle_record_ai_turn RPC が
 * アトミックに行う（事前参照とRPC呼び出しの間のレースはRPC側の再判定で閉じられる）。
 *
 * Boundary: AskAiQuestionAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createAdminClient } from '@/lib/supabase/server';
import {
  findCachedAnswer,
  checkAiTurnLimits,
  parseAiResponse,
  mapHistoryToGeminiContents,
  buildAiSystemInstruction,
  ASK_AI_RESPONSE_SCHEMA,
  getTodayJstString,
  readDailyCount,
  FREE_TIER_PER_QUIZ_LIMIT,
  FREE_TIER_GLOBAL_DAILY_LIMIT,
  type AiTurnLimitType,
} from '@/services/ask-ai-utils';
import { mapQuestionRowToQuestion } from '@/services/question';
import { AiQuestion } from '@/types';
import type { Database } from '@/lib/supabase/database.types';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { resolveUserEntitlements } from '@/services/entitlement';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

type QuestionRow = Database['public']['Tables']['questions']['Row'];

function limitExceededMessage(limitType: AiTurnLimitType): string {
  if (limitType === 'per-quiz') {
    return `本日のこのクイズに対する質問上限（${FREE_TIER_PER_QUIZ_LIMIT}回）に達しました。Pro プランで制限を解除できます。`;
  }
  return `本日の全クイズ横断の質問上限（${FREE_TIER_GLOBAL_DAILY_LIMIT}回）に達しました。Pro プランで制限を解除できます。`;
}

/** 対象クイズの水平思考問題の裏設定（aiContextDetails）を quiz_questions 経由で取得する */
async function findLateralAiContextDetails(
  supabase: ReturnType<typeof createAdminClient>,
  quizId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('question:questions(*)')
    .eq('quiz_id', quizId);

  if (error || !data) return null;

  const row = (data as unknown as { question: QuestionRow | null }[])
    .map((link) => link.question)
    .find((q) => q?.type === 'lateral-thinking');

  if (!row) return null;
  return mapQuestionRowToQuestion(row).aiContextDetails ?? null;
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

    const supabase = createAdminClient();

    let hasUnlimitedAiQuestions = false;
    try {
      const entitlements = await resolveUserEntitlements(verifiedUid);
      hasUnlimitedAiQuestions = entitlements.hasUnlimitedAiQuestions;
    } catch (dbErr) {
      console.error('[ask-ai] ユーザーエンタイトルメント解決エラー (非致命的):', dbErr);
    }

    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .select('*')
      .eq('id', attemptId)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: 'attempt-not-found', message: '対象のプレイ記録が見つかりません' },
        { status: 404 }
      );
    }

    if (attempt.user_id !== verifiedUid) {
      return NextResponse.json(
        { error: 'unauthorized', message: '他のユーザーのプレイ記録は操作できません' },
        { status: 403 }
      );
    }

    const history: AiQuestion[] = (attempt.ai_questions_history as unknown as AiQuestion[]) ?? [];
    const todayStr = getTodayJstString();

    const [{ data: perQuizRow }, { data: globalRow }] = await Promise.all([
      supabase
        .from('ai_turn_counts_per_quiz')
        .select('count, count_date')
        .eq('user_id', verifiedUid)
        .eq('quiz_id', attempt.quiz_id)
        .maybeSingle(),
      supabase
        .from('ai_turn_counts_global')
        .select('count, count_date')
        .eq('user_id', verifiedUid)
        .maybeSingle(),
    ]);

    const perQuizCount = readDailyCount(perQuizRow, todayStr);
    const globalDailyCount = readDailyCount(globalRow, todayStr);

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

    // Gemini呼び出し前にフェイルファスト（無駄なAPI呼び出しを避ける）。
    // 最終的な整合性は handle_record_ai_turn RPC のアトミックな加算直後の再判定に委ねる。
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

    const aiContextDetails = await findLateralAiContextDetails(supabase, attempt.quiz_id);

    if (!aiContextDetails) {
      return NextResponse.json(
        { error: 'no-context', message: 'このクイズはAI判定に対応していません' },
        { status: 400 }
      );
    }

    const mappedHistory = mapHistoryToGeminiContents(history);
    const chat = genAI.chats.create({
      model: process.env.GEMINI_MODEL_ID ?? 'gemini-3.1-flash-lite',
      history: mappedHistory,
      config: {
        systemInstruction: buildAiSystemInstruction(aiContextDetails),
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 3000,
        responseMimeType: 'application/json',
        responseSchema: ASK_AI_RESPONSE_SCHEMA,
      },
    });

    let answerType: AiQuestion['answerType'] = 'unknown';
    let aiComment = '';

    try {
      const result = await chat.sendMessage({ message: questionText });
      const responseText = result.text ?? '';
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

    const { data: rpcData, error: rpcError } = await supabase.rpc('handle_record_ai_turn', {
      p_attempt_id: attemptId,
      p_user_id: verifiedUid,
      p_quiz_id: attempt.quiz_id,
      p_history_entry: newEntry as unknown as Database['public']['Functions']['handle_record_ai_turn']['Args']['p_history_entry'],
      // RPC は NULL を「無制限」として扱う。生成された Args 型は非 null 前提のため、
      // Postgres 側の実際のシグネチャ（NULL 許容 INTEGER）に合わせてキャストする。
      p_per_quiz_limit: (hasUnlimitedAiQuestions ? null : FREE_TIER_PER_QUIZ_LIMIT) as unknown as number,
      p_global_limit: (hasUnlimitedAiQuestions ? null : FREE_TIER_GLOBAL_DAILY_LIMIT) as unknown as number,
    });

    if (rpcError) {
      const message = rpcError.message ?? '';
      if (message.includes('per-quiz-limit-exceeded')) {
        return NextResponse.json(
          {
            error: 'limit-exceeded',
            limitType: 'per-quiz',
            message: limitExceededMessage('per-quiz'),
          },
          { status: 429 }
        );
      }
      if (message.includes('global-limit-exceeded')) {
        return NextResponse.json(
          {
            error: 'limit-exceeded',
            limitType: 'global-daily',
            message: limitExceededMessage('global-daily'),
          },
          { status: 429 }
        );
      }
      throw new Error(message);
    }

    const resultRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const nextPerQuizCount = resultRow?.per_quiz_count ?? perQuizCount + 1;
    const nextGlobalCount = resultRow?.global_count ?? globalDailyCount + 1;

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
