import { NextRequest } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseAccessToken: jest.fn(),
}));

let usersRow: { moderation_tier?: string; role?: string } | null = null;
let genresTable: Record<string, { id: string }> = {};
let quizCountsByGenre: Record<string, number> = {};

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
      if (table === 'metadata_genres') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: genresTable[id] ?? null, error: null }),
            }),
          }),
        };
      }
      // quizzes
      return {
        select: () => ({
          eq: (_col: string, id: string) =>
            Promise.resolve({ count: quizCountsByGenre[id] ?? 0, error: null }),
        }),
      };
    },
  }),
}));

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifySupabaseAccessToken = verifySupabaseAccessToken as jest.MockedFunction<
  typeof verifySupabaseAccessToken
>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('@/app/api/admin/genres/[id]/usage/route') as typeof import('@/app/api/admin/genres/[id]/usage/route');

function buildRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/genres/${id}/usage`, {
    method: 'GET',
    headers: { Authorization: 'Bearer test-token' },
  });
}

function buildParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/admin/genres/:id/usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractBearerToken.mockReturnValue('test-token');
    usersRow = null;
    genresTable = {};
    quizCountsByGenre = {};
  });

  test('トークンが無効な場合は 401 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue(null);

    const res = await GET(buildRequest('genre-1'), buildParams('genre-1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
  });

  test('管理者以外は 403 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
    usersRow = { moderation_tier: 'senior_moderator' };

    const res = await GET(buildRequest('genre-1'), buildParams('genre-1'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('forbidden');
  });

  test('存在しないジャンルIDの場合は 404 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin', role: 'admin' };
    genresTable = {};

    const res = await GET(buildRequest('missing-genre'), buildParams('missing-genre'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('not-found');
  });

  test('管理者は 200 と紐づくクイズ件数を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin', role: 'admin' };
    genresTable = { 'genre-1': { id: 'genre-1' } };
    quizCountsByGenre = { 'genre-1': 42 };

    const res = await GET(buildRequest('genre-1'), buildParams('genre-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ quizCount: 42 });
  });

  test('紐づくクイズが0件の場合は quizCount: 0 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin', role: 'admin' };
    genresTable = { 'genre-2': { id: 'genre-2' } };
    quizCountsByGenre = {};

    const res = await GET(buildRequest('genre-2'), buildParams('genre-2'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ quizCount: 0 });
  });
});
