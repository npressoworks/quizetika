import { NextRequest } from 'next/server';

const mockUploadTemporaryGenreIconBuffer = jest.fn();
jest.mock('@/services/storage-admin', () => ({
  uploadTemporaryGenreIconBuffer: mockUploadTemporaryGenreIconBuffer,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('@/app/api/genres/upload-icon/route') as typeof import('@/app/api/genres/upload-icon/route');

describe('Upload Icon API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildUploadRequest(fileName: string, mimeType: string, content: string | Buffer): NextRequest {
    const blob = new Blob([content as any], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, fileName);

    return new NextRequest('http://localhost/api/genres/upload-icon', {
      method: 'POST',
      body: formData,
    });
  }

  test('正常系: 正しいPNG形式画像をアップロードした際、200 OK と一時URLを返すこと', async () => {
    const mockUrl = 'https://storage.googleapis.com/quizetika-test-bucket/genres/temp/upload_12345.png';
    mockUploadTemporaryGenreIconBuffer.mockResolvedValue(mockUrl);

    const req = buildUploadRequest('test.png', 'image/png', 'dummy png content');
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tempUrl).toBe(mockUrl);

    expect(mockUploadTemporaryGenreIconBuffer).toHaveBeenCalledTimes(1);
    const bufferArg = mockUploadTemporaryGenreIconBuffer.mock.calls[0][0];
    expect(bufferArg.toString()).toBe('dummy png content');
  });

  test('異常系: SVG形式が送られた場合は 400 Bad Request で拒否すること', async () => {
    const req = buildUploadRequest('malicious.svg', 'image/svg+xml', '<svg>XSS</svg>');
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('bad-request');
    expect(body.message).toContain('PNG, JPEG, GIF');
    expect(mockUploadTemporaryGenreIconBuffer).not.toHaveBeenCalled();
  });

  test('異常系: 2MBを超える画像ファイルは 400 Bad Request で拒否すること', async () => {
    const largeBuffer = Buffer.alloc(2.1 * 1024 * 1024);
    const req = buildUploadRequest('huge.png', 'image/png', largeBuffer);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('bad-request');
    expect(body.message).toContain('2MB');
    expect(mockUploadTemporaryGenreIconBuffer).not.toHaveBeenCalled();
  });
});
