import { searchQuizzes } from '../../src/services/quiz';
import type { Quiz } from '../../src/types';

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
    then: jest.fn((onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled)),
  };
  return {
    createClient: () => mock,
  };
});

import { createClient } from '@/lib/supabase/client';
const mockSupabase = createClient() as any;

jest.mock('../../src/lib/metadata-resolution', () => {
  const actual = jest.requireActual('../../src/lib/metadata-resolution');
  return {
    ...actual,
    resolveCanonicalGenreId: jest.fn((genreId: string) => Promise.resolve(genreId)),
    expandGenreIdsForQuery: jest.fn((genreId: string) => Promise.resolve([genreId])),
    chunkIdsForInQuery: jest.fn((ids: string[]) => [ids]),
    dedupeQuizzesById: jest.fn((quizzes: Quiz[]) => {
      const map = new Map<string, Quiz>();
      quizzes.forEach((q) => map.set(q.id, q));
      return Array.from(map.values());
    }),
    sortQuizzesForList: jest.fn((quizzes: Quiz[]) => quizzes),
    resolveCanonicalTagIds: jest.fn((tags: string[]) => Promise.resolve(tags)),
  };
});

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'q-default',
    authorId: 'author-1',
    authorName: '作者',
    authorAvatar: '',
    title: 'テストクイズ',
    description: '説明',
    thumbnailUrl: null,
    difficulty: 5,
    genre: 'general',
    tags: [],
    originalTags: [],
    questionIds: [],
    questions: [],
    questionCount: 5,
    status: 'published',
    visibility: 'public',
    flagsCount: 0,
    playCount: 1,
    bookmarksCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    tempPositiveCount: 0,
    tempNegativeCount: 0,
    reviewScore: null,
    reviewBadge: null,
    isReviewMasked: false,
    activeResetRequestId: null,
    canonicalGenreId: 'general',
    canonicalTagIds: [],
    leaderboardFirstPlay: [],
    leaderboardReplay: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** `quiz_tags` / `quiz_questions` の埋め込みを含む Row を生成する（QUIZ_SELECT_WITH_RELATIONS 相当） */
function makeQuizRow(quiz: Quiz) {
  const tagIds = quiz.canonicalTagIds?.length ? quiz.canonicalTagIds : quiz.tags ?? [];
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
    canonical_genre_id: quiz.canonicalGenreId ?? null,
    created_at: quiz.createdAt.toISOString(),
    updated_at: quiz.updatedAt.toISOString(),
    quiz_tags: tagIds.map((tagId, i) => ({ tag_id: tagId, original_label: quiz.originalTags?.[i] ?? tagId })),
    quiz_questions: [],
  };
}

/** quiz_tags テーブルへの tag_id 検索、および quizzes テーブルへの id 一括取得をエミュレートする */
function mockTagQueryResults(quizzes: Quiz[]) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'quiz_tags') {
      const chain = createChainMock({ data: [], error: null });
      chain.eq.mockImplementation((field: string, val: string) => {
        if (field !== 'tag_id') return chain;
        const matched = quizzes.filter(
          (q) => q.canonicalTagIds?.includes(val) || q.tags?.includes(val)
        );
        return createChainMock({ data: matched.map((q) => ({ quiz_id: q.id })), error: null });
      });
      return chain;
    }

    if (table === 'quizzes') {
      const chain = createChainMock({ data: quizzes.map(makeQuizRow), error: null });

      chain.in.mockImplementation((_field: string, ids: string[]) => {
        const matched = quizzes.filter((q) => ids.includes(q.id));
        return createChainMock({ data: matched.map(makeQuizRow), error: null });
      });

      chain.limit.mockImplementation(() =>
        createChainMock({ data: quizzes.map(makeQuizRow), error: null })
      );

      return chain;
    }

    return createChainMock({ data: [], error: null });
  });
}

describe('searchQuizzes (タグ AND 複合検索)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockClear();
  });

  test('タグのみ（単一）で該当クイズを返す', async () => {
    const quiz = makeQuiz({ id: 'q1', canonicalTagIds: ['js'] });
    mockTagQueryResults([quiz]);

    const results = await searchQuizzes('', { tags: ['js'] });

    expect(results.map((r) => r.id)).toEqual(['q1']);
  });

  test('複数タグ AND で積集合を返す', async () => {
    const both = makeQuiz({ id: 'both', canonicalTagIds: ['js', 'web'] });
    const jsOnly = makeQuiz({ id: 'js-only', canonicalTagIds: ['js'] });
    mockTagQueryResults([both, jsOnly]);

    const results = await searchQuizzes('', { tags: ['js', 'web'] });

    expect(results.map((r) => r.id)).toEqual(['both']);
  });

  test('重複タグは除去される', async () => {
    const quiz = makeQuiz({ id: 'q1', canonicalTagIds: ['js'] });
    mockTagQueryResults([quiz]);

    const results = await searchQuizzes('', { tags: ['js', 'JS', '#js'] });

    expect(results.map((r) => r.id)).toEqual(['q1']);
  });

  test('キーワードとタグを AND 合成する', async () => {
    const match = makeQuiz({
      id: 'match',
      title: 'JavaScript 入門',
      canonicalTagIds: ['js'],
      tags: ['js'],
    });
    const wrongTag = makeQuiz({
      id: 'wrong-tag',
      title: 'JavaScript 応用',
      canonicalTagIds: ['python'],
      tags: ['python'],
    });

    const pool = [match, wrongTag];
    mockTagQueryResults(pool);

    const results = await searchQuizzes('javascript', { tags: ['js'] });

    expect(results.map((r) => r.id)).toEqual(['match']);
  });

  test('tags 未指定時は従来挙動（空キーワード + genreId）', async () => {
    const genreQuiz = makeQuiz({ id: 'genre-q', genre: 'science', canonicalGenreId: 'science' });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quizzes') {
        const chain = createChainMock({ data: [], error: null });

        chain.eq.mockImplementation((field: string, val: string) => {
          if (field === 'canonical_genre_id' && val === 'science') {
            return createChainMock({
              data: [makeQuizRow(genreQuiz)],
              error: null,
            });
          }
          return chain;
        });

        // getQuizzesByGenre 内の queryPublishedByGenreIn もフォールバックするために in もモック化
        chain.in.mockImplementation(() => {
          return createChainMock({
            data: [makeQuizRow(genreQuiz)],
            error: null,
          });
        });

        return chain;
      }
      return createChainMock({ data: [], error: null });
    });

    const results = await searchQuizzes('', { genreId: 'science' });

    expect(results.map((r) => r.id)).toContain('genre-q');
  });
});
