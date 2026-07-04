import { GET } from '../../src/app/api/genres/weekly-top/route';
import { createAdminClient } from '../../src/lib/supabase/server';

// チェーン用のモックヘルパー
const createChainMock = (resolveValue: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    in: jest.fn(() => chain),
    then: jest.fn((onFulfilled: any) => Promise.resolve(resolveValue).then(onFulfilled)),
  };
  return chain;
};

jest.mock('../../src/lib/supabase/server', () => {
  const mock: any = {
    from: jest.fn(),
  };
  return {
    createAdminClient: () => mock,
  };
});

describe('GET /api/genres/weekly-top', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createAdminClient();
  });

  test('直近7日間の attempts に紐づくクイズのジャンルを集計し、上位5件を降順で返すこと', async () => {
    const mockAttempts = [
      { quiz_id: 'quiz-a' }, // genre: genre-1
      { quiz_id: 'quiz-a' }, // genre: genre-1
      { quiz_id: 'quiz-b' }, // genre: genre-2
      { quiz_id: 'quiz-c' }, // genre: genre-1
      { quiz_id: 'quiz-d' }, // genre: genre-3
      { quiz_id: 'quiz-b' }, // genre: genre-2
    ];

    const mockQuizzes = [
      { id: 'quiz-a', canonical_genre_id: 'genre-1', genre: 'g1', status: 'published' },
      { id: 'quiz-b', canonical_genre_id: 'genre-2', genre: 'g2', status: 'published' },
      { id: 'quiz-c', canonical_genre_id: 'genre-1', genre: 'g1', status: 'published' },
      { id: 'quiz-d', canonical_genre_id: 'genre-3', genre: 'g3', status: 'published' },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'attempts') {
        return createChainMock({ data: mockAttempts, error: null });
      }
      if (table === 'quizzes') {
        return createChainMock({ data: mockQuizzes, error: null });
      }
      return createChainMock({ data: [], error: null });
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.genres).toEqual([
      { genreId: 'genre-1', playCount: 3 },
      { genreId: 'genre-2', playCount: 2 },
      { genreId: 'genre-3', playCount: 1 },
    ]);
  });

  test('attempts が存在しない場合は空配列を返すこと', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'attempts') {
        return createChainMock({ data: [], error: null });
      }
      return createChainMock({ data: [], error: null });
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.genres).toEqual([]);
  });

  test('published 以外のクイズ（draft等）や存在しないクイズのプレイは集計から除外すること', async () => {
    const mockAttempts = [
      { quiz_id: 'quiz-published' },
      { quiz_id: 'quiz-draft' },
      { quiz_id: 'quiz-missing' },
    ];

    const mockQuizzes = [
      { id: 'quiz-published', canonical_genre_id: 'genre-1', genre: 'g1', status: 'published' },
      { id: 'quiz-draft', canonical_genre_id: 'genre-2', genre: 'g2', status: 'draft' },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'attempts') {
        return createChainMock({ data: mockAttempts, error: null });
      }
      if (table === 'quizzes') {
        return createChainMock({ data: mockQuizzes, error: null });
      }
      return createChainMock({ data: [], error: null });
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.genres).toEqual([
      { genreId: 'genre-1', playCount: 1 },
    ]);
  });

  test('Supabase 接続エラーなどの例外発生時は 500 エラーを返すこと', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'attempts') {
        return createChainMock({ data: null, error: { message: 'Database Connection Error' } });
      }
      return createChainMock({ data: [], error: null });
    });

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('internal-error');
  });
});
