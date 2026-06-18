import { POST as generateIconPOST } from '@/app/api/genres/generate-icon/route';
import { POST as migrateIconPOST } from '@/app/api/genres/migrate-icon/route';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

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
  runTransaction: (...args: any[]) => mockRunTransaction(...args),
};

jest.mock('@/lib/firebase/auth-verify', () => ({
  extractBearerToken: () => 'valid-token',
  verifyFirebaseIdToken: (...args: any[]) => mockVerify(...args),
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: (...args: any[]) => mockGenerateContent(...args),
    },
  })),
}));

jest.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: () => mockDb,
}));

jest.mock('@/services/ai-authoring-utils', () => {
  const actual = jest.requireActual('@/services/ai-authoring-utils');
  return {
    ...actual,
    getJstTodayString: () => '2026-06-18',
  };
});

describe('AI Genre Icon API Suite', () => {
  const tempDir = path.join(process.cwd(), 'assets', 'genre', 'temp');
  const targetDir = path.join(process.cwd(), 'assets', 'genre', 'japanese-history');

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

  afterEach(() => {
    // ディレクトリのクレンジング
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          fs.unlinkSync(path.join(tempDir, file));
        }
      }
      if (fs.existsSync(targetDir)) {
        const files = fs.readdirSync(targetDir);
        for (const file of files) {
          fs.unlinkSync(path.join(targetDir, file));
        }
        fs.rmdirSync(targetDir);
      }
    } catch (err) {
      console.error('クレンジングエラー:', err);
    }
  });

  describe('POST /api/genres/generate-icon', () => {
    function makeRequest(body: Record<string, any>) {
      return new NextRequest('http://localhost/api/genres/generate-icon', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    test('正常系: 一般ユーザーが画像生成に成功し、URLとリミットを返す', async () => {
      // NOTE: このテストは現在 11.1 未完了のため RED になる可能性があります。
      const res = await generateIconPOST(
        makeRequest({
          displayName: '日本の歴史',
          description: '日本の歴史に関するクイズジャンル',
          userId: 'uid-user',
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.iconImageUrl).toContain('/api/assets/genre/temp/');
      expect(body.usage).toEqual({
        limit: 5,
        usedToday: 1,
        remainingToday: 4,
      });

      // 実ファイルが存在しているか検証
      const tempFileName = body.iconImageUrl.split('/').pop();
      const savedFilePath = path.join(tempDir, tempFileName);
      expect(fs.existsSync(savedFilePath)).toBe(true);
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
      // 一時ファイルの準備
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempFileName = 'temp_icon_test_123.png';
      const tempFilePath = path.join(tempDir, tempFileName);
      fs.writeFileSync(tempFilePath, 'dummy image data');

      const res = await migrateIconPOST(
        makeRequest({
          tempUrl: `/api/assets/genre/temp/${tempFileName}`,
          genreId: 'japanese-history',
          userId: 'uid-user',
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.iconImageUrl).toContain('/api/assets/genre/japanese-history/icon_');

      // コピー先のファイル確認
      const destFileName = body.iconImageUrl.split('/').pop();
      const savedFilePath = path.join(targetDir, destFileName);
      expect(fs.existsSync(savedFilePath)).toBe(true);
      expect(fs.readFileSync(savedFilePath, 'utf-8')).toBe('dummy image data');

      // 一時ファイルが削除されていることを確認
      expect(fs.existsSync(tempFilePath)).toBe(false);
    });

    test('異常系: コピー元ファイルが見つからない場合は404', async () => {
      const res = await migrateIconPOST(
        makeRequest({
          tempUrl: '/api/assets/genre/temp/non-existent-file.png',
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
          tempUrl: '/api/assets/genre/other-dir/test.png',
          genreId: 'japanese-history',
          userId: 'uid-user',
        })
      );

      expect(res.status).toBe(400);
    });
  });
});
