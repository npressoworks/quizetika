import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebase/auth-verify';
import { getAdminFirestore } from '@/lib/firebase/admin';
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

    const userData = userSnap.data() as { isBanned?: boolean };
    if (userData.isBanned === true) {
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
