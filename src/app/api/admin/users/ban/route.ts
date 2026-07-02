import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { banUser } from '@/services/reputation';

/**
 * 管理者用ユーザーBAN処理API
 * POST /api/admin/users/ban
 *
 * リクエストボディ:
 * - targetUid: string (対象ユーザーUID)
 * - reason: string (BAN理由、10文字以上)
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
    const { targetUid, reason } = body as {
      targetUid: string;
      reason: string;
    };

    if (!targetUid || typeof targetUid !== 'string') {
      return NextResponse.json(
        { error: 'invalid-params', message: '対象ユーザーのUID(targetUid)は必須です。' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        { error: 'invalid-params', message: 'BAN理由(reason)は必須です。' },
        { status: 400 }
      );
    }

    if (reason.length < 10) {
      return NextResponse.json(
        { error: 'invalid-params', message: 'BAN理由は10文字以上で入力してください。' },
        { status: 400 }
      );
    }

    await banUser(targetUid, executorId, reason);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[API/admin/users/ban] 予期しないエラー:', error);

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
    if (message.includes('10文字以上')) {
      return NextResponse.json(
        { error: 'invalid-params', message: 'BAN理由は10文字以上で入力してください。' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
