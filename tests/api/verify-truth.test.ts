import { POST } from '@/app/api/attempt/verify-truth/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockGenerateContent = jest.fn();
const mockRpc = jest.fn();
const mockResolveUserEntitlements = jest.fn();

function todayJstString(): string {
  const d = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(d.getTime() + jstOffset);
  const yyyy = jstDate.getUTCFullYear();
  const mm = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jstDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const TODAY = todayJstString();

const attemptData = {
  id: 'att-1',
  user_id: 'uid-1',
  quiz_id: 'quiz-1',
  total_questions: 1,
  elapsed_seconds: 120,
  completed_at: null,
};

const lateralQuestionRow = {
  id: 'q-1',
  type: 'lateral-thinking',
  question_text: '',
  explanation: '',
  image_url: null,
  hint: null,
  limit_time: null,
  correct_text_answer_list: null,
  text_input_mode: null,
  text_input_char_count: null,
  choices: null,
  sorting_items: null,
  association_hints: null,
  ai_context_details: '男は遭難しウミガメのスープを飲んだ',
  truth_keywords: ['ウミガメ', '遭難', 'スープ'],
  source_url: null,
  correct_count: 0,
  incorrect_count: 0,
  bookmarks_count: 0,
  author_id: null,
  author_name: null,
  author_avatar: null,
  link_kind: null,
  owner_quiz_id: 'quiz-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

let attemptResolveValue: { data: unknown; error: unknown } = { data: attemptData, error: null };
let perQuizResolveValue: { data: unknown; error: unknown } = { data: null, error: null };
let globalResolveValue: { data: unknown; error: unknown } = { data: null, error: null };
let quizQuestionsResolveValue: { data: unknown; error: unknown } = {
  data: [{ question: lateralQuestionRow }],
  error: null,
};

function createChain(resolveValue: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(resolveValue)),
    then: (onFulfilled: any, onRejected: any) =>
      Promise.resolve(resolveValue).then(onFulfilled, onRejected),
  };
  return chain;
}

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: jest.fn((table: string) => {
      if (table === 'attempts') return createChain(attemptResolveValue);
      if (table === 'ai_turn_counts_per_quiz') return createChain(perQuizResolveValue);
      if (table === 'ai_turn_counts_global') return createChain(globalResolveValue);
      if (table === 'quiz_questions') return createChain(quizQuestionsResolveValue);
      return createChain({ data: null, error: null });
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifySupabaseAccessToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@/services/entitlement', () => ({
  resolveUserEntitlements: (...args: unknown[]) => mockResolveUserEntitlements(...args),
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    },
  })),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING' },
}));

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/attempt/verify-truth', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
  });
}

