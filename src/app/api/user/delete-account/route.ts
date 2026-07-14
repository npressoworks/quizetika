/**
 * 即時退会API Route
 * POST /api/user/delete-account
 *
 * 対象ユーザーの Stripe サブスクを解約し、データベースの個人情報を匿名化・クレンジングした上で、
 * Supabase Auth からアカウントを物理削除する。
 *
 * Requirements: 1.1, 1.2, 1.3, 5.1, 5.2
 * Boundary: DeleteAccountAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { createAdminClient } from '@/lib/supabase/server';
import { cancelUserSubscription } from '@/services/subscription';
import { cleanUpDeletedUser } from '@/services/user';

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

    // 1. サブスクリプションの解約処理
    try {
      await cancelUserSubscription(uid);
    } catch (subError) {
      console.error(`[delete-account] サブスクリプションの解約に失敗しました (ユーザーUID: ${uid}):`, subError);
    }

    // Admin Client の作成
    const supabase = createAdminClient();

    // 2. データベースのクレンジングおよび匿名化処理の実行
    try {
      await cleanUpDeletedUser(supabase, uid);
    } catch (dbError) {
      console.error(`[delete-account] データベースのクレンジングに失敗しました (ユーザーUID: ${uid}):`, dbError);
      throw dbError; // Auth削除を実行させないためにエラーをスロー
    }

    // 3. Supabase Auth からアカウントを物理削除
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(uid);
      if (authError) {
        throw authError;
      }
    } catch (authError) {
      console.error(`[delete-account] Supabase Auth からのユーザー削除に失敗しました (ユーザーUID: ${uid}):`, authError);
      return NextResponse.json({ error: 'auth-deletion-failed', message: '認証情報の削除に失敗しました。' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[delete-account] 予期しないエラー:', error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
