import { searchQuizzes } from '../../src/services/quiz';
import type { Quiz } from '../../src/types';

jest.mock('../../src/lib/search-log', () => ({
  writeSearchLog: jest.fn().mockResolvedValue(undefined),
}));

// チェーン用のモックヘルパー
const createChainMock = (resolveValue: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    contains: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    order: jest.fn(() => chain),
    or: jest.fn(() => chain),
    is: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(resolveValue)),
    then: jest.fn((onFulfilled) => {
      return Promise.resolve(resolveValue).then(onFulfilled);
    }),
  };
  return chain;
};

// Supabase クライアントのモックを作成
jest.mock('@/lib/supabase/client', () => {
  const mock: any = {
    from: jest.fn(() => mock),
    // 念のためルートも Thenable にしておく
    then: jest.fn((onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled)),
  };
  return {
    createClient: () => mock,
  };
});

import { createClient } from '@/lib/supabase/client';
const mockSupabase = createClient() as any;

// metadata-resolution.ts もモック化する
jest.mock('../../src/lib/metadata-resolution', () => {
  return {
    resolveCanonicalGenreId: jest.fn((genreId) => Promise.resolve(genreId)),
    expandGenreIdsForQuery: jest.fn((genreId) => Promise.resolve([genreId])),
    chunkIdsForInQuery: jest.fn((ids) => [ids]),
    dedupeQuizzesById: jest.fn((quizzes) => {
      const map = new Map();
      quizzes.forEach((q: any) => map.set(q.id, q));
      return Array.from(map.values());
    }),
    sortQuizzesForList: jest.fn((quizzes) => quizzes),
    normalizeTag: jest.fn((tag) => tag.toLowerCase()),
    resolveCanonicalTagIds: jest.fn((tags) => Promise.resolve(tags)),
    quizMatchesGenreFilter: jest.fn((quiz, expandedIds) => {
      return expandedIds.has(quiz.genre) || (quiz.canonicalGenreId && expandedIds.has(quiz.canonicalGenreId));
    }),
  };
});

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'q-default',
    authorId: 'author-1',
    authorName: '作者',
    authorAvatar: '',
    title: 'JavaScript 入門',
    description: 'JavaScript の基本を学ぶクイズ',
    thumbnailUrl: null,
    difficulty: 3,
    genre: 'programming',
    tags: ['js', 'web'],
    originalTags: [],
    questionIds: [],
    questions: [],
    questionCount: 5,
    status: 'published',
    flagsCount: 0,
    playCount: 10,
    bookmarksCount: 5,
    positiveCount: 0,
    negativeCount: 0,
    tempPositiveCount: 0,
    tempNegativeCount: 0,
    reviewScore: null,
    reviewBadge: null,
    isReviewMasked: false,
    activeResetRequestId: null,
    canonicalGenreId: 'programming',
    canonicalTagIds: ['js', 'web'],
    leaderboardFirstPlay: [],
    leaderboardReplay: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** `quiz_tags` / `quiz_questions` の埋め込みを含む Row を生成する（QUIZ_SELECT_WITH_RELATIONS 相当） */
function makeQuizRow(quiz: Quiz) {
  const tagIds = quiz.tags ?? [];
  return {
    id: quiz.id,
    author_id: quiz.authorId,
    author_name: quiz.authorName,
    author_avatar: quiz.authorAvatar || null,
    title: quiz.title,
    description: quiz.description,
    thumbnail_url: quiz.thumbnailUrl,
    difficulty: quiz.difficulty,
    genre: quiz.genre,
    question_count: quiz.questionCount,
    status: quiz.status,
    visibility: quiz.visibility ?? 'public',
    flags_count: quiz.flagsCount,
    play_count: quiz.playCount,
    bookmarks_count: quiz.bookmarksCount,
    positive_count: quiz.positiveCount,
    negative_count: quiz.negativeCount,
    temp_positive_count: quiz.tempPositiveCount,
    temp_negative_count: quiz.tempNegativeCount,
    review_score: quiz.reviewScore,
    created_at: quiz.createdAt.toISOString(),
    updated_at: quiz.updatedAt.toISOString(),
    quiz_tags: tagIds.map((tagId, i) => ({ tag_id: tagId, original_label: quiz.originalTags?.[i] ?? tagId })),
    quiz_questions: [],
  };
}

