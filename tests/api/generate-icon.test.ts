import { POST } from '@/app/api/genres/generate-icon/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockGenerateContent = jest.fn();
const mockUpload = jest.fn();

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

jest.mock('@/services/storage-admin', () => ({
  uploadTemporaryGenreIconBuffer: (...args: any[]) => mockUpload(...args),
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

describe('POST /api/genres/generate-icon', () => {
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
    mockUpload.mockResolvedValue('https://storage.googleapis.com/bucket/temp/genre-icons/uid-user_123.png');
  });

  function makeRequest(body: Record<string, any>) {
    return new NextRequest('http://localhost/api/genres/generate-icon', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  test('正常系: 一般ユーザーが画像生成に成功し、URLとリミットを返す', async () => {
    const res = await POST(
      makeRequest({
        displayName: '日本の歴史',
        description: '日本の歴史に関するクイズジャンル',
        userId: 'uid-user',
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.iconImageUrl).toBe('https://storage.googleapis.com/bucket/temp/genre-icons/uid-user_123.png');
    expect(body.usage).toEqual({
      limit: 5,
      usedToday: 1,
      remainingToday: 4,
    });
    expect(mockUpload).toHaveBeenCalled();
  });

  test('バリデーションエラー: displayNameまたはdescriptionがない場合は400', async () => {
    const res = await POST(
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

  test('認証エラー: トークン不一致は401', async () => {
    mockVerify.mockResolvedValue(null);
    const res = await POST(
      makeRequest({
        displayName: '歴史',
        description: '説明文',
        userId: 'uid-user',
      })
    );
    expect(res.status).toBe(401);
  });

  test('制限エラー: 1日5回の上限に達した一般ユーザーは429', async () => {
    mockLimitRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ count: 5, lastUpdatedDate: '2026-06-18' }),
    });

    const res = await POST(
      makeRequest({
        displayName: '歴史',
        description: '説明文',
        userId: 'uid-user',
      })
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('limit-exceeded');
  });

  test('管理者バイパス: 制限回数に達していても管理者は無制限に生成可能', async () => {
    mockVerify.mockResolvedValue('uid-admin');
    mockUserRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'admin', moderationTier: 'admin' }),
    });
    // カウントは5回に達しているとする
    mockLimitRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ count: 5, lastUpdatedDate: '2026-06-18' }),
    });

    const res = await POST(
      makeRequest({
        displayName: '歴史',
        description: '説明文',
        userId: 'uid-admin',
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.iconImageUrl).toBeDefined();
    // 管理者はバイパスのため usage.limit が null になるはず
    expect(body.usage.limit).toBeNull();
  });
});
