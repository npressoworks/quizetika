/**
 * 即時退会API Route
 * POST /api/user/delete-account
 *
 * 対象ユーザーの users.delete_status を Supabase サーバークライアント（Admin）で
 * 'delete_pending' に更新する。ユーザーコンテンツの匿名化やアカウントの物理削除
 * （Supabase Auth 側では supabase.auth.admin.deleteUser 相当）は本APIの対象外とし、
 * 別途の非同期クレンジング処理に委ねる。
 *
 * Requirements: 5.1, 5.2
 * Boundary: DeleteAccountAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { uid } = body as { uid: string };

    if (!uid) {
      return NextResponse.json({ error: 'missing-uid' }, { status: 400 });
    }

    // Authorization ヘッダーから アクセストークンを抽出し検証
    const token = extractBearerToken(request);
    const verifiedUid = await verifySupabaseAccessToken(token);

    if (!verifiedUid || verifiedUid !== uid) {
      console.warn(`[delete-account] 認証に失敗しました。要求UID: ${uid}, 検証UID: ${verifiedUid}`);
      return NextResponse.json({ error: 'unauthorized', message: '認証に失敗したか、権限がありません。' }, { status: 401 });
    }

    // delete_status を delete_pending に設定（第三者からの読み取りを即時ブロック）
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('users')
      .update({ delete_status: 'delete_pending', updated_at: new Date().toISOString() })
      .eq('id', uid);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[delete-account] 予期しないエラー:', error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
