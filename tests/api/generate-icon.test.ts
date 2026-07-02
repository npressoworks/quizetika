process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'gs://quizetika-test-bucket';

import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockGenerateContent = jest.fn();

const mockUserRef = {
  get: jest.fn(),
};

const mockLimitRef = {
  get: jest.fn(),
};

const mockRunTransaction = jest.fn(async (fn: (tx: any) => Promise<any>) => {
  const mockTx = {
    get: jest.fn(async (ref: any) => {
      return ref.get();
    }),
    set: jest.fn(),
  };
  return await fn(mockTx);
});

const mockDb = {
  collection: jest.fn((name: string) => {
    if (name === 'users') {
      return {
        doc: jest.fn((uid: string) => ({
          get: () => mockUserRef.get(),
          collection: jest.fn((sub: string) => {
            if (sub === 'authoring_limits') {
              return {
                doc: jest.fn((docId: string) => {
                  if (docId === 'genre-icon') {
                    return mockLimitRef;
                  }
                  return { get: jest.fn() };
                }),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };
    }
    return { doc: jest.fn() };
  }),
  runTransaction: (updateFn: any) => mockRunTransaction(updateFn),
};

const mockExists = jest.fn();
const mockCopy = jest.fn();
const mockMakePublic = jest.fn();
const mockDelete = jest.fn();

const mockFile = {
  exists: () => mockExists(),
  copy: (dest: any) => mockCopy(dest),
  makePublic: () => mockMakePublic(),
  delete: () => mockDelete(),
};

const mockBucket = {
  name: 'quizetika-test-bucket',
  file: jest.fn(() => mockFile),
};

const mockStorage = {
  bucket: jest.fn(() => mockBucket),
};

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'valid-token',
  verifySupabaseAccessToken: (token: any) => mockVerify(token),
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: (options: any) => mockGenerateContent(options),
    },
  })),
}));

jest.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: () => mockDb,
  getAdminStorage: () => mockStorage,
}));

const mockUploadTemporaryGenreIconBuffer = jest.fn();
jest.mock('@/services/storage-admin', () => ({
  uploadTemporaryGenreIconBuffer: mockUploadTemporaryGenreIconBuffer,
}));

jest.mock('@/services/ai-authoring-utils', () => {
  const actual = jest.requireActual('@/services/ai-authoring-utils');
  return {
    ...actual,
    getJstTodayString: () => '2026-06-18',
  };
});

// モック定義の後にインポートする
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST: generateIconPOST } = require('@/app/api/genres/generate-icon/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST: migrateIconPOST } = require('@/app/api/genres/migrate-icon/route');

describe('AI Genre Icon API Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue('uid-user');
    mockUserRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'user', moderationTier: 'none' }),
    });
    mockLimitRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ count: 0, lastUpdatedDate: '2026-06-18' }),
    });
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data: Buffer.from('png-data').toString('base64'), mimeType: 'image/png' } }],
          },
        },
      ],
    });
  });

  describe('POST /api/genres/generate-icon', () => {
    function makeRequest(body: Record<string, any>) {
      return new NextRequest('http://localhost/api/genres/generate-icon', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    test('正常系: 一般ユーザーが画像生成に成功し、URLとリミットを返す', async () => {
      const mockUrl = 'https://storage.googleapis.com/quizetika-test-bucket/genres/temp/uid-user_12345.png';
      mockUploadTemporaryGenreIconBuffer.mockResolvedValue(mockUrl);

      const res = await generateIconPOST(
        makeRequest({
          displayName: '日本の歴史',
          description: '日本の歴史に関するクイズジャンル',
          userId: 'uid-user',
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.iconImageUrl).toBe(mockUrl);
      expect(body.usage).toEqual({
        limit: 5,
        usedToday: 1,
        remainingToday: 4,
      });

      expect(mockUploadTemporaryGenreIconBuffer).toHaveBeenCalledTimes(1);
    });

    test('バリデーションエラー: displayNameまたはdescriptionがない場合は400', async () => {
      const res = await generateIconPOST(
        makeRequest({
          displayName: '',
          description: '説明文',
          userId: 'uid-user',
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('missing-params');
    });

    test('制限エラー: 1日5回の上限に達した一般ユーザーは429', async () => {
      mockLimitRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ count: 5, lastUpdatedDate: '2026-06-18' }),
      });

      const res = await generateIconPOST(
        makeRequest({
          displayName: '歴史',
          description: '説明文',
          userId: 'uid-user',
        })
      );
      expect(res.status).toBe(429);
    });
  });

  describe('POST /api/genres/migrate-icon', () => {
    function makeRequest(body: Record<string, any>) {
      return new NextRequest('http://localhost/api/genres/migrate-icon', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    test('正常系: コピー元が存在する場合にコピーが走り、正式なパスのURLを返すこと', async () => {
      mockExists.mockResolvedValue([true]);
      mockCopy.mockResolvedValue(undefined);
      mockMakePublic.mockResolvedValue(undefined);
      mockDelete.mockResolvedValue(undefined);

      const tempFileName = 'uid-user_12345.png';
      const tempUrl = `https://storage.googleapis.com/quizetika-test-bucket/genres/temp/${tempFileName}`;

      const res = await migrateIconPOST(
        makeRequest({
          tempUrl,
          genreId: 'japanese-history',
          userId: 'uid-user',
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.iconImageUrl).toContain('https://storage.googleapis.com/quizetika-test-bucket/genres/japanese-history/icon_');

      expect(mockBucket.file).toHaveBeenCalledWith(`genres/temp/${tempFileName}`);
      expect(mockExists).toHaveBeenCalledTimes(1);
      expect(mockCopy).toHaveBeenCalledTimes(1);
      expect(mockMakePublic).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    test('異常系: コピー元ファイルが見つからない場合は404', async () => {
      mockExists.mockResolvedValue([false]);

      const tempFileName = 'non-existent-file.png';
      const tempUrl = `https://storage.googleapis.com/quizetika-test-bucket/genres/temp/${tempFileName}`;

      const res = await migrateIconPOST(
        makeRequest({
          tempUrl,
          genreId: 'japanese-history',
          userId: 'uid-user',
        })
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('not-found');
    });

    test('異常系: 一時保存パスではないURLの場合は400', async () => {
      const res = await migrateIconPOST(
        makeRequest({
          tempUrl: 'https://storage.googleapis.com/quizetika-test-bucket/genres/other-dir/test.png',
          genreId: 'japanese-history',
          userId: 'uid-user',
        })
      );

      expect(res.status).toBe(400);
    });
  });
});

