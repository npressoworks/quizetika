import { searchQuizzes } from '../../src/services/quiz';
import { getDocs } from 'firebase/firestore';
import type { Quiz } from '../../src/types';

jest.mock('../../src/lib/search-log', () => ({
  writeSearchLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn((ref, ...paths) => ({ id: paths[paths.length - 1] || 'auto-id', path: paths.join('/') })),
    collection: jest.fn((db, path) => ({ path })),
    query: jest.fn((ref, ...clauses) => ({ ref, clauses })),
    where: jest.fn((field, op, value) => ({ field, op, value })),
    limit: jest.fn((n) => ({ limit: n })),
    orderBy: jest.fn((field, dir) => ({ field, dir })),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
  };
});

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

describe('searchQuizzes (統合検索 - ユニバーサル検索)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('queryText が指定された場合、並行クエリを実行し、重複排除と部分一致フィルタ、詳細条件フィルタを適用する', async () => {
    const mockQuizzes = [
      makeQuiz({ id: '1', title: 'JavaScript 入門', authorName: 'ユーザーA', genre: 'programming', tags: ['js'] }),
      makeQuiz({ id: '2', title: 'Python 基礎', authorName: 'ユーザーB', description: 'Pythonと機械学習', tags: ['python'] }),
      makeQuiz({ id: '3', title: 'React の世界', authorName: 'ユーザーA', genre: 'web-front', tags: ['react', 'js'] }),
      makeQuiz({ id: '4', title: 'TypeScript 入門', authorName: 'ユーザーC', tags: ['ts', 'js'], difficulty: 4, questionCount: 15 }),
    ];

    // getDocs がモックのデータを返すように設定
    const { getDocs: mockGetDocs } = require('firebase/firestore');
    let queryCallCount = 0;
    mockGetDocs.mockImplementation((q: any) => {
      queryCallCount++;
      const clauses = q.clauses || [];
      const isTagQuery = clauses.some((c: any) => c.field === 'tags' && c.op === 'array-contains');
      const isAuthorQuery = clauses.some((c: any) => c.field === 'authorName' && c.op === '==');
      const isGenreQuery = clauses.some((c: any) => c.field === 'genre' && c.op === 'in');
      const isCanonicalGenreQuery = clauses.some((c: any) => c.field === 'canonicalGenreId' && c.op === '==');
      const isLatestQuery = clauses.some((c: any) => c.field === 'status' && c.op === '==') && !isTagQuery && !isAuthorQuery && !isGenreQuery && !isCanonicalGenreQuery;

      let result: Quiz[] = [];
      if (isTagQuery) {
        result = mockQuizzes.filter(quiz => quiz.tags.includes('js'));
      } else if (isAuthorQuery) {
        result = mockQuizzes.filter(quiz => quiz.authorName === 'ユーザーA');
      } else if (isCanonicalGenreQuery || isGenreQuery) {
        result = mockQuizzes.filter(quiz => quiz.genre === 'programming');
      } else if (isLatestQuery) {
        result = mockQuizzes;
      }

      return Promise.resolve({
        docs: result.map(data => ({
          id: data.id,
          data: () => data
        }))
      });
    });

    const results = await searchQuizzes('js');

    // 統合検索時には、タグ検索、作者名検索、ジャンル検索、最新新着検索が並行実行されるため、
    // getDocs の呼び出し回数が複数回行われていることを検証する（並行化の確認）
    expect(queryCallCount).toBeGreaterThanOrEqual(3);

    // 「js」に部分一致・完全一致するものが返ってくることを期待
    // 1: JavaScript 入門 (title に js, tags に js) -> 合致
    // 2: Python 基礎 (js 含まない) -> 除外
    // 3: React の世界 (tags に js) -> 合致
    // 4: TypeScript 入門 (tags に js) -> 合致
    expect(results.map(r => r.id)).toContain('1');
    expect(results.map(r => r.id)).toContain('3');
    expect(results.map(r => r.id)).toContain('4');
    expect(results.map(r => r.id)).not.toContain('2');

    // 重複がないこと
    const ids = results.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('詳細フィルター（難易度、問題数、ジャンルID）が正しく適用されること', async () => {
    const mockQuizzes = [
      makeQuiz({ id: '1', title: 'JS 基礎', difficulty: 2, questionCount: 5, genre: 'programming' }),
      makeQuiz({ id: '2', title: 'JS 応用', difficulty: 4, questionCount: 12, genre: 'programming' }),
      makeQuiz({ id: '3', title: 'JS 達人', difficulty: 5, questionCount: 20, genre: 'programming' }),
    ];

    const { getDocs: mockGetDocs } = require('firebase/firestore');
    mockGetDocs.mockResolvedValue({
      docs: mockQuizzes.map(data => ({
        id: data.id,
        data: () => data
      }))
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
    const { getDocs: mockGetDocs } = require('firebase/firestore');
    mockGetDocs.mockResolvedValue({ docs: [] });

    await searchQuizzes('検索ワード', { tags: ['tag1'] }, 'user-abc');

    expect(writeSearchLog).toHaveBeenCalledWith('user-abc', '検索ワード', ['tag1'], undefined);
  });
});
