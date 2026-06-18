import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebase/auth-verify';
import { usersRef } from '@/lib/firebase/firestore';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { User } from '@/types';

/**
 * 管理者チェック用の共通ヘルパー
 * @returns 実行ユーザーの UID（成功時）、または null（失敗時）
 */
async function authorizeAdmin(request: NextRequest): Promise<string | null> {
  try {
    const token = extractBearerToken(request);
    const executorId = await verifyFirebaseIdToken(token);

    if (!executorId) {
      return null;
    }

    const executorSnap = await getDoc(doc(usersRef, executorId));
    if (!executorSnap.exists()) {
      return null;
    }

    const executor = { ...executorSnap.data(), id: executorId } as User;
    if (!isAdminUser(executor)) {
      return null;
    }

    return executorId;
  } catch (error) {
    console.error('[API/admin/genres] 認可エラー:', error);
    return null;
  }
}

/**
 * 全ジャンル取得API
 * GET /api/admin/genres
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const isAdmin = await authorizeAdmin(request);
    if (!isAdmin) {
      // 認証失敗のトリアージ
      const token = extractBearerToken(request);
      const executorId = token ? await verifyFirebaseIdToken(token) : null;
      if (!executorId) {
        return NextResponse.json(
          { error: 'unauthorized', message: '認証に失敗したか、無効なトークンです。' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'forbidden', message: 'この操作を実行する権限がありません。' },
        { status: 403 }
      );
    }

    const db = getAdminFirestore();
    const snap = await db.collection('metadata_genres').get();
    const genres = snap.docs.map((d) => {
      const data = d.data();
      // Date型に変換してシリアライズ可能な形にする
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt;
      const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt;
      return {
        ...data,
        id: d.id,
        createdAt,
        updatedAt,
      };
    });

    return NextResponse.json(genres, { status: 200 });
  } catch (error) {
    console.error('[API/admin/genres GET] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}

/**
 * ジャンル直接新規登録API
 * POST /api/admin/genres
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const isAdmin = await authorizeAdmin(request);
    if (!isAdmin) {
      const token = extractBearerToken(request);
      const executorId = token ? await verifyFirebaseIdToken(token) : null;
      if (!executorId) {
        return NextResponse.json(
          { error: 'unauthorized', message: '認証に失敗したか、無効なトークンです。' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'forbidden', message: 'この操作を実行する権限がありません。' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { id, displayName, description, iconImageUrl } = body;

    // バリデーション
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'bad-request', message: 'ジャンルIDは必須項目です。' },
        { status: 400 }
      );
    }

    // ID形式チェック: 半角小文字英数字とハイフンのみ
    const idRegex = /^[a-z0-9-]+$/;
    if (!idRegex.test(id)) {
      return NextResponse.json(
        { error: 'bad-request', message: 'ジャンルIDは半角小文字英数字とハイフンのみで入力してください。' },
        { status: 400 }
      );
    }

    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json(
        { error: 'bad-request', message: '表示名は必須項目です。' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const docRef = db.collection('metadata_genres').doc(id);
    const docSnap = await docRef.get();

    // 重複チェック
    if (docSnap.exists) {
      return NextResponse.json(
        { error: 'duplicate-id', message: 'このジャンルIDはすでに登録されています。' },
        { status: 409 }
      );
    }

    const now = new Date();
    const payload = {
      id,
      displayName,
      description: description || '',
      iconImageUrl: iconImageUrl || null,
      canonicalId: null,
      mergedGenreIds: [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(payload);

    return NextResponse.json(
      {
        success: true,
        data: payload,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API/admin/genres POST] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
