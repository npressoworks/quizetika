import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebase/auth-verify';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebase/admin';

export const maxDuration = 15;

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

    // ジャンルID形式チェック
    if (!/^[a-z0-9-]+$/.test(genreId)) {
      return NextResponse.json(
        { error: 'bad-request', message: '無効なジャンルIDです' },
        { status: 400 }
      );
    }

    const token = extractBearerToken(request);
    const verifiedUid = await verifyFirebaseIdToken(token, userId);

    if (!verifiedUid || verifiedUid !== userId) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗しました' },
        { status: 401 }
      );
    }

    const bucket = getAdminStorage().bucket();
    const bucketPrefix = `https://storage.googleapis.com/${bucket.name}/`;

    if (!tempUrl.startsWith(bucketPrefix) || !tempUrl.includes('temp/genre-icons/')) {
      return NextResponse.json(
        { error: 'bad-request', message: '無効な一時画像URLです' },
        { status: 400 }
      );
    }

    const tempPath = tempUrl.replace(bucketPrefix, '');
    const timestamp = Date.now();
    const destPath = `genres/${genreId}/icon_${timestamp}.png`;

    const tempFile = bucket.file(tempPath);
    const destFile = bucket.file(destPath);

    // 一時ファイルの存在確認
    const [exists] = await tempFile.exists();
    if (!exists) {
      return NextResponse.json(
        { error: 'not-found', message: '一時画像ファイルが見つかりません' },
        { status: 404 }
      );
    }

    // コピーの実行
    await tempFile.copy(destFile);
    await destFile.makePublic();

    const permanentUrl = `https://storage.googleapis.com/${bucket.name}/${destPath}`;

    // 一時ファイルの非同期削除
    await tempFile.delete().catch((err) => {
      console.error('[API/genres/migrate-icon] 一時ファイル削除失敗:', err);
    });

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
