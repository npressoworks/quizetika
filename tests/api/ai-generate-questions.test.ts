import { POST } from '@/app/api/quiz/ai-generate-questions/route';
import { NextRequest } from 'next/server';
import { AI_QUIZ_QUESTION_COUNT } from '@/services/ai-authoring-utils';

const mockVerify = jest.fn();
const mockResolveEntitlements = jest.fn();
const mockGenerateContent = jest.fn();
const mockRunTransaction = jest.fn(async (fn: (tx: { set: jest.Mock }) => Promise<void>) => {
  await fn({ set: jest.fn() });
});

const mockQuestionsRef = { get: jest.fn(async () => ({ data: () => ({ count: 0, lastUpdatedDate: '2026-06-10' }) }) };
const mockThumbnailRef = { get: jest.fn(async () => ({ data: () => ({ count: 0, lastUpdatedDate: '2026-06-10' }) }) };

const mockDb = {
  collection: jest.fn((name: string) => {
    if (name === 'users') {
      return {
        doc: jest.fn(() => ({
          collection: jest.fn((sub: string) => {
            if (sub === 'dailyAiAuthoringCounts') {
              return {
                doc: jest.fn((docId: string) =>
                  docId === 'questions' ? mockQuestionsRef : mockThumbnailRef
                ),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };
    }
    return { doc: jest.fn() };
  }),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
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

jest.mock('@/lib/firebase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@/services/entitlement', () => ({
  resolveUserEntitlements: (...args: unknown[]) => mockResolveEntitlements(...args),
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    }),
  })),
  SchemaType: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    STRING: 'STRING',
    BOOLEAN: 'BOOLEAN',
    INTEGER: 'INTEGER',
  },
}));

jest.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: () => mockDb,
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
    mockVerify.mockResolvedValue('uid-pro');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
      hasUnlimitedAiQuestions: true,
    });
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(makeGeminiQuestions()) },
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
  });

  test('非 Pro は 403', async () => {
    mockVerify.mockResolvedValue('uid-free');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: false,
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
      hasUnlimitedAiQuestions: false,
    });
    mockQuestionsRef.get.mockResolvedValue({
      data: () => ({ count: 100, lastUpdatedDate: '2026-06-10' }),
    });
    const res = await POST(
      makeRequest({
        prompt: '歴史クイズ',
        format: 'multiple-choice',
        userId: 'uid-pro',
      })
    );
    expect(res.status).toBe(429);
  });

  test('検証失敗は 422', async () => {
    const invalid = makeGeminiQuestions();
    invalid[0].questionText = '短';
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(invalid) },
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
});
