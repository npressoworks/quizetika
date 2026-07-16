import { POST } from '@/app/api/quiz/ai-generate-questions/route';
import { NextRequest } from 'next/server';
import { AI_QUIZ_QUESTION_COUNT } from '@/services/ai-authoring-utils';

const mockVerify = jest.fn();
const mockResolveEntitlements = jest.fn();
const mockGenerateContent = jest.fn();

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

function makeGeminiQuestions() {
  return Array.from({ length: AI_QUIZ_QUESTION_COUNT }, (_, i) => ({
    type: 'multiple-choice',
    questionText: `問題文テスト${i}です`,
    explanation: `解説文テスト${i}です`,
    choices: [
      { choiceText: '正解選択肢', isCorrect: true },
      { choiceText: '不正解選択肢', isCorrect: false },
      { choiceText: '不正解2', isCorrect: false },
      { choiceText: '不正解3', isCorrect: false },
    ],
  }));
}

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
      generateContent: (req: any) => mockGenerateContent(req),
    },
  })),
  Type: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    STRING: 'STRING',
    BOOLEAN: 'BOOLEAN',
    INTEGER: 'INTEGER',
  },
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

describe('POST /api/quiz/ai-generate-questions', () => {
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
      hasCreatorEntitlements: true,
      hasUnlimitedAiQuestions: true,
    });
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(makeGeminiQuestions()),
    });
  });

  function makeRequest(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/quiz/ai-generate-questions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  test('Pro ユーザは 200 で 10 問と usage を返す', async () => {
    const res = await POST(
      makeRequest({
        prompt: '歴史クイズ',
        format: 'multiple-choice',
        userId: 'uid-pro',
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toHaveLength(AI_QUIZ_QUESTION_COUNT);
    expect(body.usage).toBeDefined();
    expect(mockRpc).toHaveBeenCalledWith('handle_increment_daily_usage_counter', {
      p_user_id: 'uid-pro',
      p_counter_key: 'questions',
      p_today: '2026-06-10',
    });
  });

  test('非 Pro は 403', async () => {
    mockVerify.mockResolvedValue('uid-free');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: false,
      hasCreatorEntitlements: false,
      hasUnlimitedAiQuestions: false,
    });
    const res = await POST(
      makeRequest({
        prompt: '歴史クイズ',
        format: 'multiple-choice',
        userId: 'uid-free',
      })
    );
    expect(res.status).toBe(403);
  });

  test('日次上限は 429', async () => {
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
      hasCreatorEntitlements: true,
      hasUnlimitedAiQuestions: false,
    });
    counterState.questions = { count: 100, counter_date: '2026-06-10' };
    const res = await POST(
      makeRequest({
        prompt: '歴史クイズ',
        format: 'multiple-choice',
        userId: 'uid-pro',
      })
    );
    expect(res.status).toBe(429);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('検証失敗は 422', async () => {
    const invalid = makeGeminiQuestions();
    invalid[0].questionText = '短';
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(invalid),
    });
    const res = await POST(
      makeRequest({
        prompt: '歴史クイズ',
        format: 'multiple-choice',
        userId: 'uid-pro',
      })
    );
    expect(res.status).toBe(422);
  });

  test('sorting 形式のスキーマには choices や correctTextAnswerList が含まれない', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(
        Array.from({ length: 10 }, (_, i) => ({
          type: 'sorting',
          questionText: `並べ替え問題テスト${i}です`,
          explanation: `解説テスト${i}です`,
          sortingItems: [
            { text: 'A', correctOrder: 0 },
            { text: 'B', correctOrder: 1 },
          ],
        }))
      ),
    });

    const res = await POST(
      makeRequest({
        prompt: '歴史クイズ',
        format: 'sorting',
        userId: 'uid-pro',
      })
    );
    expect(res.status).toBe(200);

    expect(mockGenerateContent).toHaveBeenCalled();
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const schema = callArgs.config.responseSchema.items;

    // sorting 形式のプロパティから choices と correctTextAnswerList が排除されていることを検証
    expect(schema.properties.sortingItems).toBeDefined();
    expect(schema.properties.choices).toBeUndefined();
    expect(schema.properties.correctTextAnswerList).toBeUndefined();
    expect(schema.required).toContain('sortingItems');
  });

  test('mixed 形式のスキーマは anyOf で4つの問題タイプを定義している', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(
        Array.from({ length: 10 }, (_, i) => ({
          type: 'multiple-choice',
          questionText: `問題文テスト${i}です`,
          explanation: `解説文テスト${i}です`,
          choices: [
            { choiceText: 'A', isCorrect: true },
            { choiceText: 'B', isCorrect: false },
          ],
        }))
      ),
    });

    const res = await POST(
      makeRequest({
        prompt: '歴史クイズ',
        format: 'mixed',
        userId: 'uid-pro',
      })
    );
    expect(res.status).toBe(200);

    expect(mockGenerateContent).toHaveBeenCalled();
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const schema = callArgs.config.responseSchema.items;

    // anyOf が定義されており、各タイプが含まれていることを検証
    expect(schema.anyOf).toBeDefined();
    expect(schema.anyOf).toHaveLength(5);

    const types = schema.anyOf.map((sub: any) => sub.properties.type.enum[0]);
    expect(types).toContain('multiple-choice');
    expect(types).toContain('true-false');
    expect(types).toContain('text-input');
    expect(types).toContain('sorting');
    expect(types).toContain('association');
  });
});
