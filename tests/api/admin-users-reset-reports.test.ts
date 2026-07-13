import { NextRequest } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseAccessToken: jest.fn(),
}));

const mockResetUserReports = jest.fn();
jest.mock('@/services/reputation', () => ({
  resetUserReports: (...args: unknown[]) => mockResetUserReports(...args),
}));

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifySupabaseAccessToken = verifySupabaseAccessToken as jest.MockedFunction<
  typeof verifySupabaseAccessToken
>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('@/app/api/admin/users/reset-reports/route') as typeof import('@/app/api/admin/users/reset-reports/route');

function buildRequest(body?: any): NextRequest {
  return new NextRequest('http://localhost/api/admin/users/reset-reports', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/admin/users/reset-reports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractBearerToken.mockReturnValue('test-token');
  });

  test('トークンが無効な場合は 401 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue(null);

    const res = await POST(buildRequest({ targetUid: 'user-1', reason: '誤報と判断されたため' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
    expect(mockResetUserReports).not.toHaveBeenCalled();
  });

  test('targetUid が未指定の場合は 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');

    const res = await POST(buildRequest({ reason: '誤報と判断されたため' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-params');
    expect(mockResetUserReports).not.toHaveBeenCalled();
  });

  test('reason が未指定の場合は 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');

    const res = await POST(buildRequest({ targetUid: 'user-1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-params');
    expect(mockResetUserReports).not.toHaveBeenCalled();
  });

  test('サービスが reason-too-short 系エラーを投げた場合は 400 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    mockResetUserReports.mockRejectedValue(
      new Error('通報数リセット理由は10文字以上で入力してください。')
    );

    const res = await POST(buildRequest({ targetUid: 'user-1', reason: '短い理由' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-params');
  });

  test('サービスが permission-denied 系エラーを投げた場合は 403 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('user-1');
    mockResetUserReports.mockRejectedValue(new Error('この操作を実行する権限がありません'));

    const res = await POST(buildRequest({ targetUid: 'user-1', reason: '誤報と判断されたため' }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('forbidden');
  });

  test('サービスが target-not-found 系エラーを投げた場合は 404 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    mockResetUserReports.mockRejectedValue(new Error('対象のユーザーが見つかりません'));

    const res = await POST(buildRequest({ targetUid: 'user-1', reason: '誤報と判断されたため' }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('not-found');
  });

  test('サービスが未知のエラーを投げた場合は 500 を返すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    mockResetUserReports.mockRejectedValue(new Error('unexpected failure'));

    const res = await POST(buildRequest({ targetUid: 'user-1', reason: '誤報と判断されたため' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'internal-error', message: 'サーバー内部エラーが発生しました。' });
  });

  test('正常なリクエストの場合は 200 と success: true を返し、正しい引数で resetUserReports を呼び出すこと', async () => {
    mockVerifySupabaseAccessToken.mockResolvedValue('admin-1');
    mockResetUserReports.mockResolvedValue(undefined);

    const res = await POST(buildRequest({ targetUid: 'user-1', reason: '誤報と判断されたため' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockResetUserReports).toHaveBeenCalledWith('user-1', 'admin-1', '誤報と判断されたため');
  });
});