describe('POST /api/attempt/verify-truth (Phase 15)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue('uid-1');
    mockResolveUserEntitlements.mockResolvedValue({ hasUnlimitedAiQuestions: false });
    attemptResolveValue = { data: attemptData, error: null };
    perQuizResolveValue = { data: null, error: null };
    globalResolveValue = { data: null, error: null };
    quizQuestionsResolveValue = { data: [{ question: lateralQuestionRow }], error: null };
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it('常に Gemini を呼び出し、プロンプトにエッセンスキーワードを含める', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '{"verdict":"INCORRECT","reason":"MISSING_ESSENCE"}',
    });

    const summary = '男は遭難しウミガメのスープを飲んだ';
    const res = await POST(
      buildRequest({ attemptId: 'att-1', userId: 'uid-1', truthSummary: summary })
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const prompt = mockGenerateContent.mock.calls[0][0].contents as string;
    expect(prompt).toContain('ウミガメ');
    expect(prompt).toContain('遭難');
    expect(prompt).toContain('文字列の完全一致を合格条件としない');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isCorrect).toBe(false);
    expect(body.advice).toBe('必須要素が足りていません。');
    expect(mockRpc).toHaveBeenCalledWith(
      'handle_complete_lateral_attempt',
      expect.objectContaining({ p_attempt_id: 'att-1', p_is_correct: false })
    );
  });

  it('キーワードが要約に全て含まれていても AI 判定結果に従う（バイパスなし）', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '{"verdict":"INCORRECT","reason":"UNRELATED"}',
    });

    const summary = '男は遭難し、ウミガメのスープを飲んだ';
    const res = await POST(
      buildRequest({ attemptId: 'att-1', userId: 'uid-1', truthSummary: summary })
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.isCorrect).toBe(false);
    expect(mockRpc).toHaveBeenCalled();
  });

  it('真相判定1回をAI質問と共通のターンとして記録する（handle_record_ai_turn）', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '{"verdict":"CORRECT"}',
    });

    await POST(
      buildRequest({ attemptId: 'att-1', userId: 'uid-1', truthSummary: '真相の要約' })
    );

    expect(mockRpc).toHaveBeenCalledWith(
      'handle_record_ai_turn',
      expect.objectContaining({
        p_attempt_id: null,
        p_user_id: 'uid-1',
        p_quiz_id: 'quiz-1',
        p_history_entry: null,
        p_per_quiz_limit: 30,
        p_global_limit: 150,
      })
    );
  });

  it('日次上限に達している場合は Gemini を呼ばず 429 を返す', async () => {
    perQuizResolveValue = { data: { count: 30, count_date: TODAY }, error: null };

    const res = await POST(
      buildRequest({ attemptId: 'att-1', userId: 'uid-1', truthSummary: '真相の要約' })
    );

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('limit-exceeded');
    expect(body.limitType).toBe('per-quiz');
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('Pro ユーザーは上限超過状態でも判定できる', async () => {
    mockResolveUserEntitlements.mockResolvedValue({ hasUnlimitedAiQuestions: true });
    perQuizResolveValue = { data: { count: 999, count_date: TODAY }, error: null };
    globalResolveValue = { data: { count: 999, count_date: TODAY }, error: null };
    mockGenerateContent.mockResolvedValue({ text: '{"verdict":"CORRECT"}' });

    const res = await POST(
      buildRequest({ attemptId: 'att-1', userId: 'uid-1', truthSummary: '真相の要約' })
    );

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'handle_record_ai_turn',
      expect.objectContaining({ p_per_quiz_limit: null, p_global_limit: null })
    );
  });

  it('AI が CORRECT のとき合格レスポンスを返し、RPCへ経過秒数と総問題数を渡す', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '{"verdict":"CORRECT"}',
    });

    const res = await POST(
      buildRequest({
        attemptId: 'att-1',
        userId: 'uid-1',
        truthSummary: '真相の要約',
        elapsedSeconds: 150,
      })
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.isCorrect).toBe(true);
    expect(body.advice).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('handle_complete_lateral_attempt', {
      p_attempt_id: 'att-1',
      p_user_id: 'uid-1',
      p_quiz_id: 'quiz-1',
      p_is_correct: true,
      p_truth_attempt: expect.objectContaining({
        truthText: '真相の要約',
        isCorrect: true,
      }),
      p_elapsed_seconds: 150,
      p_total_questions: 1,
    });
  });

  it('Gemini 例外時は 503 を返し代替合格しない', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API down'));

    const summary = '男は遭難しウミガメのスープを飲んだ';
    const res = await POST(
      buildRequest({ attemptId: 'att-1', userId: 'uid-1', truthSummary: summary })
    );

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('ai-error');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('認証失敗時は 401 を返す', async () => {
    mockVerify.mockResolvedValue(null);

    const res = await POST(
      buildRequest({ attemptId: 'att-1', userId: 'uid-1', truthSummary: 'x' })
    );

    expect(res.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('他ユーザーの attempt は 403 を返す', async () => {
    attemptResolveValue = { data: { ...attemptData, user_id: 'other-uid' }, error: null };

    const res = await POST(
      buildRequest({ attemptId: 'att-1', userId: 'uid-1', truthSummary: 'x' })
    );

    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
