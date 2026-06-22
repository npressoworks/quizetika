import { NextRequest, NextResponse } from 'next/server';
import { validateGenreIconFile } from '@/lib/genre-icon-upload';
import { uploadTemporaryGenreIconBuffer } from '@/services/storage-admin';

export const maxDuration = 15;

/**
 * 手動選択画像の一時ローカル保存API
 * POST /api/genres/upload-icon
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: 'bad-request', message: 'FormDataが正しくありません。' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json(
        { error: 'bad-request', message: 'ファイルが送信されていません。' },
        { status: 400 }
      );
    }

    // サーバーサイドでのファイル検証 (SEC-08 準拠)
    const validation = validateGenreIconFile(file);
    if (!validation.ok) {
      return NextResponse.json(
        { error: 'bad-request', message: validation.error },
        { status: 400 }
      );
    }

    // バッファに変換して Storage にアップロード
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const tempUrl = await uploadTemporaryGenreIconBuffer(fileBuffer, 'upload');

    return NextResponse.json({
      success: true,
      tempUrl,
    });
  } catch (error) {
    console.error('[API/genres/upload-icon] アップロードエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
