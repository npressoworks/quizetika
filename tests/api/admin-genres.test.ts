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

let usersRow: { moderation_tier?: string; role?: string } | null = null;
let genresTable: Record<string, any> = {};
let insertError: { message: string } | null = null;

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
      // metadata_genres
      return {
        select: (cols: string) => {
          if (cols === '*') {
            return Promise.resolve({ data: Object.values(genresTable), error: null });
          }
          return {
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: genresTable[id] ?? null, error: null }),
            }),
          };
        },
        insert: async (payload: any) => {
          if (insertError) return { error: insertError };
          genresTable[payload.id] = payload;
          return { error: null };
        },
      };
    },
  }),
}));

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifySupabaseAccessToken = verifySupabaseAccessToken as jest.MockedFunction<
  typeof verifySupabaseAccessToken
>;

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
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractBearerToken.mockReturnValue('test-token');
    usersRow = null;
    genresTable = {};
    insertError = null;
  });

  describe('GET /api/admin/genres', () => {
    test('トークンが無効な場合は 401 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue(null);

      const res = await GET(buildRequest('GET'));
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('unauthorized');
    });

    test('管理者以外は 403 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
      usersRow = { moderation_tier: 'senior_moderator' };

      const res = await GET(buildRequest('GET'));
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toBe('forbidden');
    });

    test('管理者は 200 と全ジャンルデータを返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin', role: 'admin' };
      genresTable = {
        'genre-1': { id: 'genre-1', display_name: 'Genre 1', is_active: true },
        'genre-2': { id: 'genre-2', display_name: 'Genre 2', is_active: false },
      };

      const res = await GET(buildRequest('GET'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual([
        expect.objectContaining({ id: 'genre-1', displayName: 'Genre 1', isActive: true }),
        expect.objectContaining({ id: 'genre-2', displayName: 'Genre 2', isActive: false }),
      ]);
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
      mockVerifySupabaseAccessToken.mockResolvedValue(null);

      const res = await POST(buildRequest('POST', validPayload));
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('unauthorized');
    });

    test('管理者以外は 403 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
      usersRow = { moderation_tier: 'moderator' };

      const res = await POST(buildRequest('POST', validPayload));
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toBe('forbidden');
    });

    test('リクエストボディが不正な場合は 400 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin' };

      const invalidPayload = { ...validPayload, id: '' };
      const res = await POST(buildRequest('POST', invalidPayload));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('bad-request');
    });

    test('IDの形式が不正な場合は 400 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin' };

      const invalidPayload = { ...validPayload, id: 'New_Genre!' };
      const res = await POST(buildRequest('POST', invalidPayload));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('bad-request');
    });

    test('すでにIDが存在する場合は 409 を返すこと', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin' };
      genresTable[validPayload.id] = { id: validPayload.id };

      const res = await POST(buildRequest('POST', validPayload));
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error).toBe('duplicate-id');
    });

    test('有効なデータで管理者が POST した場合、200 を返し metadata_genres に登録されること', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin' };

      const res = await POST(buildRequest('POST', validPayload));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(genresTable[validPayload.id]).toBeDefined();

      const stored = genresTable[validPayload.id];
      expect(stored.id).toBe(validPayload.id);
      expect(stored.display_name).toBe(validPayload.displayName);
      expect(stored.description).toBe(validPayload.description);
      expect(stored.icon_image_url).toBe(validPayload.iconImageUrl);
      expect(stored.canonical_id).toBeNull();
      expect(stored.merged_genre_ids).toEqual([]);
      expect(stored.is_active).toBe(true);
      expect(stored.created_at).toBeDefined();
      expect(stored.updated_at).toBeDefined();
    });

    test('一時アイコン画像（AI生成/アップロード）のパスを正式なパスに移行して保存すること', async () => {
      mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
      usersRow = { moderation_tier: 'admin' };
      mockMoveTemporaryGenreIcon.mockResolvedValue(
        'https://project.supabase.co/storage/v1/object/public/genres/new-genre/icon_12345.png'
      );

      const tempPayload = {
        ...validPayload,
        iconImageUrl: 'https://project.supabase.co/storage/v1/object/public/genres/temp/temp_icon_admin.png',
      };

      const res = await POST(buildRequest('POST', tempPayload));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockMoveTemporaryGenreIcon).toHaveBeenCalledWith(tempPayload.iconImageUrl, 'new-genre');
      expect(genresTable[validPayload.id].icon_image_url).toContain(
        'https://project.supabase.co/storage/v1/object/public/genres/new-genre/icon_'
      );
    });
  });
});
