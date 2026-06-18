import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { validateGenreIconFile } from '@/lib/genre-icon-upload';

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

    // 保存先ディレクトリの準備
    const tempDir = path.join(process.cwd(), 'assets', 'genre', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 拡張子の解決
    let ext = '.png';
    if (file.type === 'image/jpeg') {
      ext = '.jpg';
    } else if (file.type === 'image/gif') {
      ext = '.gif';
    }

    // 安全な一意ファイル名の決定 (トラバーサル攻撃防御)
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `temp_icon_${timestamp}_${randomStr}${ext}`;
    const destPath = path.join(tempDir, filename);

    // バッファに変換して書き込み
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(destPath, fileBuffer);

    const tempUrl = `/api/assets/genre/temp/${filename}`;

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
