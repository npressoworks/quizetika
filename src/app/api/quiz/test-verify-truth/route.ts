/**
 * テストプレイ用 AI真相判定API Route
 * POST /api/quiz/test-verify-truth
 *
 * 作問エディタのテストプレイから、下書きの裏設定・必須エッセンスを直接受け取り、
 * 本番プレイ（/api/attempt/verify-truth）と同一のプロンプト・判定ロジックで合否を返す。
 * attempt には一切記録しない。全クイズ横断の日次AIターン制限のみ消費する
 * （下書きは quiz_id が確定していないため per-quiz カウントは行わない）。
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createAdminClient } from '@/lib/supabase/server';
import {
  buildVerifyTruthPrompt,
  parseTruthVerifyResponse,
  VERIFY_TRUTH_RESPONSE_SCHEMA,
} from '@/services/verify-truth-utils';
import {
  checkAiTurnLimits,
  getTodayJstString,
  readDailyCount,
  FREE_TIER_GLOBAL_DAILY_LIMIT,
} from '@/services/ask-ai-utils';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { resolveUserEntitlements } from '@/services/entitlement';
import type { Database } from '@/lib/supabase/database.types';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

const LIMIT_MESSAGE = `本日の全クイズ横断のAI判定上限（${FREE_TIER_GLOBAL_DAILY_LIMIT}回）に達しました。Pro プランで制限を解除できます。`;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { aiContextDetails, truthKeywords, truthSummary } = body as {
      aiContextDetails: string;
      truthKeywords?: string[];
      truthSummary: string;
    };

    if (!aiContextDetails?.trim() || !truthSummary?.trim()) {
      return NextResponse.json(
        { error: 'missing-params', message: 'aiContextDetails, truthSummary は必須です' },
        { status: 400 }
      );
    }

    if (truthSummary.length > 1000 || aiContextDetails.length > 2000) {
      return NextResponse.json(
        { error: 'too-long', message: '入力が長すぎます' },
        { status: 400 }
      );
    }

    const token = extractBearerToken(request);
    const verifiedUid = await verifySupabaseAccessToken(token);

    if (!verifiedUid) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗しました' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    let hasUnlimitedAiQuestions = false;
    try {
      const entitlements = await resolveUserEntitlements(verifiedUid);
      hasUnlimitedAiQuestions = entitlements.hasUnlimitedAiQuestions;
    } catch (dbErr) {
      console.error('[test-verify-truth] ユーザーエンタイトルメント解決エラー (非致命的):', dbErr);
    }

    const { data: globalRow } = await supabase
      .from('ai_turn_counts_global')
      .select('count, count_date')
      .eq('user_id', verifiedUid)
      .maybeSingle();

    const limitCheck = checkAiTurnLimits({
      perQuizCount: 0,
      globalDailyCount: readDailyCount(globalRow, getTodayJstString()),
      hasUnlimitedAiQuestions,
    });

    if (limitCheck.exceeded) {
      return NextResponse.json(
        { error: 'limit-exceeded', limitType: 'global-daily', message: LIMIT_MESSAGE },
        { status: 429 }
      );
    }

    const prompt = buildVerifyTruthPrompt(
      aiContextDetails,
      truthSummary,
      truthKeywords ?? []
    );

    let isCorrect = false;
    let advice: string | null = null;

    try {
      const result = await genAI.models.generateContent({
        model: process.env.GEMINI_MODEL_ID ?? 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          temperature: 0,
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 3000,
          responseMimeType: 'application/json',
          responseSchema: VERIFY_TRUTH_RESPONSE_SCHEMA,
        },
      });
      const parsed = parseTruthVerifyResponse(result.text ?? '');
      isCorrect = parsed.isCorrect;
      advice = parsed.advice;
    } catch (aiError) {
      console.error('[test-verify-truth] Gemini API エラー:', aiError);
      return NextResponse.json(
        { error: 'ai-error', message: 'AIの判定に失敗しました。しばらく後でもう一度お試しください。' },
        { status: 503 }
      );
    }

    // グローバル日次カウンタのみ消費（p_quiz_id / p_attempt_id / p_history_entry は NULL）
    const { error: turnRpcError } = await supabase.rpc('handle_record_ai_turn', {
      p_attempt_id: null as unknown as string,
      p_user_id: verifiedUid,
      p_quiz_id: null as unknown as string,
      p_history_entry: null as unknown as Database['public']['Functions']['handle_record_ai_turn']['Args']['p_history_entry'],
      p_per_quiz_limit: null as unknown as number,
      p_global_limit: (hasUnlimitedAiQuestions ? null : FREE_TIER_GLOBAL_DAILY_LIMIT) as unknown as number,
    });

    if (turnRpcError) {
      const message = turnRpcError.message ?? '';
      if (message.includes('global-limit-exceeded')) {
        return NextResponse.json(
          { error: 'limit-exceeded', limitType: 'global-daily', message: LIMIT_MESSAGE },
          { status: 429 }
        );
      }
      throw new Error(message);
    }

    return NextResponse.json({ isCorrect, advice: isCorrect ? null : advice });
  } catch (error) {
    console.error('[test-verify-truth] 予期しないエラー:', error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
