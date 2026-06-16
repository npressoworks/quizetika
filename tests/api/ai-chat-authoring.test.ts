import { POST } from '@/app/api/quiz/ai-chat-authoring/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockResolveEntitlements = jest.fn();
const mockRunTransaction = jest.fn(async (fn: (tx: { set: jest.Mock }) => Promise<void>) => {
  await fn({ set: jest.fn() });
});

const mockChatSnap = { data: () => ({ count: 5, lastUpdatedDate: '2026-06-10' }) };
const mockChatRef = { get: jest.fn(async () => mockChatSnap) };
const mockQuestionsRef = { get: jest.fn(async () => ({ data: () => ({ count: 0, lastUpdatedDate: '2026-06-10' }) })) };
const mockThumbnailRef = { get: jest.fn(async () => ({ data: () => ({ count: 0, lastUpdatedDate: '2026-06-10' }) })) };

const mockDb = {
  collection: jest.fn((name: string) => {
    if (name === 'users') {
      return {
        doc: jest.fn(() => ({
          collection: jest.fn((sub: string) => {
            if (sub === 'dailyAiAuthoringCounts') {
              return {
                doc: jest.fn((docId: string) => {
                  if (docId === 'chat') return mockChatRef;
                  if (docId === 'questions') return mockQuestionsRef;
                  return mockThumbnailRef;
                }),
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

jest.mock('@/lib/firebase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@/services/entitlement', () => ({
  resolveUserEntitlements: (...args: unknown[]) => mockResolveEntitlements(...args),
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

// streamText のモック
const mockStreamText = jest.fn();
jest.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
}));

describe('POST /api/quiz/ai-chat-authoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue('uid-pro');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
      hasUnlimitedAiQuestions: false,
    });
    mockStreamText.mockReturnValue({
      toDataStreamResponse: () => new Response('mocked-stream', { status: 200 }),
    });
    mockChatSnap.data = () => ({ count: 5, lastUpdatedDate: '2026-06-10' });
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
        messages: [{ role: 'user', content: 'こんにちは' }],
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
        messages: [{ role: 'user', content: 'こんにちは' }],
        quizState: { title: '', description: '', genre: '', tags: [], questions: [] },
      })
    );
    expect(res.status).toBe(403);
  });

  test('日次チャット回数超過は 429', async () => {
    mockChatSnap.data = () => ({ count: 100, lastUpdatedDate: '2026-06-10' });
    const res = await POST(
      makeRequest({
        userId: 'uid-pro',
        messages: [{ role: 'user', content: 'こんにちは' }],
        quizState: { title: '', description: '', genre: '', tags: [], questions: [] },
      })
    );
    expect(res.status).toBe(429);
  });

  test('Pro ユーザーは 200 とストリームレスポンスを返し、カウンタをインクリメントする', async () => {
    const res = await POST(
      makeRequest({
        userId: 'uid-pro',
        messages: [{ role: 'user', content: 'こんにちは' }],
        quizState: { title: 'テストクイズ', description: 'テストです', genre: '歴史', tags: ['テスト'], questions: [] },
      })
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('mocked-stream');
    expect(mockRunTransaction).toHaveBeenCalled();
  });
});
