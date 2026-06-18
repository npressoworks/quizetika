import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// テスト対象APIの遅延ロード
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('@/app/api/genres/upload-icon/route') as typeof import('@/app/api/genres/upload-icon/route');

describe('Upload Icon API Route', () => {
  const tempDir = path.join(process.cwd(), 'assets', 'genre', 'temp');

  afterEach(() => {
    // temp ディレクトリ内のテストファイルをクレンジング
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          fs.unlinkSync(path.join(tempDir, file));
        }
      }
    } catch (err) {
      console.error('クレンジングエラー:', err);
    }
  });

  function buildUploadRequest(fileName: string, mimeType: string, content: string | Buffer): NextRequest {
    const blob = new Blob([content], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, fileName);

    return new NextRequest('http://localhost/api/genres/upload-icon', {
      method: 'POST',
      body: formData,
    });
  }

  test('正常系: 正しいPNG形式画像をアップロードした際、200 OK と一時URLを返すこと', async () => {
    const req = buildUploadRequest('test.png', 'image/png', 'dummy png content');
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tempUrl).toContain('/api/assets/genre/temp/');

    // 保存された実ファイルの存在確認
    const tempFileName = body.tempUrl.split('/').pop();
    const savedFilePath = path.join(tempDir, tempFileName);
    expect(fs.existsSync(savedFilePath)).toBe(true);
    expect(fs.readFileSync(savedFilePath, 'utf-8')).toBe('dummy png content');
  });

  test('異常系: SVG形式が送られた場合は 400 Bad Request で拒否すること', async () => {
    const req = buildUploadRequest('malicious.svg', 'image/svg+xml', '<svg>XSS</svg>');
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('bad-request');
    expect(body.message).toContain('PNG, JPEG, GIF');
  });

  test('異常系: 2MBを超える画像ファイルは 400 Bad Request で拒否すること', async () => {
    // 2.1MBのダミーバッファ
    const largeBuffer = Buffer.alloc(2.1 * 1024 * 1024);
    const req = buildUploadRequest('huge.png', 'image/png', largeBuffer);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('bad-request');
    expect(body.message).toContain('2MB');
  });
});
