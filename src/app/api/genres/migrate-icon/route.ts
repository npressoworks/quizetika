import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import path from 'path';
import { getAdminStorage } from '@/lib/firebase/admin';

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

export const maxDuration = 15;

/**
 * AI生成・アップロード一時画像移行API
 * POST /api/genres/migrate-icon
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const { tempUrl, genreId, userId } = body as {
      tempUrl?: string;
      genreId?: string;
      userId?: string;
    };

    if (!tempUrl || !genreId || !userId) {
      return NextResponse.json(
        { error: 'missing-params', message: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    // ジャンルID形式チェック (ディレクトリトラバーサル防止の一環として厳格な半角小文字英数字ハイフン制限)
    if (!/^[a-z0-9-]+$/.test(genreId)) {
      return NextResponse.json(
        { error: 'bad-request', message: '無効なジャンルIDです' },
        { status: 400 }
      );
    }

    const token = extractBearerToken(request);
    const verifiedUid = await verifySupabaseAccessToken(token);

    if (!verifiedUid || verifiedUid !== userId) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗しました' },
        { status: 401 }
      );
    }

    let bucketName: string;
    try {
      bucketName = resolveBucketName();
    } catch (err) {
      return NextResponse.json(
        { error: 'internal-error', message: 'ストレージの設定が不正です' },
        { status: 500 }
      );
    }

    // 一時画像URLのパスパターン検証
    const tempPrefix = `https://storage.googleapis.com/${bucketName}/genres/temp/`;
    if (!tempUrl.startsWith(tempPrefix)) {
      return NextResponse.json(
        { error: 'bad-request', message: '無効な一時画像URLです' },
        { status: 400 }
      );
    }

    // ファイル名の抽出とサニタイズ
    const tempFilename = tempUrl.substring(tempPrefix.length);
    if (tempFilename.includes('..') || tempFilename.includes('/') || tempFilename.includes('\\')) {
      return NextResponse.json(
        { error: 'bad-request', message: '不正なアセットファイル名が含まれています' },
        { status: 400 }
      );
    }

    const bucket = getAdminStorage().bucket(bucketName);
    const tempFile = bucket.file(`genres/temp/${tempFilename}`);

    // 一時ファイルの存在確認
    const [exists] = await tempFile.exists().catch(() => [false]);
    if (!exists) {
      return NextResponse.json(
        { error: 'not-found', message: '一時画像ファイルが見つかりません' },
        { status: 404 }
      );
    }

    // コピー先ファイル名の決定 (安全なファイル名の自動生成)
    const timestamp = Date.now();
    const ext = path.extname(tempFilename).toLowerCase() || '.png';
    const destFilename = `icon_${timestamp}${ext}`;
    const destFile = bucket.file(`genres/${genreId}/${destFilename}`);

    // ファイルコピーの実行
    await tempFile.copy(destFile);
    await destFile.makePublic();

    const permanentUrl = `https://storage.googleapis.com/${bucketName}/genres/${genreId}/${destFilename}`;

    // 一時ファイルの削除 (非同期かつ安全に削除)
    try {
      await tempFile.delete();
    } catch (unlinkErr) {
      console.error('[API/genres/migrate-icon] 一時ファイルの削除に失敗しました:', unlinkErr);
    }

    return NextResponse.json({
      success: true,
      iconImageUrl: permanentUrl,
    });
  } catch (error) {
    console.error('[API/genres/migrate-icon] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました' },
      { status: 500 }
    );
  }
}
