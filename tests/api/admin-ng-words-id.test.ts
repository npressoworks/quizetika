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

const mockUpdateNgWord = jest.fn();
const mockSetNgWordActive = jest.fn();
jest.mock('@/services/ngWords', () => ({
  listNgWords: jest.fn(),
  createNgWord: jest.fn(),
  updateNgWord: (...args: unknown[]) => mockUpdateNgWord(...args),
  setNgWordActive: (...args: unknown[]) => mockSetNgWordActive(...args),
}));

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifySupabaseAccessToken = verifySupabaseAccessToken as jest.MockedFunction<
  typeof verifySupabaseAccessToken
>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PATCH } = require('@/app/api/admin/ng-words/[id]/route') as typeof import('@/app/api/admin/ng-words/[id]/route');

function buildRequest(body?: any): NextRequest {
  return new NextRequest('http://localhost/api/admin/ng-words/ng-1', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer test-token' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function buildParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const sampleNgWord = {
  id: 'ng-1',
  word: '更新後語句',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('Admin NgWords [id] API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractBearerToken.mockReturnValue('test-token');
    usersRow = null;
  });

  test('トークンが無効な場合は 401 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue(null);

    const res = await PATCH(buildRequest({ word: '更新後語句' }), buildParams('ng-1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
    expect(mockUpdateNgWord).not.toHaveBeenCalled();
  });

  test('管理者以外は 403 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
    usersRow = { moderation_tier: 'moderator' };

    const res = await PATCH(buildRequest({ word: '更新後語句' }), buildParams('ng-1'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('forbidden');
    expect(mockUpdateNgWord).not.toHaveBeenCalled();
  });

  test('word と isActive のいずれも指定しない場合は 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin' };

    const res = await PATCH(buildRequest({}), buildParams('ng-1'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('bad-request');
    expect(mockUpdateNgWord).not.toHaveBeenCalled();
    expect(mockSetNgWordActive).not.toHaveBeenCalled();
  });

  test('word が空文字・空白のみの場合は 400 を返し updateNgWord を呼ばないこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin' };

    const res = await PATCH(buildRequest({ word: '   ' }), buildParams('ng-1'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('bad-request');
    expect(mockUpdateNgWord).not.toHaveBeenCalled();
  });

  test('word を指定した場合は updateNgWord を呼び 200 と更新後の NgWord を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin' };
    mockUpdateNgWord.mockResolvedValue(sampleNgWord);

    const res = await PATCH(buildRequest({ word: '  更新後語句  ' }), buildParams('ng-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, data: sampleNgWord });
    expect(mockUpdateNgWord).toHaveBeenCalledWith('ng-1', '更新後語句');
  });

  test('isActive を指定した場合は setNgWordActive を呼び 200 と更新後の NgWord を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin' };
    const disabled = { ...sampleNgWord, isActive: false };
    mockSetNgWordActive.mockResolvedValue(disabled);

    const res = await PATCH(buildRequest({ isActive: false }), buildParams('ng-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, data: disabled });
    expect(mockSetNgWordActive).toHaveBeenCalledWith('ng-1', false);
  });

  test('isActive:true を指定した場合は setNgWordActive を呼び 200 と再有効化後の NgWord を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin' };
    const reactivated = { ...sampleNgWord, isActive: true };
    mockSetNgWordActive.mockResolvedValue(reactivated);

    const res = await PATCH(buildRequest({ isActive: true }), buildParams('ng-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, data: reactivated });
    expect(mockSetNgWordActive).toHaveBeenCalledWith('ng-1', true);
  });

  test('対象IDが存在しない場合は 404 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin' };
    mockUpdateNgWord.mockRejectedValue(new Error('対象のNGワードが見つかりません'));

    const res = await PATCH(buildRequest({ word: '更新後語句' }), buildParams('missing-id'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('not-found');
  });

  test('更新後の語句が重複する場合は 409 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin' };
    mockUpdateNgWord.mockRejectedValue(new Error('この語句はすでに登録されています。'));

    const res = await PATCH(buildRequest({ word: '重複語句' }), buildParams('ng-1'));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('duplicate');
  });

  test('updateNgWord が既知のメッセージに一致しない予期しないエラーを返した場合は 500 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin' };
    mockUpdateNgWord.mockRejectedValue(new Error('unexpected failure'));

    const res = await PATCH(buildRequest({ word: '更新後語句' }), buildParams('ng-1'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'internal-error', message: 'サーバー内部エラーが発生しました。' });
  });
});
