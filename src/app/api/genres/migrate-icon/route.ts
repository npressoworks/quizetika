import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { moveTemporaryGenreIcon } from '@/services/storage-admin';

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

    let permanentUrl: string;
    try {
      permanentUrl = await moveTemporaryGenreIcon(tempUrl, genreId);
    } catch (moveError) {
      const message = moveError instanceof Error ? moveError.message : String(moveError);
      if (message === '無効な一時アイコンURLです') {
        return NextResponse.json(
          { error: 'bad-request', message: '無効な一時画像URLです' },
          { status: 400 }
        );
      }
      console.error('[API/genres/migrate-icon] アイコン移動に失敗しました:', moveError);
      return NextResponse.json(
        { error: 'internal-error', message: 'アイコンの移動に失敗しました' },
        { status: 500 }
      );
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
