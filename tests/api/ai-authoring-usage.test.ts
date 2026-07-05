import { GET } from '@/app/api/quiz/ai-authoring-usage/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockResolveEntitlements = jest.fn();

const counterState: Record<string, { count: number; counter_date: string }> = {
  questions: { count: 2, counter_date: '2026-06-10' },
  thumbnail: { count: 1, counter_date: '2026-06-10' },
  chat: { count: 3, counter_date: '2026-06-10' },
};

function createCounterTableMock() {
  let queriedKey: string | undefined;
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn((column: string, value: string) => {
      if (column === 'counter_key') queriedKey = value;
      return chain;
    }),
    maybeSingle: jest.fn(() =>
      Promise.resolve({ data: (queriedKey && counterState[queriedKey]) ?? null, error: null })
    ),
  };
  return chain;
}

const mockSupabaseAdmin = {
  from: jest.fn((table: string) => {
    if (table !== 'daily_usage_counters') throw new Error(`unexpected table: ${table}`);
    return createCounterTableMock();
  }),
  rpc: jest.fn(),
};

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifySupabaseAccessToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@/services/entitlement', () => ({
  resolveUserEntitlements: (...args: unknown[]) => mockResolveEntitlements(...args),
}));

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockSupabaseAdmin,
}));

jest.mock('@/services/ai-authoring-utils', () => {
  const actual = jest.requireActual('@/services/ai-authoring-utils');
  return {
    ...actual,
    getJstTodayString: () => '2026-06-10',
  };
});

describe('GET /api/quiz/ai-authoring-usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue('uid-pro');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
      hasUnlimitedAiQuestions: true,
    });
  });

  test('Pro ユーザは 200 と usage を返す', async () => {
    const req = new NextRequest('http://localhost/api/quiz/ai-authoring-usage?userId=uid-pro');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions.usedToday).toBe(2);
    expect(body.thumbnail.usedToday).toBe(1);
    expect(body.chat.usedToday).toBe(3);
  });

  test('非 Pro は 403', async () => {
    mockVerify.mockResolvedValue('uid-free');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: false,
      hasUnlimitedAiQuestions: false,
    });
    const req = new NextRequest('http://localhost/api/quiz/ai-authoring-usage?userId=uid-free');
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('pro-required');
  });
});
