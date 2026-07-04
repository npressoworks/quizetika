import { NextRequest } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseAccessToken: jest.fn(),
}));

const mockMoveTemporaryGenreIcon = jest.fn();
jest.mock('@/services/storage-admin', () => ({
  moveTemporaryGenreIcon: (...args: unknown[]) => mockMoveTemporaryGenreIcon(...args),
}));

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifySupabaseAccessToken = verifySupabaseAccessToken as jest.MockedFunction<
  typeof verifySupabaseAccessToken
>;

import { POST } from '@/app/api/genres/migrate-icon/route';

function buildMigrateRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/genres/migrate-icon', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
    body: JSON.stringify(body),
  });
}

describe('Migrate Icon API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractBearerToken.mockReturnValue('test-token');
    mockVerifySupabaseAccessToken.mockResolvedValue('user-123');
  });

  test('正常系: moveTemporaryGenreIcon の呼び出しに成功した場合、200と恒久公開URLを返すこと', async () => {
    const permanentUrl = 'https://project.supabase.co/storage/v1/object/public/genres/new-genre/icon_12345.png';
    mockMoveTemporaryGenreIcon.mockResolvedValue(permanentUrl);

    const tempUrl = 'https://project.supabase.co/storage/v1/object/public/genres/temp/user-123_12345.png';
    const res = await POST(
      buildMigrateRequest({ tempUrl, genreId: 'new-genre', userId: 'user-123' })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.iconImageUrl).toBe(permanentUrl);
    expect(mockMoveTemporaryGenreIcon).toHaveBeenCalledWith(tempUrl, 'new-genre');
  });

  test('異常系: 必須パラメータが不足している場合は400 Bad Requestを返すこと', async () => {
    const res = await POST(buildMigrateRequest({ genreId: 'new-genre', userId: 'user-123' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('missing-params');
    expect(mockMoveTemporaryGenreIcon).not.toHaveBeenCalled();
  });

  test('異常系: 不正なジャンルID形式の場合は400 Bad Requestを返すこと', async () => {
    const res = await POST(
      buildMigrateRequest({
        tempUrl: 'https://project.supabase.co/storage/v1/object/public/genres/temp/user-123_12345.png',
        genreId: '../invalid-genre',
        userId: 'user-123',
      })
    );

    expect(res.status).toBe(400);
    expect(mockMoveTemporaryGenreIcon).not.toHaveBeenCalled();
  });

  test('異常系: 認証トークンが無効な場合は401 Unauthorizedを返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue(null);

    const res = await POST(
      buildMigrateRequest({
        tempUrl: 'https://project.supabase.co/storage/v1/object/public/genres/temp/user-123_12345.png',
        genreId: 'new-genre',
        userId: 'user-123',
      })
    );

    expect(res.status).toBe(401);
    expect(mockMoveTemporaryGenreIcon).not.toHaveBeenCalled();
  });

  test('異常系: 移動元URLが不正な一時アイコンURLパターンの場合は400 Bad Requestを返すこと', async () => {
    mockMoveTemporaryGenreIcon.mockRejectedValue(new Error('無効な一時アイコンURLです'));

    const res = await POST(
      buildMigrateRequest({
        tempUrl: 'https://project.supabase.co/storage/v1/object/public/genres/other-dir/test.png',
        genreId: 'new-genre',
        userId: 'user-123',
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('bad-request');
  });

  test('異常系: ストレージ移動処理自体が失敗した場合は500 Internal Server Errorを返すこと', async () => {
    mockMoveTemporaryGenreIcon.mockRejectedValue(new Error('storage move failed'));

    const res = await POST(
      buildMigrateRequest({
        tempUrl: 'https://project.supabase.co/storage/v1/object/public/genres/temp/user-123_12345.png',
        genreId: 'new-genre',
        userId: 'user-123',
      })
    );

    expect(res.status).toBe(500);
  });
});
