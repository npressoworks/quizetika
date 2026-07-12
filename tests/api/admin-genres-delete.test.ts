import { NextRequest } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseAccessToken: jest.fn(),
}));

let usersRow: { moderation_tier?: string; role?: string } | null = null;
let rpcResult: { data: number | null; error: { message: string } | null } = {
  data: null,
  error: null,
};
let rpcCalledWith: { p_genre_id: string; p_reassign_to_id: string | null } | null = null;

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
      throw new Error(`unexpected table access: ${table}`);
    },
    rpc: (
      fnName: string,
      args: { p_genre_id: string; p_reassign_to_id: string | null }
    ) => {
      if (fnName !== 'delete_genre_with_reassignment') {
        throw new Error(`unexpected rpc: ${fnName}`);
      }
      rpcCalledWith = args;
      return Promise.resolve(rpcResult);
    },
  }),
}));

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifySupabaseAccessToken = verifySupabaseAccessToken as jest.MockedFunction<
  typeof verifySupabaseAccessToken
>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DELETE } = require('@/app/api/admin/genres/[id]/route') as typeof import('@/app/api/admin/genres/[id]/route');

function buildRequest(id: string, body?: { reassignToGenreId?: string }): NextRequest {
  return new NextRequest(`http://localhost/api/admin/genres/${id}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function buildParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('DELETE /api/admin/genres/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractBearerToken.mockReturnValue('test-token');
    usersRow = null;
    rpcResult = { data: null, error: null };
    rpcCalledWith = null;
  });

  test('トークンが無効な場合は 401 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue(null);

    const res = await DELETE(buildRequest('genre-1'), buildParams('genre-1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
  });

  test('管理者以外は 403 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
    usersRow = { moderation_tier: 'senior_moderator' };

    const res = await DELETE(buildRequest('genre-1'), buildParams('genre-1'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('forbidden');
  });

  test('正常系: reassignToGenreId 指定ありで 200 と reassignedCount を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin', role: 'admin' };
    rpcResult = { data: 5, error: null };

    const res = await DELETE(
      buildRequest('genre-1', { reassignToGenreId: 'genre-2' }),
      buildParams('genre-1')
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, reassignedCount: 5 });
    expect(rpcCalledWith).toEqual({ p_genre_id: 'genre-1', p_reassign_to_id: 'genre-2' });
  });

  test('正常系: reassignToGenreId 未指定で 200 と reassignedCount: 0 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin', role: 'admin' };
    rpcResult = { data: 0, error: null };

    const res = await DELETE(buildRequest('genre-1', {}), buildParams('genre-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, reassignedCount: 0 });
    expect(rpcCalledWith).toEqual({ p_genre_id: 'genre-1', p_reassign_to_id: null });
  });

  test('genre-not-found エラーは 404 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin', role: 'admin' };
    rpcResult = { data: null, error: { message: 'genre-not-found' } };

    const res = await DELETE(buildRequest('missing-genre', {}), buildParams('missing-genre'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('genre-not-found');
  });

  test('same-genre エラーは 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin', role: 'admin' };
    rpcResult = { data: null, error: { message: 'same-genre' } };

    const res = await DELETE(
      buildRequest('genre-1', { reassignToGenreId: 'genre-1' }),
      buildParams('genre-1')
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('same-genre');
  });

  test('reassign-required エラーは 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin', role: 'admin' };
    rpcResult = { data: null, error: { message: 'reassign-required' } };

    const res = await DELETE(buildRequest('genre-1', {}), buildParams('genre-1'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('reassign-required');
  });

  test('invalid-reassign-target エラーは 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin', role: 'admin' };
    rpcResult = { data: null, error: { message: 'invalid-reassign-target' } };

    const res = await DELETE(
      buildRequest('genre-1', { reassignToGenreId: 'no-such-genre' }),
      buildParams('genre-1')
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-reassign-target');
  });

  test('未知のエラーメッセージは 500 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin', role: 'admin' };
    rpcResult = { data: null, error: { message: 'something-unexpected' } };

    const res = await DELETE(buildRequest('genre-1', {}), buildParams('genre-1'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('internal-error');
  });
});
