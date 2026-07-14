import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { createAdminClient } from '@/lib/supabase/server';
import {
  changeSubscriptionPlan,
  NoActiveSubscriptionError,
  SamePlanError,
  UserNotFoundError,
} from '@/services/subscription';

/**
 * POST /api/billing/change-plan
 * 有料プラン（player <-> creator）の契約プラン変更（アップグレード／ダウングレード）を実行する
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
        { error: 'forbidden', message: 'アカウントが制限されているため操作を実行できません。' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { targetPlan } = body as { targetPlan?: string };

    if (targetPlan !== 'player' && targetPlan !== 'creator') {
      return NextResponse.json(
        { error: 'invalid-params', message: 'targetPlan は player または creator を指定してください。' },
        { status: 400 }
      );
    }

    const newTier = await changeSubscriptionPlan(uid, targetPlan as 'player' | 'creator');

    return NextResponse.json({ subscriptionTier: newTier }, { status: 200 });
  } catch (error) {
    if (error instanceof NoActiveSubscriptionError) {
      return NextResponse.json(
        { error: 'no-active-subscription', message: error.message },
        { status: 403 }
      );
    }
    if (error instanceof SamePlanError) {
      return NextResponse.json(
        { error: 'same-plan', message: error.message },
        { status: 400 }
      );
    }
    if (error instanceof UserNotFoundError) {
      return NextResponse.json(
        { error: 'not-found', message: error.message },
        { status: 404 }
      );
    }

    console.error('[API/billing/change-plan] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
