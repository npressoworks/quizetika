import { POST } from '@/app/api/attempt/verify-truth/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockGenerateContent = jest.fn();
const mockAttemptUpdate = jest.fn();
const mockRunTransaction = jest.fn();
const mockTxUpdate = jest.fn();

const quizData = {
  questions: [
    {
      id: 'q-1',
      type: 'lateral-thinking',
      aiContextDetails: '男は遭難しウミガメのスープを飲んだ',
      truthKeywords: ['ウミガメ', '遭難', 'スープ'],
    },
  ],
};

const attemptData = {
  userId: 'uid-1',
  quizId: 'quiz-1',
  totalQuestions: 1,
  elapsedSeconds: 120,
  mode: 'normal',
};

const mockAttemptRef = {
  get: jest.fn(async () => ({ exists: true, data: () => attemptData, id: 'att-1' })),
  update: (...args: unknown[]) => mockAttemptUpdate(...args),
};

const mockQuizRef = {
  get: jest.fn(async () => ({ exists: true, data: () => quizData, id: 'quiz-1' })),
};

const mockAttemptsQueryGet = jest.fn(async () => ({ docs: [] }));

function createAttemptsCollection() {
  const queryBuilder = {
    where: jest.fn(() => queryBuilder),
    get: mockAttemptsQueryGet,
  };
  return {
    doc: jest.fn(() => mockAttemptRef),
    where: jest.fn(() => queryBuilder),
  };
}

const mockDb = {
  collection: jest.fn((name: string) => {
    if (name === 'attempts') {
      return createAttemptsCollection();
    }
    if (name === 'quizzes') {
      return { doc: jest.fn(() => mockQuizRef) };
    }
    return { doc: jest.fn() };
  }),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
};

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifySupabaseAccessToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    }),
  })),
}));

jest.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: () => mockDb,
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayUnion: jest.fn((v: unknown) => ({ __arrayUnion: v })),
    increment: jest.fn((v: number) => ({ __increment: v })),
  },
}));

jest.mock('@/lib/leaderboard-update', () => ({
  buildLeaderboardUpdatesForQuiz: () => null,
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
    mockAttemptUpdate.mockResolvedValue(undefined);
    mockTxUpdate.mockClear();
    mockRunTransaction.mockImplementation(async (_fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        get: async () => ({ exists: true, data: () => ({}) }),
        update: mockTxUpdate,
      };
      await _fn(tx);
    });
  });

  it('常に Gemini を呼び出し、プロンプトにエッセンスキーワードを含める', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'VERDICT: INCORRECT\nREASON: MISSING_ESSENCE' },
    });

    const summary = '男は遭難しウミガメのスープを飲んだ';
    const res = await POST(
      buildRequest({ attemptId: 'att-1', userId: 'uid-1', truthSummary: summary })
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const prompt = mockGenerateContent.mock.calls[0][0] as string;
    expect(prompt).toContain('ウミガメ');
    expect(prompt).toContain('遭難');
    expect(prompt).toContain('文字列の完全一致を合格条件としない');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isCorrect).toBe(false);
    expect(body.advice).toBe('必須要素が足りていません。');
  });

  it('キーワードが要約に全て含まれていても AI 判定結果に従う（バイパスなし）', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'VERDICT: INCORRECT\nREASON: UNRELATED' },
    });

    const summary = '男は遭難し、ウミガメのスープを飲んだ';
    const res = await POST(
      buildRequest({ attemptId: 'att-1', userId: 'uid-1', truthSummary: summary })
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.isCorrect).toBe(false);
    expect(mockAttemptUpdate).toHaveBeenCalled();
  });

  it('AI が CORRECT のとき合格レスポンスを返す', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'VERDICT: CORRECT\nお見事！' },
    });

    const res = await POST(
      buildRequest({
        attemptId: 'att-1',
        userId: 'uid-1',
        truthSummary: '真相の要約',
        displayName: 'Player',
      })
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.isCorrect).toBe(true);
    expect(body.advice).toBeNull();
    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        questionAnswerDetails: [
          expect.objectContaining({
            questionId: 'q-1',
            questionType: 'lateral-thinking',
            isCorrect: true,
            lateralPlayEndedStatus: 'passed',
            truthSummary: '真相の要約',
          })
        ]
      })
    );
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
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});
