import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { usersRef } from '@/lib/firebase/firestore';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebase/admin';
import { User } from '@/types';

const DEFAULT_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
  process.env.FIREBASE_STORAGE_BUCKET;

function resolveBucketName(): string {
  if (DEFAULT_BUCKET) {
    return DEFAULT_BUCKET.replace(/^gs:\/\//, '');
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (projectId) {
    return `${projectId}.appspot.com`;
  }
  throw new Error('Firebase Storage バケット名が設定されていません');
}

/**
 * 管理者チェック用の共通ヘルパー
 * @returns 実行ユーザーの UID（成功時）、または null（失敗時）
 */
async function authorizeAdmin(request: NextRequest): Promise<string | null> {
  try {
    const token = extractBearerToken(request);
    const executorId = await verifySupabaseAccessToken(token);

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
      const executorId = token ? await verifySupabaseAccessToken(token) : null;
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
      const executorId = token ? await verifySupabaseAccessToken(token) : null;
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

    let finalIconImageUrl = iconImageUrl || null;

    // 一時保存されたアイコン画像（AI生成/手動アップロード）を正式なパスに移行する
    if (finalIconImageUrl && finalIconImageUrl.includes('/genres/temp/')) {
      try {
        const path = await import('path');
        const bucketName = resolveBucketName();

        // URLからファイル名を抽出
        const urlParts = finalIconImageUrl.split('/');
        const tempFilename = urlParts[urlParts.length - 1];

        const bucket = getAdminStorage().bucket(bucketName);
        const tempFile = bucket.file(`genres/temp/${tempFilename}`);

        const [exists] = await tempFile.exists().catch(() => [false]);
        if (exists) {
          const timestamp = Date.now();
          const ext = path.extname(tempFilename).toLowerCase() || '.png';
          const destFilename = `icon_${timestamp}${ext}`;
          const destFile = bucket.file(`genres/${id}/${destFilename}`);

          // コピーの実行
          await tempFile.copy(destFile);
          await destFile.makePublic();

          finalIconImageUrl = `https://storage.googleapis.com/${bucketName}/genres/${id}/${destFilename}`;

          // 元のファイルを削除
          try {
            await tempFile.delete();
          } catch (unlinkErr) {
            console.error('[API/admin/genres] 一時ファイルの削除に失敗しました:', unlinkErr);
          }
        }
      } catch (copyError) {
        console.error('[API/admin/genres] アイコン画像移行処理エラー:', copyError);
      }
    }

    const now = new Date();
    const payload = {
      id,
      displayName,
      description: description || '',
      iconImageUrl: finalIconImageUrl,
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
