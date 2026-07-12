import { NextRequest } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseAccessToken: jest.fn(),
}));

const mockSubmitUserReport = jest.fn();
jest.mock('@/services/user-report', () => ({
  submitUserReport: (...args: unknown[]) => mockSubmitUserReport(...args),
}));

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifySupabaseAccessToken = verifySupabaseAccessToken as jest.MockedFunction<
  typeof verifySupabaseAccessToken
>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('@/app/api/users/report/route') as typeof import('@/app/api/users/report/route');

function buildRequest(body?: any): NextRequest {
  return new NextRequest('http://localhost/api/users/report', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/users/report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractBearerToken.mockReturnValue('test-token');
  });

  test('トークンが無効な場合は 401 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue(null);

    const res = await POST(
      buildRequest({ targetUid: 'user-2', category: 'spam', detail: '迷惑な投稿を繰り返しています' })
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
    expect(mockSubmitUserReport).not.toHaveBeenCalled();
  });

  test('targetUid が未指定の場合は 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');

    const res = await POST(buildRequest({ category: 'spam', detail: '迷惑な投稿を繰り返しています' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-params');
    expect(mockSubmitUserReport).not.toHaveBeenCalled();
  });

  test('category が不正な値の場合は 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');

    const res = await POST(
      buildRequest({ targetUid: 'user-2', category: 'invalid-category', detail: '迷惑な投稿を繰り返しています' })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-params');
    expect(mockSubmitUserReport).not.toHaveBeenCalled();
  });

  test('detail が未指定の場合は 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');

    const res = await POST(buildRequest({ targetUid: 'user-2', category: 'spam' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-params');
    expect(mockSubmitUserReport).not.toHaveBeenCalled();
  });

  test('detail が空文字の場合は 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');

    const res = await POST(buildRequest({ targetUid: 'user-2', category: 'spam', detail: '   ' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-params');
    expect(mockSubmitUserReport).not.toHaveBeenCalled();
  });

  test('自己通報の場合は 409 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
    mockSubmitUserReport.mockRejectedValue(new Error('自分自身を通報することはできません'));

    const res = await POST(
      buildRequest({ targetUid: 'user-1', category: 'spam', detail: '迷惑な投稿を繰り返しています' })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('self-report');
  });

  test('サービスが未知のエラーを投げた場合は 500 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
    mockSubmitUserReport.mockRejectedValue(new Error('unexpected failure'));

    const res = await POST(
      buildRequest({ targetUid: 'user-2', category: 'spam', detail: '迷惑な投稿を繰り返しています' })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('internal-error');
  });

  test('target-not-found エラーの場合も 500 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
    mockSubmitUserReport.mockRejectedValue(new Error('対象のユーザーが見つかりません'));

    const res = await POST(
      buildRequest({ targetUid: 'user-2', category: 'spam', detail: '迷惑な投稿を繰り返しています' })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('internal-error');
  });

  test('正常なリクエストの場合は 200 と success: true を返し、正しい引数で submitUserReport を呼び出すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
    mockSubmitUserReport.mockResolvedValue(undefined);

    const res = await POST(
      buildRequest({ targetUid: 'user-2', category: 'harassment', detail: '迷惑な投稿を繰り返しています' })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockSubmitUserReport).toHaveBeenCalledWith(
      'user-1',
      'user-2',
      'harassment',
      '迷惑な投稿を繰り返しています'
    );
  });
});
