import { POST } from '../../src/app/api/user/delete-account/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ update: mockUpdate }));
const mockDeleteUser = jest.fn();

jest.mock('../../src/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifySupabaseAccessToken: (...args: unknown[]) => mockVerify(...args),
}));

const mockAdminClient = {
  from: mockFrom,
  auth: {
    admin: {
      deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
    },
  },
};

jest.mock('../../src/lib/supabase/server', () => ({
  createAdminClient: () => mockAdminClient,
}));

const mockCancelSubscription = jest.fn();
jest.mock('../../src/services/subscription', () => ({
  cancelUserSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
}));

const mockCleanUpDeletedUser = jest.fn();
jest.mock('../../src/services/user', () => ({
  cleanUpDeletedUser: (...args: unknown[]) => mockCleanUpDeletedUser(...args),
}));

function makeRequest(bodyObj: Record<string, unknown>, hasAuth = true): NextRequest {
  return new NextRequest('http://localhost/api/user/delete-account', {
    method: 'POST',
    headers: hasAuth ? { Authorization: 'Bearer token' } : {},
    body: JSON.stringify(bodyObj),
  });
}

describe('POST /api/user/delete-account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEq.mockResolvedValue({ error: null });
    mockCleanUpDeletedUser.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue({ data: {}, error: null });
  });

  it('uid未指定は400を返すこと', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('トークン検証に失敗した場合は401を返すこと', async () => {
    mockVerify.mockResolvedValue(null);
    const res = await POST(makeRequest({ uid: 'uid-1' }));
    expect(res.status).toBe(401);
  });

  it('要求UIDと検証UIDが一致しない場合は401を返すこと', async () => {
    mockVerify.mockResolvedValue('other-uid');
    const res = await POST(makeRequest({ uid: 'uid-1' }));
    expect(res.status).toBe(401);
  });

  it('認証成功時、サブスクを解約し、クレンジングを実行し、Authユーザーを物理削除すること', async () => {
    mockVerify.mockResolvedValue('uid-1');
    mockCancelSubscription.mockResolvedValue(undefined);
    const res = await POST(makeRequest({ uid: 'uid-1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCancelSubscription).toHaveBeenCalledWith('uid-1');
    expect(mockCleanUpDeletedUser).toHaveBeenCalledWith(mockAdminClient, 'uid-1');
    expect(mockDeleteUser).toHaveBeenCalledWith('uid-1');
  });

  it('サブスクキャンセルエラー時でも、クレンジングと退会処理は続行すること', async () => {
    mockVerify.mockResolvedValue('uid-1');
    mockCancelSubscription.mockRejectedValue(new Error('stripe error'));
    const res = await POST(makeRequest({ uid: 'uid-1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCancelSubscription).toHaveBeenCalledWith('uid-1');
    expect(mockCleanUpDeletedUser).toHaveBeenCalledWith(mockAdminClient, 'uid-1');
    expect(mockDeleteUser).toHaveBeenCalledWith('uid-1');
  });

  it('データベースのクレンジングエラー時は500を返し、Auth削除を実行しないこと', async () => {
    mockVerify.mockResolvedValue('uid-1');
    mockCancelSubscription.mockResolvedValue(undefined);
    mockCleanUpDeletedUser.mockRejectedValue(new Error('db cleansing error'));

    const res = await POST(makeRequest({ uid: 'uid-1' }));
    expect(res.status).toBe(500);
    expect(mockCleanUpDeletedUser).toHaveBeenCalledWith(mockAdminClient, 'uid-1');
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it('Auth削除がエラー（Supabaseエラーオブジェクト）の時は500を返すこと', async () => {
    mockVerify.mockResolvedValue('uid-1');
    mockCancelSubscription.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue({ data: null, error: { message: 'auth delete error' } });

    const res = await POST(makeRequest({ uid: 'uid-1' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('auth-deletion-failed');
    expect(mockCleanUpDeletedUser).toHaveBeenCalledWith(mockAdminClient, 'uid-1');
    expect(mockDeleteUser).toHaveBeenCalledWith('uid-1');
  });
});

