import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebase/auth-verify';
import fs from 'fs';
import path from 'path';

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
    const verifiedUid = await verifyFirebaseIdToken(token, userId);

    if (!verifiedUid || verifiedUid !== userId) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗しました' },
        { status: 401 }
      );
    }

    // 一時画像URLのパスパターン検証
    const tempPrefix = '/api/assets/genre/temp/';
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

    // 実ファイルのパス解決
    const tempDir = path.join(process.cwd(), 'assets', 'genre', 'temp');
    const tempFilePath = path.join(tempDir, tempFilename);

    // 一時ファイルの存在確認
    if (!fs.existsSync(tempFilePath)) {
      return NextResponse.json(
        { error: 'not-found', message: '一時画像ファイルが見つかりません' },
        { status: 404 }
      );
    }

    // コピー先の準備
    const destDir = path.join(process.cwd(), 'assets', 'genre', genreId);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // コピー先ファイル名の決定 (安全なファイル名の自動生成)
    const timestamp = Date.now();
    const ext = path.extname(tempFilename).toLowerCase() || '.png';
    const destFilename = `icon_${timestamp}${ext}`;
    const destFilePath = path.join(destDir, destFilename);

    // ファイルコピーの実行
    fs.copyFileSync(tempFilePath, destFilePath);

    const permanentUrl = `/api/assets/genre/${genreId}/${destFilename}`;

    // 一時ファイルの削除 (非同期ではなく同期的かつ安全に削除)
    try {
      fs.unlinkSync(tempFilePath);
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
