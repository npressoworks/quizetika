import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebase/auth-verify';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  AlreadySubscribedError,
  createCheckoutSession,
  UserNotFoundError,
} from '@/services/subscription';
import type { PriceInterval } from '@/types/subscription';

/**
 * POST /api/billing/checkout-session
 * 認証済み無料ユーザー向け Stripe Checkout Session を発行する
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = extractBearerToken(request);
    const uid = await verifyFirebaseIdToken(token);

    if (!uid) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗したか、無効なトークンです。' },
        { status: 401 }
      );
    }

    const db = getAdminFirestore();
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json(
        { error: 'not-found', message: 'ユーザーが見つかりません。' },
        { status: 404 }
      );
    }

    const userData = userSnap.data() as { isBanned?: boolean; email?: string };
    if (userData.isBanned === true) {
      return NextResponse.json(
        { error: 'forbidden', message: 'アカウントが制限されているため購読を開始できません。' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { priceInterval } = body as { priceInterval?: string };

    if (priceInterval !== 'monthly' && priceInterval !== 'yearly') {
      return NextResponse.json(
        { error: 'invalid-params', message: 'priceInterval は monthly または yearly を指定してください。' },
        { status: 400 }
      );
    }

    const email = userData.email?.trim();
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
    });

    return NextResponse.json({ sessionUrl: result.sessionUrl }, { status: 200 });
  } catch (error) {
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
