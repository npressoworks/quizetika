/**
 * AI真相自動判定API Route
 * POST /api/attempt/verify-truth
 *
 * 処理フロー:
 * 1. リクエストバリデーション（真相要約は最大1000文字）
 * 2. Attempt を Supabase から取得し、水平思考問題の裏設定/エッセンスを取得
 * 3. Gemini API に真相要約を送信して合否を判定
 * 4. handle_complete_lateral_attempt RPC を呼び出す（合格時のみ完了・リーダーボード反映はRPC内部で実施）
 *
 * Requirements: 4.7, 4.8, 4.9, 4.10, 4.11, 4.12
 * Boundary: VerifyTruthAPI (Phase 15: AI 意味判定)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createAdminClient } from '@/lib/supabase/server';
import { normalizeElapsedSeconds } from '@/lib/format-play-elapsed';
import { buildVerifyTruthPrompt, parseTruthVerifyResponse } from '@/services/verify-truth-utils';
import { mapQuestionRowToQuestion } from '@/services/question';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import type { Question } from '@/types';
import type { Database } from '@/lib/supabase/database.types';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

type QuestionRow = Database['public']['Tables']['questions']['Row'];

/** 対象クイズの水平思考問題（裏設定/必須エッセンス）を quiz_questions 経由で取得する */
async function findLateralThinkingQuestion(
  supabase: ReturnType<typeof createAdminClient>,
  quizId: string
): Promise<Question | null> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('question:questions(*)')
    .eq('quiz_id', quizId);

  if (error || !data) return null;

  const row = (data as unknown as { question: QuestionRow | null }[])
    .map((link) => link.question)
    .find((q) => q?.type === 'lateral-thinking');

  return row ? mapQuestionRowToQuestion(row) : null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { attemptId, userId, truthSummary, elapsedSeconds } = body as {
      attemptId: string;
      userId: string;
      truthSummary: string;
      elapsedSeconds?: number;
    };

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

    const token = extractBearerToken(request);
    const verifiedUid = await verifySupabaseAccessToken(token);

    if (!verifiedUid || verifiedUid !== userId) {
      console.warn(`[verify-truth] 認証に失敗しました。要求userId: ${userId}, 検証UID: ${verifiedUid}`);
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗したか、本人の操作ではありません' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .select('*')
      .eq('id', attemptId)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: 'attempt-not-found' }, { status: 404 });
    }

    if (attempt.user_id !== verifiedUid) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    const lateralQuestion = await findLateralThinkingQuestion(supabase, attempt.quiz_id);
    if (!lateralQuestion?.aiContextDetails) {
      return NextResponse.json({ error: 'no-context' }, { status: 400 });
    }

    const prompt = buildVerifyTruthPrompt(
      lateralQuestion.aiContextDetails,
      truthSummary,
      lateralQuestion.truthKeywords ?? []
    );

    let isCorrect = false;
    let advice: string | null = null;

    try {
      const result = await genAI.models.generateContent({
        model: process.env.GEMINI_MODEL_ID ?? 'gemini-1.5-flash-latest',
        contents: prompt,
      });
      const parsed = parseTruthVerifyResponse(result.text ?? '');
      isCorrect = parsed.isCorrect;
      advice = parsed.advice;
    } catch (aiError) {
      console.error('[verify-truth] Gemini API エラー:', aiError);
      return NextResponse.json(
        { error: 'ai-error', message: 'AIの判定に失敗しました。しばらく後でもう一度お試しください。' },
        { status: 503 }
      );
    }

    const newTruthAttempt = {
      id: `${attemptId}_truth_${Date.now()}`,
      truthText: truthSummary,
      isCorrect,
      aiFeedback: advice ?? '',
      createdAt: new Date().toISOString(),
    };

    const savedElapsedSeconds = normalizeElapsedSeconds(
      elapsedSeconds,
      attempt.elapsed_seconds ?? 0
    );

    const { error: rpcError } = await supabase.rpc('handle_complete_lateral_attempt', {
      p_attempt_id: attemptId,
      p_user_id: verifiedUid,
      p_quiz_id: attempt.quiz_id,
      p_is_correct: isCorrect,
      p_truth_attempt: newTruthAttempt,
      p_elapsed_seconds: savedElapsedSeconds,
      p_total_questions: attempt.total_questions,
    });

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    return NextResponse.json({ isCorrect, advice: isCorrect ? null : advice });
  } catch (error) {
    console.error('[verify-truth] 予期しないエラー:', error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
