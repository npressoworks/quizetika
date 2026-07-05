import { POST } from '@/app/api/quiz/ai-chat-authoring/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockResolveEntitlements = jest.fn();

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

// streamText のモック
const mockStreamText = jest.fn();
jest.mock('ai', () => {
  const actual = jest.requireActual('ai');
  return {
    ...actual,
    streamText: (...args: unknown[]) => mockStreamText(...args),
  };
});

describe('POST /api/quiz/ai-chat-authoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    counterState = {
      questions: { count: 0, counter_date: '2026-06-10' },
      thumbnail: { count: 0, counter_date: '2026-06-10' },
      chat: { count: 5, counter_date: '2026-06-10' },
    };
    mockVerify.mockResolvedValue('uid-pro');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
      hasUnlimitedAiQuestions: false,
    });
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: () => new Response('mocked-stream', { status: 200 }),
    });
  });

  function makeRequest(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/quiz/ai-chat-authoring', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  test('認証エラーは 401', async () => {
    mockVerify.mockResolvedValue(null);
    const res = await POST(
      makeRequest({
        userId: 'uid-pro',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'こんにちは' }] }],
        quizState: { title: '', description: '', genre: '', tags: [], questions: [] },
      })
    );
    expect(res.status).toBe(401);
  });

  test('非 Pro は 403', async () => {
    mockVerify.mockResolvedValue('uid-free');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: false,
      hasUnlimitedAiQuestions: false,
    });
    const res = await POST(
      makeRequest({
        userId: 'uid-free',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'こんにちは' }] }],
        quizState: { title: '', description: '', genre: '', tags: [], questions: [] },
      })
    );
    expect(res.status).toBe(403);
  });

  test('日次チャット回数超過は 429', async () => {
    counterState.chat = { count: 100, counter_date: '2026-06-10' };
    const res = await POST(
      makeRequest({
        userId: 'uid-pro',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'こんにちは' }] }],
        quizState: { title: '', description: '', genre: '', tags: [], questions: [] },
      })
    );
    expect(res.status).toBe(429);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('Pro ユーザーは 200 とストリームレスポンスを返し、カウンタをインクリメントする', async () => {
    const res = await POST(
      makeRequest({
        userId: 'uid-pro',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'こんにちは' }] }],
        quizState: { title: 'テストクイズ', description: 'テストです', genre: '歴史', tags: ['テスト'], questions: [] },
      })
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('mocked-stream');
    expect(mockRpc).toHaveBeenCalledWith('handle_increment_daily_usage_counter', {
      p_user_id: 'uid-pro',
      p_counter_key: 'chat',
      p_today: '2026-06-10',
    });
  });

  test('googleSearch ツールは指定されたクエリで検索結果を返す', async () => {
    // 実際に API から googleSearch ツール定義を確認するため、streamText の引数を検証するテスト
    const res = await POST(
      makeRequest({
        userId: 'uid-pro',
        messages: [{ role: 'user', parts: [{ type: 'text', text: '「東京の人口」を検索してファクトチェックして' }] }],
        quizState: { title: '東京', description: '', genre: '地理', tags: [], questions: [] },
      })
    );
    expect(res.status).toBe(200);
    expect(mockStreamText).toHaveBeenCalled();
    const streamTextArgs = mockStreamText.mock.calls[0][0];
    expect(streamTextArgs.tools.googleSearch).toBeDefined();

    // googleSearch ツールの execute コールバックを直接実行して検証
    const searchResult = await streamTextArgs.tools.googleSearch.execute({ query: '東京の人口' });
    expect(searchResult).toHaveProperty('query', '東京の人口');
    expect(searchResult).toHaveProperty('results');
  });

  test('checkQuestion および checkAllQuestions ツールが定義されていること', async () => {
    const res = await POST(
      makeRequest({
        userId: 'uid-pro',
        messages: [{ role: 'user', parts: [{ type: 'text', text: '問題 1 をチェックして' }] }],
        quizState: { title: 'テスト', description: '', genre: '', tags: [], questions: [] },
      })
    );
    expect(res.status).toBe(200);
    const streamTextArgs = mockStreamText.mock.calls[0][0];
    expect(streamTextArgs.tools.checkQuestion).toBeDefined();
    expect(streamTextArgs.tools.checkAllQuestions).toBeDefined();

    // それぞれの execute を実行して検証
    const singleResult = await streamTextArgs.tools.checkQuestion.execute({
      id: 'q1',
      questionText: '日本の首都は？',
      correctAnswer: '東京',
    });
    expect(singleResult).toHaveProperty('checked', true);

    const allResult = await streamTextArgs.tools.checkAllQuestions.execute({
      questionIds: ['q1', 'q2'],
    });
    expect(allResult).toHaveProperty('checked', true);
  });
});
