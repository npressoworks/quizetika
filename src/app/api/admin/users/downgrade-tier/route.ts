import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { downgradeUserTier, type ModerationTier } from '@/services/reputation';

const ALLOWED_TIERS: ModerationTier[] = ['newcomer', 'contributor', 'moderator', 'senior_moderator'];

/**
 * 管理者用ユーザーティア引き下げ処理API
 * POST /api/admin/users/downgrade-tier
 *
 * リクエストボディ:
 * - targetUid: string (対象ユーザーUID)
 * - newTier: ModerationTier (引き下げ先のティア、現在のティアより下位である必要がある)
 * - reason: string (引き下げ理由、10文字以上)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = extractBearerToken(request);
    const executorId = await verifySupabaseAccessToken(token);

    if (!executorId) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗したか、無効なトークンです。' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { targetUid, newTier, reason } = body as {
      targetUid: string;
      newTier: ModerationTier;
      reason: string;
    };

    if (!targetUid || typeof targetUid !== 'string') {
      return NextResponse.json(
        { error: 'invalid-params', message: '対象ユーザーのUID(targetUid)は必須です。' },
        { status: 400 }
      );
    }

    if (!newTier || typeof newTier !== 'string' || !ALLOWED_TIERS.includes(newTier)) {
      return NextResponse.json(
        { error: 'invalid-params', message: '引き下げ先のティア(newTier)が不正です。' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        { error: 'invalid-params', message: 'ティア引き下げ理由(reason)は必須です。' },
        { status: 400 }
      );
    }

    if (reason.length < 10) {
      return NextResponse.json(
        { error: 'invalid-params', message: 'ティア引き下げ理由は10文字以上で入力してください。' },
        { status: 400 }
      );
    }

    await downgradeUserTier(targetUid, executorId, newTier, reason);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[API/admin/users/downgrade-tier] 予期しないエラー:', error);

    const message = error instanceof Error ? error.message : '';
    if (message.includes('権限がありません')) {
      return NextResponse.json(
        { error: 'forbidden', message: 'この操作を実行する権限がありません。' },
        { status: 403 }
      );
    }
    if (message.includes('見つかりません')) {
      return NextResponse.json(
        { error: 'not-found', message: '対象のユーザーが見つかりません。' },
        { status: 404 }
      );
    }
    if (message.includes('現在のティアより下位')) {
      return NextResponse.json(
        {
          error: 'invalid-tier-downgrade',
          message: '引き下げ先のティアは現在のティアより下位である必要があります。',
        },
        { status: 409 }
      );
    }
    if (message.includes('10文字以上')) {
      return NextResponse.json(
        { error: 'invalid-params', message: 'ティア引き下げ理由は10文字以上で入力してください。' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
