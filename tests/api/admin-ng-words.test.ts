import { NextRequest } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseAccessToken: jest.fn(),
}));

let usersRow: { moderation_tier?: string; role?: string } | null = null;

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: usersRow, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

const mockListNgWords = jest.fn();
const mockCreateNgWord = jest.fn();
jest.mock('@/services/ngWords', () => ({
  listNgWords: (...args: unknown[]) => mockListNgWords(...args),
  createNgWord: (...args: unknown[]) => mockCreateNgWord(...args),
  updateNgWord: jest.fn(),
  setNgWordActive: jest.fn(),
}));

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifySupabaseAccessToken = verifySupabaseAccessToken as jest.MockedFunction<
  typeof verifySupabaseAccessToken
>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET, POST } = require('@/app/api/admin/ng-words/route') as typeof import('@/app/api/admin/ng-words/route');

function buildRequest(method: 'GET' | 'POST', body?: any): NextRequest {
  return new NextRequest('http://localhost/api/admin/ng-words', {
    method,
    headers: { Authorization: 'Bearer test-token' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const sampleNgWord = {
  id: 'ng-1',
  word: 'ばかやろう',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Admin NgWords API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractBearerToken.mockReturnValue('test-token');
    usersRow = null;
  });

  describe('GET /api/admin/ng-words', () => {
    test('トークンが無効な場合は 401 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue(null);

      const res = await GET(buildRequest('GET'));
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('unauthorized');
      expect(mockListNgWords).not.toHaveBeenCalled();
    });

    test('管理者以外は 403 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
      usersRow = { moderation_tier: 'senior_moderator' };

      const res = await GET(buildRequest('GET'));
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toBe('forbidden');
      expect(mockListNgWords).not.toHaveBeenCalled();
    });

    test('管理者は 200 とNGワード一覧を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin' };
      mockListNgWords.mockResolvedValue([sampleNgWord]);

      const res = await GET(buildRequest('GET'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual([sampleNgWord]);
      expect(mockListNgWords).toHaveBeenCalledTimes(1);
    });

    test('listNgWords が既知のメッセージに一致しない予期しないエラーを返した場合は 500 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin' };
      mockListNgWords.mockRejectedValue(new Error('unexpected failure'));

      const res = await GET(buildRequest('GET'));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body).toEqual({ error: 'internal-error', message: 'サーバー内部エラーが発生しました。' });
    });
  });

  describe('POST /api/admin/ng-words', () => {
    test('トークンが無効な場合は 401 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue(null);

      const res = await POST(buildRequest('POST', { word: '新語句' }));
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('unauthorized');
      expect(mockCreateNgWord).not.toHaveBeenCalled();
    });

    test('管理者以外は 403 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
      usersRow = { moderation_tier: 'moderator' };

      const res = await POST(buildRequest('POST', { word: '新語句' }));
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toBe('forbidden');
      expect(mockCreateNgWord).not.toHaveBeenCalled();
    });

    test('空文字の語句を送信した場合は 400 を返し createNgWord を呼ばないこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin' };

      const res = await POST(buildRequest('POST', { word: '   ' }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('bad-request');
      expect(mockCreateNgWord).not.toHaveBeenCalled();
    });

    test('word が未指定の場合は 400 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin' };

      const res = await POST(buildRequest('POST', {}));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('bad-request');
      expect(mockCreateNgWord).not.toHaveBeenCalled();
    });

    test('重複語句の場合は 409 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin' };
      mockCreateNgWord.mockRejectedValue(new Error('この語句はすでに登録されています。'));

      const res = await POST(buildRequest('POST', { word: '既存語句' }));
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error).toBe('duplicate');
    });

    test('有効な語句の場合は 200 と作成された NgWord を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin' };
      mockCreateNgWord.mockResolvedValue(sampleNgWord);

      const res = await POST(buildRequest('POST', { word: 'ばかやろう' }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ success: true, data: sampleNgWord });
      expect(mockCreateNgWord).toHaveBeenCalledWith('ばかやろう');
    });

    test('前後空白はトリムして createNgWord に渡されること', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin' };
      mockCreateNgWord.mockResolvedValue(sampleNgWord);

      const res = await POST(buildRequest('POST', { word: '  ばかやろう  ' }));

      expect(res.status).toBe(200);
      expect(mockCreateNgWord).toHaveBeenCalledWith('ばかやろう');
    });
  });
});
