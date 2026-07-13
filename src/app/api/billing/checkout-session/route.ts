import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { createAdminClient } from '@/lib/supabase/server';
import {
  AlreadySubscribedError,
  createCheckoutSession,
  UserNotFoundError,
  DowngradeNotAllowedError,
} from '@/services/subscription';
import type { PriceInterval } from '@/types/subscription';

/**
 * POST /api/billing/checkout-session
 * 認証済み無料ユーザー向け Stripe Checkout Session を発行する
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
      .select('is_banned, email')
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
        { error: 'forbidden', message: 'アカウントが制限されているため購読を開始できません。' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { priceInterval, plan } = body as { priceInterval?: string; plan?: string };

    if (priceInterval !== 'monthly' && priceInterval !== 'yearly') {
      return NextResponse.json(
        { error: 'invalid-params', message: 'priceInterval は monthly または yearly を指定してください。' },
        { status: 400 }
      );
    }

    if (plan !== 'player' && plan !== 'creator') {
      return NextResponse.json(
        { error: 'invalid-params', message: 'plan は player または creator を指定してください。' },
        { status: 400 }
      );
    }

    const email = userData.email?.trim?.() ?? undefined;
    if (!email) {
      return NextResponse.json(
        { error: 'invalid-params', message: 'ユーザーのメールアドレスが設定されていません。' },
        { status: 400 }
      );
    }

    const result = await createCheckoutSession({
      uid,
      email,
      priceInterval: priceInterval as PriceInterval,
      plan: plan as 'player' | 'creator',
    });

    return NextResponse.json({ sessionUrl: result.sessionUrl }, { status: 200 });
  } catch (error) {
    if (error instanceof DowngradeNotAllowedError) {
      return NextResponse.json(
        { error: 'downgrade-not-allowed', message: error.message },
        { status: 409 }
      );
    }
    if (error instanceof AlreadySubscribedError) {
      return NextResponse.json(
        { error: 'already-subscribed', message: error.message },
        { status: 409 }
      );
    }
    if (error instanceof UserNotFoundError) {
      return NextResponse.json(
        { error: 'not-found', message: error.message },
        { status: 404 }
      );
    }

    console.error('[API/billing/checkout-session] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
