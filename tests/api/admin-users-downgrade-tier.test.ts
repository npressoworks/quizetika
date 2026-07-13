import { NextRequest } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseAccessToken: jest.fn(),
}));

const mockDowngradeUserTier = jest.fn();
jest.mock('@/services/reputation', () => ({
  downgradeUserTier: (...args: unknown[]) => mockDowngradeUserTier(...args),
}));

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifySupabaseAccessToken = verifySupabaseAccessToken as jest.MockedFunction<
  typeof verifySupabaseAccessToken
>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('@/app/api/admin/users/downgrade-tier/route') as typeof import('@/app/api/admin/users/downgrade-tier/route');

function buildRequest(body?: any): NextRequest {
  return new NextRequest('http://localhost/api/admin/users/downgrade-tier', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/admin/users/downgrade-tier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractBearerToken.mockReturnValue('test-token');
  });

  test('トークンが無効な場合は 401 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue(null);

    const res = await POST(
      buildRequest({ targetUid: 'user-1', newTier: 'newcomer', reason: '不適切な投稿が続いたため' })
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
    expect(mockDowngradeUserTier).not.toHaveBeenCalled();
  });

  test('targetUid が未指定の場合は 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');

    const res = await POST(buildRequest({ newTier: 'newcomer', reason: '不適切な投稿が続いたため' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-params');
    expect(mockDowngradeUserTier).not.toHaveBeenCalled();
  });

  test('newTier が不正な値の場合は 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');

    const res = await POST(
      buildRequest({ targetUid: 'user-1', newTier: 'admin', reason: '不適切な投稿が続いたため' })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-params');
    expect(mockDowngradeUserTier).not.toHaveBeenCalled();
  });

  test('reason が未指定の場合は 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');

    const res = await POST(buildRequest({ targetUid: 'user-1', newTier: 'newcomer' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-params');
    expect(mockDowngradeUserTier).not.toHaveBeenCalled();
  });

  test('reason が10文字未満の場合は 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');

    const res = await POST(buildRequest({ targetUid: 'user-1', newTier: 'newcomer', reason: '短い理由' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-params');
    expect(mockDowngradeUserTier).not.toHaveBeenCalled();
  });

  test('サービスが permission-denied 系エラーを投げた場合は 403 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
    mockDowngradeUserTier.mockRejectedValue(new Error('この操作を実行する権限がありません'));

    const res = await POST(
      buildRequest({ targetUid: 'user-1', newTier: 'newcomer', reason: '不適切な投稿が続いたため' })
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('forbidden');
  });

  test('サービスが target-not-found 系エラーを投げた場合は 404 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    mockDowngradeUserTier.mockRejectedValue(new Error('対象のユーザーが見つかりません'));

    const res = await POST(
      buildRequest({ targetUid: 'user-1', newTier: 'newcomer', reason: '不適切な投稿が続いたため' })
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('not-found');
  });

  test('サービスが不正な引き下げ先エラーを投げた場合は 409 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    mockDowngradeUserTier.mockRejectedValue(
      new Error('引き下げ先のティアは現在のティアより下位である必要があります')
    );

    const res = await POST(
      buildRequest({ targetUid: 'user-1', newTier: 'senior_moderator', reason: '不適切な投稿が続いたため' })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('invalid-tier-downgrade');
  });

  test('サービスが未知のエラーを投げた場合は 500 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    mockDowngradeUserTier.mockRejectedValue(new Error('unexpected failure'));

    const res = await POST(
      buildRequest({ targetUid: 'user-1', newTier: 'newcomer', reason: '不適切な投稿が続いたため' })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'internal-error', message: 'サーバー内部エラーが発生しました。' });
  });

  test('正常なリクエストの場合は 200 と success: true を返し、正しい引数で downgradeUserTier を呼び出すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    mockDowngradeUserTier.mockResolvedValue(undefined);

    const res = await POST(
      buildRequest({ targetUid: 'user-1', newTier: 'newcomer', reason: '不適切な投稿が続いたため' })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockDowngradeUserTier).toHaveBeenCalledWith(
      'user-1',
      'admin-1',
      'newcomer',
      '不適切な投稿が続いたため'
    );
  });
});
