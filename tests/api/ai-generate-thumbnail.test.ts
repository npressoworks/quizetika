import { POST } from '@/app/api/quiz/ai-generate-thumbnail/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockResolveEntitlements = jest.fn();
const mockGenerateContent = jest.fn();
const mockUpload = jest.fn();

let counterState: Record<string, { count: number; counter_date: string } | undefined> = {};

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

const mockRpc = jest.fn((_fnName: string, params: any) => {
  const key = params.p_counter_key as string;
  const current = counterState[key];
  const next = current && current.counter_date === params.p_today ? current.count + 1 : 1;
  counterState[key] = { count: next, counter_date: params.p_today };
  return Promise.resolve({ data: next, error: null });
});

const mockSupabaseAdmin = {
  from: jest.fn((table: string) => {
    if (table !== 'daily_usage_counters') throw new Error(`unexpected table: ${table}`);
    return createCounterTableMock();
  }),
  rpc: mockRpc,
};

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifySupabaseAccessToken: (token: any) => mockVerify(token),
}));

jest.mock('@/services/entitlement', () => ({
  resolveUserEntitlements: (uid: any) => mockResolveEntitlements(uid),
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    },
  })),
}));

jest.mock('@/services/storage-admin', () => ({
  uploadQuizCoverBuffer: (...args: unknown[]) => mockUpload(...args),
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

describe('POST /api/quiz/ai-generate-thumbnail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    counterState = {
      questions: { count: 0, counter_date: '2026-06-10' },
      thumbnail: { count: 0, counter_date: '2026-06-10' },
      chat: { count: 0, counter_date: '2026-06-10' },
    };
    mockVerify.mockResolvedValue('uid-pro');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
      hasUnlimitedAiQuestions: true,
    });
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data: Buffer.from('png').toString('base64'), mimeType: 'image/png' } }],
          },
        },
      ],
    });
    mockUpload.mockResolvedValue('https://storage.googleapis.com/bucket/quizzes/drafts/uid-pro/cover.png');
  });

  function makeRequest(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/quiz/ai-generate-thumbnail', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  test('成功時に thumbnailUrl と usage を返す', async () => {
    const res = await POST(
      makeRequest({
        title: 'テストクイズ',
        description: 'テスト説明文です',
        userId: 'uid-pro',
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thumbnailUrl).toContain('storage.googleapis.com');
    expect(body.usage).toBeDefined();
    expect(mockUpload).toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith('handle_increment_daily_usage_counter', {
      p_user_id: 'uid-pro',
      p_counter_key: 'thumbnail',
      p_today: '2026-06-10',
    });
  });

  test('非 Pro は 403', async () => {
    mockVerify.mockResolvedValue('uid-free');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: false,
      hasUnlimitedAiQuestions: false,
    });
    const res = await POST(
      makeRequest({
        title: 'テストクイズ',
        description: 'テスト説明文です',
        userId: 'uid-free',
      })
    );
    expect(res.status).toBe(403);
  });
});
