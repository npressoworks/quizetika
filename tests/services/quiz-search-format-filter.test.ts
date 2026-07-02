import { searchQuizzes } from '../../src/services/quiz';
import type { Question, Quiz } from '../../src/types';

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

function makeQuestion(type: Question['type']): Question {
  return {
    id: 'q1',
    type,
    questionText: 'Q',
    explanation: '',
    imageUrl: null,
    hint: null,
    limitTime: null,
    correctCount: 0,
    incorrectCount: 0,
  };
}

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

function makeQuizRow(quiz: Quiz) {
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
    tags: quiz.tags,
    original_tags: quiz.originalTags,
    question_ids: quiz.questionIds,
    questions: quiz.questions as any,
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
    format: quiz.format ?? null,
    canonical_genre_id: quiz.canonicalGenreId ?? null,
    canonical_tag_ids: quiz.canonicalTagIds ?? null,
    created_at: quiz.createdAt.toISOString(),
    updated_at: quiz.updatedAt.toISOString(),
  };
}

function mockLatestQuizzes(quizzes: Quiz[]) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'quizzes') {
      const chain = createChainMock({ data: [], error: null });

      // getQuizzesByGenre 内の queryPublishedByCanonicalGenre 用に eq/in をモック
      chain.eq.mockImplementation((field: string, val: string) => {
        if (field === 'canonical_genre_id') {
          const matched = quizzes.filter(q => q.canonicalGenreId === val || q.genre === val);
          return createChainMock({ data: matched.map(makeQuizRow), error: null });
        }
        return chain;
      });

      chain.in.mockImplementation((field: string, val: string[]) => {
        if (field === 'genre') {
          const matched = quizzes.filter(q => val.includes(q.genre));
          return createChainMock({ data: matched.map(makeQuizRow), error: null });
        }
        return chain;
      });

      chain.contains.mockImplementation((field: string, val: string[]) => {
        const tagValue = val[0];
        const matched = quizzes.filter(
          (quiz) => quiz.canonicalTagIds?.includes(tagValue) || quiz.tags?.includes(tagValue)
        );
        return createChainMock({ data: matched.map(makeQuizRow), error: null });
      });

      // limit() などの最新取得用
      chain.limit.mockImplementation(() => {
        return createChainMock({ data: quizzes.map(makeQuizRow), error: null });
      });

      return chain;
    }
    return mockSupabase as any;
  });
}

describe('searchQuizzes (出題形式フィルタ)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockClear();
  });

  test('形式のみで選択式クイズを返す（format フィールドあり）', async () => {
    const mc = makeQuiz({ id: 'mc', format: 'multiple-choice' });
    const ti = makeQuiz({ id: 'ti', format: 'text-input' });
    mockLatestQuizzes([mc, ti]);

    const results = await searchQuizzes('', { format: 'multiple-choice' });

    expect(results.map((r) => r.id)).toEqual(['mc']);
  });

  test('形式のみで問題 type から推定した形式を返す', async () => {
    const inferred = makeQuiz({
      id: 'lt',
      questions: [makeQuestion('lateral-thinking')],
    });
    const other = makeQuiz({ id: 'mc', format: 'multiple-choice' });
    mockLatestQuizzes([inferred, other]);

    const results = await searchQuizzes('', { format: 'lateral-thinking' });

    expect(results.map((r) => r.id)).toEqual(['lt']);
  });

  test('ジャンル + 形式 scoped 検索で他ジャンルを除外する', async () => {
    const scienceLt = makeQuiz({
      id: 'science-lt',
      genre: 'science',
      canonicalGenreId: 'science',
      questions: [makeQuestion('lateral-thinking')],
    });
    const generalLt = makeQuiz({
      id: 'general-lt',
      genre: 'general',
      canonicalGenreId: 'general',
      questions: [makeQuestion('lateral-thinking')],
    });
    const scienceMc = makeQuiz({
      id: 'science-mc',
      genre: 'science',
      canonicalGenreId: 'science',
      format: 'multiple-choice',
    });
    mockLatestQuizzes([scienceLt, generalLt, scienceMc]);

    const results = await searchQuizzes('', {
      genreId: 'science',
      format: 'lateral-thinking',
    });

    expect(results.map((r) => r.id)).toEqual(['science-lt']);
  });

  test('キーワード + タグ + 形式を AND 合成する', async () => {
    const match = makeQuiz({
      id: 'match',
      title: 'JavaScript 入門',
      format: 'mixed',
      canonicalTagIds: ['js'],
      tags: ['js'],
    });
    const wrongFormat = makeQuiz({
      id: 'wrong-format',
      title: 'JavaScript 応用',
      format: 'text-input',
      canonicalTagIds: ['js'],
      tags: ['js'],
    });
    const wrongTag = makeQuiz({
      id: 'wrong-tag',
      title: 'JavaScript 上級',
      format: 'mixed',
      canonicalTagIds: ['python'],
      tags: ['python'],
    });

    const pool = [match, wrongFormat, wrongTag];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quizzes') {
        const chain = createChainMock({ data: pool.map(makeQuizRow), error: null });

        chain.contains.mockImplementation(() => {
          return createChainMock({ data: pool.map(makeQuizRow), error: null });
        });

        chain.eq.mockImplementation(() => {
          return createChainMock({ data: pool.map(makeQuizRow), error: null });
        });

        chain.limit.mockImplementation(() => {
          return createChainMock({ data: pool.map(makeQuizRow), error: null });
        });

        return chain;
      }
      return mockSupabase as any;
    });

    const results = await searchQuizzes('javascript', {
      tags: ['js'],
      format: 'mixed',
    });

    expect(results.map((r) => r.id)).toEqual(['match']);
  });

  test('format 未指定時は形式による追加絞り込みを行わない', async () => {
    const mc = makeQuiz({ id: 'mc', format: 'multiple-choice' });
    const ti = makeQuiz({ id: 'ti', format: 'text-input' });
    mockLatestQuizzes([mc, ti]);

    const results = await searchQuizzes('', {});

    expect(results.map((r) => r.id).sort()).toEqual(['mc', 'ti']);
  });

  test('レガシーデータ（questions 空）は mixed フィルタのみヒット', async () => {
    const legacy = makeQuiz({ id: 'legacy', format: undefined, questions: [] });
    mockLatestQuizzes([legacy]);

    const mixedResults = await searchQuizzes('', { format: 'mixed' });
    expect(mixedResults.map((r) => r.id)).toEqual(['legacy']);

    const mcResults = await searchQuizzes('', { format: 'multiple-choice' });
    expect(mcResults).toEqual([]);
  });
});
