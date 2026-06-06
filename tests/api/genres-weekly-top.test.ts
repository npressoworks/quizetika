import { GET } from '../../src/app/api/genres/weekly-top/route';
import { NextRequest } from 'next/server';
import { getAdminFirestore } from '../../src/lib/firebase/admin';

// firebase-admin/firestore のモック
jest.mock('../../src/lib/firebase/admin', () => {
  const mockFirestore = {
    collection: jest.fn(),
  };
  return {
    getAdminFirestore: () => mockFirestore,
  };
});

describe('GET /api/genres/weekly-top', () => {
  let mockFirestore: any;
  let mockAttemptsQuery: any;
  let mockQuizzesQuery: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore = getAdminFirestore();

    // attempts クエリのモック設定
    mockAttemptsQuery = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn(),
    };

    // quizzes 取得のモック設定
    mockQuizzesQuery = {
      doc: jest.fn(),
    };

    mockFirestore.collection.mockImplementation((name: string) => {
      if (name === 'attempts') return mockAttemptsQuery;
      if (name === 'quizzes') return mockQuizzesQuery;
      return {};
    });
  });

  test('直近7日間の attempts に紐づくクイズのジャンルを集計し、上位5件を降順で返すこと', async () => {
    // 過去7日間の attempts をモック
    const mockAttempts = [
      { id: 'att-1', quizId: 'quiz-a', completedAt: new Date() }, // genre: g-1
      { id: 'att-2', quizId: 'quiz-a', completedAt: new Date() }, // genre: g-1
      { id: 'att-3', quizId: 'quiz-b', completedAt: new Date() }, // genre: g-2
      { id: 'att-4', quizId: 'quiz-c', completedAt: new Date() }, // genre: g-1
      { id: 'att-5', quizId: 'quiz-d', completedAt: new Date() }, // genre: g-3
      { id: 'att-6', quizId: 'quiz-b', completedAt: new Date() }, // genre: g-2
    ];

    mockAttemptsQuery.get.mockResolvedValue({
      docs: mockAttempts.map(data => ({
        id: data.id,
        data: () => data,
      })),
    });

    // クイズ情報をモック (status は published のみ集計対象)
    const mockQuizzes: Record<string, any> = {
      'quiz-a': { id: 'quiz-a', canonicalGenreId: 'genre-1', status: 'published' },
      'quiz-b': { id: 'quiz-b', canonicalGenreId: 'genre-2', status: 'published' },
      'quiz-c': { id: 'quiz-c', canonicalGenreId: 'genre-1', status: 'published' },
      'quiz-d': { id: 'quiz-d', canonicalGenreId: 'genre-3', status: 'published' },
    };

    mockQuizzesQuery.doc.mockImplementation((id: string) => ({
      get: jest.fn().mockResolvedValue({
        id,
        exists: !!mockQuizzes[id],
        data: () => mockQuizzes[id],
      }),
    }));

    const req = new NextRequest('http://localhost/api/genres/weekly-top');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.genres).toBeDefined();
    // genre-1 (quiz-a, quiz-c) -> 3プレイ
    // genre-2 (quiz-b) -> 2プレイ
    // genre-3 (quiz-d) -> 1プレイ
    expect(data.genres).toEqual([
      { genreId: 'genre-1', playCount: 3 },
      { genreId: 'genre-2', playCount: 2 },
      { genreId: 'genre-3', playCount: 1 },
    ]);
  });

  test('attempts が存在しない場合は空配列を返すこと', async () => {
    mockAttemptsQuery.get.mockResolvedValue({ docs: [] });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.genres).toEqual([]);
  });

  test('published 以外のクイズ（draft等）や存在しないクイズのプレイは集計から除外すること', async () => {
    const mockAttempts = [
      { id: 'att-1', quizId: 'quiz-published', completedAt: new Date() }, // published
      { id: 'att-2', quizId: 'quiz-draft', completedAt: new Date() },     // draft
      { id: 'att-3', quizId: 'quiz-missing', completedAt: new Date() },   // missing
    ];

    mockAttemptsQuery.get.mockResolvedValue({
      docs: mockAttempts.map(data => ({
        id: data.id,
        data: () => data,
      })),
    });

    const mockQuizzes: Record<string, any> = {
      'quiz-published': { id: 'quiz-published', canonicalGenreId: 'genre-1', status: 'published' },
      'quiz-draft': { id: 'quiz-draft', canonicalGenreId: 'genre-2', status: 'draft' },
    };

    mockQuizzesQuery.doc.mockImplementation((id: string) => ({
      get: jest.fn().mockResolvedValue({
        id,
        exists: !!mockQuizzes[id],
        data: () => mockQuizzes[id],
      }),
    }));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.genres).toEqual([
      { genreId: 'genre-1', playCount: 1 },
    ]);
  });

  test('Firestore 接続エラーなどの例外発生時は 500 エラーを返すこと', async () => {
    mockAttemptsQuery.get.mockRejectedValue(new Error('Database Connection Error'));

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('internal-error');
  });
});
