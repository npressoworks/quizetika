import { POST } from '@/app/api/attempt/give-up-lateral/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockRunTransaction = jest.fn();

const quizData = {
  questions: [
    {
      type: 'lateral-thinking',
      explanation: 'プレイヤー向けの解説',
      aiContextDetails: '裏設定の真相',
    },
  ],
};

const attemptData = {
  userId: 'uid-1',
  quizId: 'quiz-1',
  totalQuestions: 1,
  elapsedSeconds: 60,
  failedQuestionIds: ['q-1'],
  mode: 'normal',
};

const mockAttemptRef = {
  get: jest.fn(async () => ({ exists: true, data: () => attemptData, id: 'att-1' })),
};

const mockQuizRef = {
  get: jest.fn(async () => ({ exists: true, data: () => quizData, id: 'quiz-1' })),
};

const mockDb = {
  collection: jest.fn((name: string) => {
    if (name === 'attempts') {
      return { doc: jest.fn(() => mockAttemptRef) };
    }
    if (name === 'quizzes') {
      return { doc: jest.fn(() => mockQuizRef) };
    }
    return { doc: jest.fn() };
  }),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
};

jest.mock('@/lib/firebase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: () => mockDb,
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: jest.fn((v: number) => ({ __increment: v })),
  },
}));

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
    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        get: async () => ({ exists: true, data: () => quizData }),
        update: jest.fn(),
      };
      await fn(tx);
    });
    mockAttemptRef.get.mockResolvedValue({ exists: true, data: () => attemptData, id: 'att-1' });
  });

  it('諦め時に explanation を返し attempt を完了する', async () => {
    const res = await POST(buildRequest({ attemptId: 'att-1', userId: 'uid-1' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revealText).toBe('プレイヤー向けの解説');
    expect(mockRunTransaction).toHaveBeenCalled();
  });

  it('既に完了済みの attempt は 409 を返す', async () => {
    mockAttemptRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ ...attemptData, completedAt: new Date() }),
      id: 'att-1',
    });

    const res = await POST(buildRequest({ attemptId: 'att-1', userId: 'uid-1' }));

    expect(res.status).toBe(409);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('認証失敗時は 401 を返す', async () => {
    mockVerify.mockResolvedValue(null);

    const res = await POST(buildRequest({ attemptId: 'att-1', userId: 'uid-1' }));

    expect(res.status).toBe(401);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});
