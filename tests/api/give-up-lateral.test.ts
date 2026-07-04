import { POST } from '@/app/api/attempt/give-up-lateral/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockRpc = jest.fn();

let attemptResolveValue: { data: unknown; error: unknown } = { data: null, error: null };

function createSelectChain(resolveValue: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(resolveValue)),
  };
  return chain;
}

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: jest.fn((table: string) => {
      if (table === 'attempts') return createSelectChain(attemptResolveValue);
      return createSelectChain({ data: null, error: null });
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifySupabaseAccessToken: (...args: unknown[]) => mockVerify(...args),
}));

const attemptData = {
  id: 'att-1',
  user_id: 'uid-1',
  quiz_id: 'quiz-1',
  total_questions: 1,
  elapsed_seconds: 60,
  completed_at: null,
};

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/attempt/give-up-lateral', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
  });
}

describe('POST /api/attempt/give-up-lateral', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue('uid-1');
    attemptResolveValue = { data: attemptData, error: null };
  });

  it('諦め時に completed のみ返し、RPCへ経過秒数を渡す', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const res = await POST(buildRequest({ attemptId: 'att-1', userId: 'uid-1', elapsedSeconds: 90 }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completed).toBe(true);
    expect(body.revealText).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith('handle_give_up_lateral_attempt', {
      p_attempt_id: 'att-1',
      p_quiz_id: 'quiz-1',
      p_elapsed_seconds: 90,
    });
  });

  it('既に完了済みの attempt は RPC の already-completed 例外を 409 に変換する', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'already-completed' } });

    const res = await POST(buildRequest({ attemptId: 'att-1', userId: 'uid-1' }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('already-completed');
  });

  it('認証失敗時は 401 を返し RPC を呼び出さない', async () => {
    mockVerify.mockResolvedValue(null);

    const res = await POST(buildRequest({ attemptId: 'att-1', userId: 'uid-1' }));

    expect(res.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('他ユーザーの attempt は 403 を返し RPC を呼び出さない', async () => {
    attemptResolveValue = { data: { ...attemptData, user_id: 'other-uid' }, error: null };

    const res = await POST(buildRequest({ attemptId: 'att-1', userId: 'uid-1' }));

    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('attempt が見つからない場合は 404 を返す', async () => {
    attemptResolveValue = { data: null, error: null };

    const res = await POST(buildRequest({ attemptId: 'missing', userId: 'uid-1' }));

    expect(res.status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