describe('searchQuizzes (統合検索 - ユニバーサル検索)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockClear();
  });

  test('queryText が指定された場合、並行クエリを実行し、重複排除と部分一致フィルタ、詳細条件フィルタを適用する', async () => {
    const mockQuizzes = [
      makeQuiz({ id: '1', title: 'JavaScript 入門', authorName: 'ユーザーA', genre: 'programming', tags: ['js'] }),
      makeQuiz({ id: '2', title: 'Python 基礎', authorName: 'ユーザーB', description: 'Pythonと機械学習', tags: ['python'] }),
      makeQuiz({ id: '3', title: 'React の世界', authorName: 'ユーザーA', genre: 'web-front', tags: ['react', 'js'] }),
      makeQuiz({ id: '4', title: 'TypeScript 入門', authorName: 'ユーザーC', tags: ['ts', 'js'], difficulty: 4, questionCount: 15 }),
    ];

    let queryCallCount = 0;

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quiz_tags') {
        // quiz_tags 経由のタグ検索（tag_id = 'js'）
        const chain = createChainMock({ data: [], error: null });
        chain.eq.mockImplementation((field: string, val: string) => {
          if (field === 'tag_id' && val === 'js') {
            queryCallCount++;
            const matched = mockQuizzes.filter((q) => q.tags.includes('js'));
            return createChainMock({ data: matched.map((q) => ({ quiz_id: q.id })), error: null });
          }
          return createChainMock({ data: [], error: null });
        });
        return chain;
      }

      if (table === 'quizzes') {
        const chain = createChainMock({ data: [], error: null });

        // in('id', tagQuizIds) が呼ばれたら quiz_tags 検索結果に対応するクイズ本体
        chain.in.mockImplementation((field: string, ids: string[]) => {
          if (field === 'id') {
            const matched = mockQuizzes.filter((q) => ids.includes(q.id));
            return createChainMock({ data: matched.map(makeQuizRow), error: null });
          }
          return chain;
        });

        // eq('author_name', 'js') が呼ばれたら作者検索用の結果
        chain.eq.mockImplementation((field: string, val: string) => {
          if (field === 'author_name' && val === 'js') {
            queryCallCount++;
            return createChainMock({
              data: mockQuizzes.filter(q => q.authorName === 'js').map(makeQuizRow),
              error: null,
            });
          }
          return chain;
        });

        // それ以外の limit() など、新着一覧取得用
        chain.limit.mockImplementation(() => {
          queryCallCount++;
          return createChainMock({
            data: mockQuizzes.map(makeQuizRow),
            error: null,
          });
        });

        return chain;
      }
      return createChainMock({ data: [], error: null });
    });

    const results = await searchQuizzes('js');

    // 統合検索の並行実行確認
    expect(queryCallCount).toBeGreaterThanOrEqual(3);

    expect(results.map(r => r.id)).toContain('1');
    expect(results.map(r => r.id)).toContain('3');
    expect(results.map(r => r.id)).toContain('4');
    expect(results.map(r => r.id)).not.toContain('2');

    const ids = results.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('詳細フィルター（難易度、問題数、ジャンルID）が正しく適用されること', async () => {
    const mockQuizzes = [
      makeQuiz({ id: '1', title: 'JS 基礎', difficulty: 2, questionCount: 5, genre: 'programming' }),
      makeQuiz({ id: '2', title: 'JS 応用', difficulty: 4, questionCount: 12, genre: 'programming' }),
      makeQuiz({ id: '3', title: 'JS 達人', difficulty: 5, questionCount: 20, genre: 'programming' }),
    ];

    mockSupabase.from.mockImplementation(() => {
      return createChainMock({
        data: mockQuizzes.map(makeQuizRow),
        error: null,
      }) as any;
    });

    const filtered = await searchQuizzes('JS', {
      difficultyMin: 4,
      difficultyMax: 5,
    });

    expect(filtered.map(r => r.id)).toEqual(['2', '3']);

    const filteredByQuestions = await searchQuizzes('JS', {
      minQuestions: 10,
      maxQuestions: 15,
    });

    expect(filteredByQuestions.map(r => r.id)).toEqual(['2']);
  });

  test('userId が渡された場合、writeSearchLog がサイレントに呼び出されること', async () => {
    const { writeSearchLog } = require('../../src/lib/search-log');
    mockSupabase.from.mockImplementation(() => {
      return createChainMock({ data: [], error: null }) as any;
    });

    await searchQuizzes('検索ワード', { tags: ['tag1'] }, 'user-abc');

    expect(writeSearchLog).toHaveBeenCalledWith('user-abc', '検索ワード', ['tag1'], undefined);
  });
});
