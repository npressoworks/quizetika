import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { usersRef } from '@/lib/firebase/firestore';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { seedInitialGenresWithAdmin } from '@/services/seedInitialGenresAdmin';
import { User } from '@/types';

/**
 * 初期ジャンル一括投入API
 * POST /api/admin/seed-genres
 *
 * Firebase Admin SDK で metadata_genres へ書き込む（クライアント Rules に依存しない）
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

    const executorSnap = await getDoc(doc(usersRef, executorId));
    if (!executorSnap.exists()) {
      return NextResponse.json(
        { error: 'forbidden', message: 'この操作を実行する権限がありません。' },
        { status: 403 }
      );
    }

    const executor = { ...executorSnap.data(), id: executorId } as User;
    if (!isAdminUser(executor)) {
      return NextResponse.json(
        { error: 'forbidden', message: 'この操作を実行する権限がありません。' },
        { status: 403 }
      );
    }

    const result = await seedInitialGenresWithAdmin();

    return NextResponse.json(
      {
        success: true,
        added: result.added,
        updated: result.updated,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API/admin/seed-genres] 予期しないエラー:', error);

    const message = error instanceof Error ? error.message : '';
    if (message.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
      return NextResponse.json(
        {
          error: 'admin-not-configured',
          message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
