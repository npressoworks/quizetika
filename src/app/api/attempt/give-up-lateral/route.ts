/**
 * 水平思考クイズ諦め API
 * POST /api/attempt/give-up-lateral
 *
 * Phase 17: attempt を不合格完了として記録する（真相・解説は返却しない）
 * Supabase 正規化対応: handle_give_up_lateral_attempt RPC を呼び出す
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { normalizeElapsedSeconds } from '@/lib/format-play-elapsed';
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

    const savedElapsedSeconds = normalizeElapsedSeconds(
      elapsedSeconds,
      attempt.elapsed_seconds ?? 0
    );

    const { error: rpcError } = await supabase.rpc('handle_give_up_lateral_attempt', {
      p_attempt_id: attemptId,
      p_quiz_id: attempt.quiz_id,
      p_elapsed_seconds: savedElapsedSeconds,
    });

    if (rpcError) {
      if (rpcError.message?.includes('already-completed')) {
        return NextResponse.json(
          { error: 'already-completed', message: 'このプレイは既に完了しています' },
          { status: 409 }
        );
      }
      throw new Error(rpcError.message);
    }

    return NextResponse.json({ completed: true });
  } catch (error) {
    console.error('[give-up-lateral] 予期しないエラー:', error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
