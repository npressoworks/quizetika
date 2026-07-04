import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { createAdminClient } from '@/lib/supabase/server';
import {
  createPortalSession,
  NoActiveSubscriptionError,
  UserNotFoundError,
} from '@/services/subscription';

/**
 * POST /api/billing/portal-session
 * 有料契約中ユーザー向け Stripe Customer Portal Session を発行する
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = extractBearerToken(request);
    const uid = await verifySupabaseAccessToken(token);

    if (!uid) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗したか、無効なトークンです。' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const { data: userData } = await supabase
      .from('users')
      .select('is_banned')
      .eq('id', uid)
      .maybeSingle();

    if (!userData) {
      return NextResponse.json(
        { error: 'not-found', message: 'ユーザーが見つかりません。' },
        { status: 404 }
      );
    }

    if (userData.is_banned === true) {
      return NextResponse.json(
        { error: 'forbidden', message: 'アカウントが制限されているため契約管理にアクセスできません。' },
        { status: 403 }
      );
    }

    const result = await createPortalSession({ uid });
    return NextResponse.json({ sessionUrl: result.sessionUrl }, { status: 200 });
  } catch (error) {
    if (error instanceof NoActiveSubscriptionError) {
      return NextResponse.json(
        { error: 'no-subscription', message: error.message },
        { status: 404 }
      );
    }
    if (error instanceof UserNotFoundError) {
      return NextResponse.json(
        { error: 'not-found', message: error.message },
        { status: 404 }
      );
    }

    console.error('[API/billing/portal-session] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
