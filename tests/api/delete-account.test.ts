import { POST } from '../../src/app/api/user/delete-account/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ update: mockUpdate }));

jest.mock('../../src/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifySupabaseAccessToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('../../src/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
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

  it('認証成功時、Supabaseサーバークライアントで users.delete_status を delete_pending に更新すること', async () => {
    mockVerify.mockResolvedValue('uid-1');
    const res = await POST(makeRequest({ uid: 'uid-1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ delete_status: 'delete_pending' })
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'uid-1');
  });

  it('更新エラー時は500を返すこと', async () => {
    mockVerify.mockResolvedValue('uid-1');
    mockEq.mockResolvedValue({ error: { message: 'db error' } });
    const res = await POST(makeRequest({ uid: 'uid-1' }));
    expect(res.status).toBe(500);
  });
});
