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
  runTransaction: (updateFn: any) => mockRunTransaction(updateFn),
};

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifySupabaseAccessToken: (token: any) => mockVerify(token),
}));

jest.mock('@/services/entitlement', () => ({
  resolveUserEntitlements: (uid: any) => mockResolveEntitlements(uid),
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
    mockVerify.mockResolvedValue('uid-pro');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
      hasUnlimitedAiQuestions: false,
    });
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: () => new Response('mocked-stream', { status: 200 }),
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
    mockChatSnap.data = () => ({ count: 100, lastUpdatedDate: '2026-06-10' });
    const res = await POST(
      makeRequest({
        userId: 'uid-pro',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'こんにちは' }] }],
        quizState: { title: '', description: '', genre: '', tags: [], questions: [] },
      })
    );
    expect(res.status).toBe(429);
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
    expect(mockRunTransaction).toHaveBeenCalled();
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

