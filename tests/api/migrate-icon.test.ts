process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'gs://quizetika-test-bucket';

import { NextRequest } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseAccessToken: jest.fn(),
}));

const mockCopy = jest.fn();
const mockMakePublic = jest.fn();
const mockDelete = jest.fn();
const mockExists = jest.fn();

const mockFile = {
  copy: mockCopy,
  makePublic: mockMakePublic,
  delete: mockDelete,
  exists: mockExists,
};

const mockBucket = {
  name: 'quizetika-test-bucket',
  file: jest.fn((path: string) => ({
    ...mockFile,
    name: path,
  })),
};

jest.mock('@/lib/firebase/admin', () => {
  const mockStorage = {
    bucket: jest.fn(() => mockBucket),
  };
  return {
    getAdminStorage: () => mockStorage,
    getAdminFirestore: () => ({}),
  };
});

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifyFirebaseIdToken = verifySupabaseAccessToken as jest.MockedFunction<
  typeof verifySupabaseAccessToken
>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('@/app/api/genres/migrate-icon/route') as typeof import('@/app/api/genres/migrate-icon/route');

function buildMigrateRequest(body: any): NextRequest {
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
    mockVerifyFirebaseIdToken.mockResolvedValue('user-123');
    mockCopy.mockResolvedValue(undefined);
    mockMakePublic.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    mockExists.mockResolvedValue([true]);
  });

  test('正常系: 一時アセットを正式パスにコピーし、一時ファイルを削除して200 OKと公開URLを返すこと', async () => {
    const payload = {
      tempUrl: 'https://storage.googleapis.com/quizetika-test-bucket/genres/temp/user-123_12345.png',
      genreId: 'new-genre',
      userId: 'user-123',
    };

    const res = await POST(buildMigrateRequest(payload));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.iconImageUrl).toContain('https://storage.googleapis.com/quizetika-test-bucket/genres/new-genre/icon_');

    // コピー元とコピー先の確認
    expect(mockBucket.file).toHaveBeenCalledWith('genres/temp/user-123_12345.png');
    expect(mockBucket.file).toHaveBeenCalledWith(expect.stringMatching(/^genres\/new-genre\/icon_\d+\.png$/));
    expect(mockCopy).toHaveBeenCalledTimes(1);
    expect(mockMakePublic).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  test('異常系: 認証トークンが無効な場合は 401 Unauthorized を返すこと', async () => {
    mockVerifyFirebaseIdToken.mockResolvedValue(null);

    const payload = {
      tempUrl: 'https://storage.googleapis.com/quizetika-test-bucket/genres/temp/user-123_12345.png',
      genreId: 'new-genre',
      userId: 'user-123',
    };

    const res = await POST(buildMigrateRequest(payload));
    expect(res.status).toBe(401);
    expect(mockCopy).not.toHaveBeenCalled();
  });

  test('異常系: 不正なジャンルID形式の場合は 400 Bad Request を返すこと', async () => {
    const payload = {
      tempUrl: 'https://storage.googleapis.com/quizetika-test-bucket/genres/temp/user-123_12345.png',
      genreId: '../invalid-genre',
      userId: 'user-123',
    };

    const res = await POST(buildMigrateRequest(payload));
    expect(res.status).toBe(400);
    expect(mockCopy).not.toHaveBeenCalled();
  });
});
