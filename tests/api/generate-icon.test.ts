import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockGenerateContent = jest.fn();
const mockUsersMaybeSingle = jest.fn();
const mockCounterMaybeSingle = jest.fn();
const mockRpc = jest.fn();

const mockSupabaseAdmin = {
  from: jest.fn((table: string) => {
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: mockUsersMaybeSingle,
      };
    }
    if (table === 'daily_usage_counters') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: mockCounterMaybeSingle,
      };
    }
    throw new Error(`unexpected table: ${table}`);
  }),
  rpc: mockRpc,
};

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'valid-token',
  verifySupabaseAccessToken: (token: any) => mockVerify(token),
}));

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockSupabaseAdmin,
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: (options: any) => mockGenerateContent(options),
    },
  })),
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

describe('AI Genre Icon API Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue('uid-user');
    mockUsersMaybeSingle.mockResolvedValue({
      data: { role: 'user', moderation_tier: 'newcomer' },
      error: null,
    });
    mockCounterMaybeSingle.mockResolvedValue({
      data: { count: 0, counter_date: '2026-06-18' },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: 1, error: null });
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
      expect(mockRpc).toHaveBeenCalledWith('handle_increment_daily_usage_counter', {
        p_user_id: 'uid-user',
        p_counter_key: 'genre-icon',
        p_today: '2026-06-18',
      });
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
      mockCounterMaybeSingle.mockResolvedValue({
        data: { count: 5, counter_date: '2026-06-18' },
        error: null,
      });

      const res = await generateIconPOST(
        makeRequest({
          displayName: '歴史',
          description: '説明文',
          userId: 'uid-user',
        })
      );
      expect(res.status).toBe(429);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    test('管理者は日次上限を超えても画像生成でき、usage.limit は null になる', async () => {
      mockUsersMaybeSingle.mockResolvedValue({
        data: { role: 'admin', moderation_tier: 'newcomer' },
        error: null,
      });
      mockCounterMaybeSingle.mockResolvedValue({
        data: { count: 99, counter_date: '2026-06-18' },
        error: null,
      });
      mockUploadTemporaryGenreIconBuffer.mockResolvedValue('https://example.com/icon.png');

      const res = await generateIconPOST(
        makeRequest({
          displayName: '歴史',
          description: '説明文',
          userId: 'uid-user',
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.usage.limit).toBeNull();
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });
});
