import { NextRequest } from 'next/server';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebase/auth-verify';
import { getDoc } from 'firebase/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';

jest.mock('@/lib/firebase/config', () => require('../__mocks__/firebase-config'));
jest.mock('@/lib/firebase/firestore', () => ({
  usersRef: { path: 'users' },
}));

jest.mock('@/lib/firebase/auth-verify', () => ({
  extractBearerToken: jest.fn(),
  verifyFirebaseIdToken: jest.fn(),
}));

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn((ref, id) => ({ ref, id })),
    getDoc: jest.fn(),
  };
});

const mockBucket = {
  name: 'quizeum-test-bucket',
  file: jest.fn((path: string) => ({
    copy: jest.fn().mockResolvedValue(undefined),
    makePublic: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  })),
};

// firebase-admin/firestore および storage のモック
jest.mock('@/lib/firebase/admin', () => {
  const mockFirestore = {
    collection: jest.fn(),
  };
  const mockStorage = {
    bucket: jest.fn(() => mockBucket),
  };
  return {
    getAdminFirestore: () => mockFirestore,
    getAdminStorage: () => mockStorage,
  };
});

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifyFirebaseIdToken = verifyFirebaseIdToken as jest.MockedFunction<
  typeof verifyFirebaseIdToken
>;
const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;

// route は実装後にインポートされるが、TDDのためrequireで遅延ロード
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET, POST } = require('@/app/api/admin/genres/route') as typeof import('@/app/api/admin/genres/route');

function buildRequest(method: 'GET' | 'POST', body?: any): NextRequest {
  return new NextRequest('http://localhost/api/admin/genres', {
    method,
    headers: { Authorization: 'Bearer test-token' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Admin Genres API', () => {
  let mockFirestore: any;
  let mockGenresCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractBearerToken.mockReturnValue('test-token');
    mockFirestore = getAdminFirestore();

    mockGenresCollection = {
      get: jest.fn(),
      doc: jest.fn(),
    };

    mockFirestore.collection.mockImplementation((name: string) => {
      if (name === 'metadata_genres') return mockGenresCollection;
      return {};
    });
  });

  describe('GET /api/admin/genres', () => {
    test('トークンが無効な場合は 401 を返すこと', async () => {
      mockVerifyFirebaseIdToken.mockResolvedValue(null);

      const res = await GET(buildRequest('GET'));
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('unauthorized');
    });

    test('管理者以外は 403 を返すこと', async () => {
      mockVerifyFirebaseIdToken.mockResolvedValue('user-1');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ moderationTier: 'senior_moderator' }),
      } as never);

      const res = await GET(buildRequest('GET'));
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toBe('forbidden');
    });

    test('管理者は 200 と全ジャンルデータを返すこと', async () => {
      mockVerifyFirebaseIdToken.mockResolvedValue('admin-1');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ moderationTier: 'admin', role: 'admin' }),
      } as never);

      const mockGenres = [
        { id: 'genre-1', displayName: 'Genre 1', isActive: true },
        { id: 'genre-2', displayName: 'Genre 2', isActive: false },
      ];

      mockGenresCollection.get.mockResolvedValue({
        docs: mockGenres.map(data => ({
          id: data.id,
          data: () => data,
        })),
      });

      const res = await GET(buildRequest('GET'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual(mockGenres);
    });
  });

  describe('POST /api/admin/genres', () => {
    const validPayload = {
      id: 'new-genre',
      displayName: '新規ジャンル',
      description: '説明文です',
      iconImageUrl: 'https://example.com/icon.png',
    };

    test('トークンが無効な場合は 401 を返すこと', async () => {
      mockVerifyFirebaseIdToken.mockResolvedValue(null);

      const res = await POST(buildRequest('POST', validPayload));
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('unauthorized');
    });

    test('管理者以外は 403 を返すこと', async () => {
      mockVerifyFirebaseIdToken.mockResolvedValue('user-1');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ moderationTier: 'moderator' }),
      } as never);

      const res = await POST(buildRequest('POST', validPayload));
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toBe('forbidden');
    });

    test('リクエストボディが不正な場合は 400 を返すこと', async () => {
      mockVerifyFirebaseIdToken.mockResolvedValue('admin-1');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ moderationTier: 'admin' }),
      } as never);

      // ID が不正（空文字）
      const invalidPayload = { ...validPayload, id: '' };
      const res = await POST(buildRequest('POST', invalidPayload));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('bad-request');
    });

    test('IDの形式が不正な場合は 400 を返すこと', async () => {
      mockVerifyFirebaseIdToken.mockResolvedValue('admin-1');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ moderationTier: 'admin' }),
      } as never);

      // ID が不正（大文字や記号）
      const invalidPayload = { ...validPayload, id: 'New_Genre!' };
      const res = await POST(buildRequest('POST', invalidPayload));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('bad-request');
    });

    test('すでにIDが存在する場合は 409 を返すこと', async () => {
      mockVerifyFirebaseIdToken.mockResolvedValue('admin-1');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ moderationTier: 'admin' }),
      } as never);

      const mockDoc = {
        get: jest.fn().mockResolvedValue({ exists: true }),
      };
      mockGenresCollection.doc.mockReturnValue(mockDoc);

      const res = await POST(buildRequest('POST', validPayload));
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error).toBe('duplicate-id');
    });

    test('有効なデータで管理者が POST した場合、200 を返し Firestore に登録されること', async () => {
      mockVerifyFirebaseIdToken.mockResolvedValue('admin-1');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ moderationTier: 'admin' }),
      } as never);

      const mockDoc = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
      };
      mockGenresCollection.doc.mockReturnValue(mockDoc);

      const res = await POST(buildRequest('POST', validPayload));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockDoc.set).toHaveBeenCalledTimes(1);
      
      const setArg = mockDoc.set.mock.calls[0][0];
      expect(setArg.id).toBe(validPayload.id);
      expect(setArg.displayName).toBe(validPayload.displayName);
      expect(setArg.description).toBe(validPayload.description);
      expect(setArg.iconImageUrl).toBe(validPayload.iconImageUrl);
      expect(setArg.canonicalId).toBeNull();
      expect(setArg.mergedGenreIds).toEqual([]);
      expect(setArg.isActive).toBe(true);
      expect(setArg.createdAt).toBeDefined();
      expect(setArg.updatedAt).toBeDefined();
    });

    test('一時アイコン画像（AI生成）のパスを正式なパスに移行して保存すること', async () => {
      mockVerifyFirebaseIdToken.mockResolvedValue('admin-1');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ moderationTier: 'admin' }),
      } as never);

      const mockDoc = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
      };
      mockGenresCollection.doc.mockReturnValue(mockDoc);

      const tempPayload = {
        ...validPayload,
        iconImageUrl: 'https://storage.googleapis.com/quizeum-test-bucket/temp/genre-icons/user1_12345.png',
      };

      const res = await POST(buildRequest('POST', tempPayload));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockDoc.set).toHaveBeenCalledTimes(1);
      
      const setArg = mockDoc.set.mock.calls[0][0];
      expect(setArg.iconImageUrl).toContain('genres/new-genre/icon_');
      expect(mockBucket.file).toHaveBeenCalledWith('temp/genre-icons/user1_12345.png');
    });
  });
});
