import { searchQuizzes } from '../../src/services/quiz';
import { getDocs } from 'firebase/firestore';
import type { Question, Quiz } from '../../src/types';

jest.mock('../../src/lib/firebase/config', () => ({ db: {} }));

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn((ref, ...paths) => ({ id: paths[paths.length - 1] || 'auto-id', path: paths.join('/') })),
    collection: jest.fn((_db, path) => ({ path })),
    query: jest.fn((ref, ...clauses) => ({ ref, clauses })),
    where: jest.fn((field, op, value) => ({ field, op, value })),
    limit: jest.fn((n) => ({ limit: n })),
    orderBy: jest.fn((field, dir) => ({ field, dir })),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
  };
});

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

function mockLatestQuizzes(quizzes: Quiz[]) {
  (getDocs as jest.Mock).mockImplementation((q: { clauses?: Array<{ field: string; op: string; value?: unknown }> }) => {
    const clauses = q.clauses ?? [];
    const isCanonicalGenre = clauses.some(
      (c) => c.field === 'canonicalGenreId' && c.op === '=='
    );
    const isLegacyGenre = clauses.some((c) => c.field === 'genre' && c.op === 'in');
    const isTagQuery = clauses.some(
      (c) =>
        (c.field === 'canonicalTagIds' && c.op === 'array-contains') ||
        (c.field === 'tags' && c.op === 'array-contains')
    );
    const isLatest =
      clauses.some((c) => c.field === 'status' && c.op === '==') &&
      !isCanonicalGenre &&
      !isLegacyGenre &&
      !isTagQuery &&
      !clauses.some((c) => c.field === 'authorName');

    if (isCanonicalGenre || isLegacyGenre) {
      const genreValue =
        (clauses.find((c) => c.field === 'canonicalGenreId' && c.op === '==')?.value as string) ??
        (clauses.find((c) => c.field === 'genre' && c.op === 'in')?.value as string[] | undefined)?.[0];

      const matched = quizzes.filter(
        (quiz) => quiz.canonicalGenreId === genreValue || quiz.genre === genreValue
      );
      return Promise.resolve({
        docs: matched.map((data) => ({ id: data.id, data: () => data })),
      });
    }

    if (isTagQuery) {
      const tagValue = clauses.find(
        (c) =>
          (c.field === 'canonicalTagIds' && c.op === 'array-contains') ||
          (c.field === 'tags' && c.op === 'array-contains')
      )?.value as string;

      const matched = quizzes.filter((quiz) => {
        if (quiz.canonicalTagIds?.includes(tagValue)) return true;
        if (quiz.tags?.includes(tagValue)) return true;
        return false;
      });

      return Promise.resolve({
        docs: matched.map((data) => ({ id: data.id, data: () => data })),
      });
    }

    if (isLatest) {
      return Promise.resolve({
        docs: quizzes.map((data) => ({ id: data.id, data: () => data })),
      });
    }

    return Promise.resolve({ docs: [] });
  });
}

describe('searchQuizzes (出題形式フィルタ)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('形式のみで選択式クイズを返す（format フィールドあり）', async () => {
    const mc = makeQuiz({ id: 'mc', format: 'multiple-choice' });
    const ti = makeQuiz({ id: 'ti', format: 'text-input' });
    mockLatestQuizzes([mc, ti]);

    const results = await searchQuizzes('', { format: 'multiple-choice' });

    expect(results.map((r) => r.id)).toEqual(['mc']);
  });

  test('形式のみで設問 type から推定した形式を返す', async () => {
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

    (getDocs as jest.Mock).mockImplementation((q: { clauses?: Array<{ field: string; op: string; value?: unknown }> }) => {
      const clauses = q.clauses ?? [];
      const isTagQuery = clauses.some((c) => c.field === 'tags' && c.op === 'array-contains');
      const pool = [match, wrongFormat, wrongTag];

      if (isTagQuery) {
        return Promise.resolve({
          docs: pool.map((data) => ({ id: data.id, data: () => data })),
        });
      }

      return Promise.resolve({
        docs: pool.map((data) => ({ id: data.id, data: () => data })),
      });
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
