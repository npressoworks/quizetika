import { getDocs } from 'firebase/firestore';
import {
  searchLists,
  DEFAULT_LIST_SEARCH_LIMIT,
} from '../../src/services/quiz-list';
import type { QuizList } from '../../src/types';

jest.mock('../../src/lib/firebase/config', () => ({ db: {} }));

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn((ref, ...paths) => ({ id: paths[paths.length - 1] || 'auto-id' })),
    collection: jest.fn((_db, path) => ({ path })),
    query: jest.fn((ref, ...clauses) => ({ ref, clauses })),
    where: jest.fn((field, op, value) => ({ field, op, value })),
    limit: jest.fn((n) => ({ limit: n })),
    orderBy: jest.fn((field, dir) => ({ field, dir })),
    getDocs: jest.fn(),
  };
});

function makeList(overrides: Partial<QuizList> = {}): QuizList {
  return {
    id: 'list-1',
    authorId: 'author-1',
    authorName: '作者',
    authorAvatar: '',
    title: 'JavaScript リスト',
    description: '入門向けの問題集',
    quizIds: [],
    questionIds: [],
    isPublished: true,
    bookmarksCount: 0,
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
    ...overrides,
  };
}

describe('searchLists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('public 結果から isPublished === false を除外する', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        { data: () => makeList({ id: 'pub-1', isPublished: true }) },
        { data: () => makeList({ id: 'priv-1', isPublished: false }) },
      ],
    });

    const results = await searchLists({ visibility: 'public' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('pub-1');
  });

  test('keyword でタイトル・説明を部分一致絞り込みする', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        { data: () => makeList({ id: '1', title: 'Python 基礎' }) },
        { data: () => makeList({ id: '2', title: 'JavaScript 入門', description: 'JS 学習' }) },
      ],
    });

    const results = await searchLists({ visibility: 'public', keyword: 'javascript' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('2');
  });

  test('空キーワード時は全件返却する', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        { data: () => makeList({ id: '1' }) },
        { data: () => makeList({ id: '2' }) },
      ],
    });

    const results = await searchLists({ visibility: 'public', keyword: '   ' });
    expect(results).toHaveLength(2);
  });

  test('private 時に authorId 未指定で throw する', async () => {
    await expect(searchLists({ visibility: 'private' })).rejects.toThrow(/authorId/);
    await expect(searchLists({ visibility: 'private', authorId: '' })).rejects.toThrow(
      /authorId/
    );
  });

  test('private 結果に他人のリストを含めない', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        {
          data: () =>
            makeList({ id: 'mine', authorId: 'user-a', isPublished: false }),
        },
        {
          data: () =>
            makeList({ id: 'other', authorId: 'user-b', isPublished: false }),
        },
      ],
    });

    const results = await searchLists({
      visibility: 'private',
      authorId: 'user-a',
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('mine');
  });

  test('既定 limit は DEFAULT_LIST_SEARCH_LIMIT（50）', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
    await searchLists({ visibility: 'public' });
    const { limit } = jest.requireMock('firebase/firestore');
    expect(limit).toHaveBeenCalledWith(DEFAULT_LIST_SEARCH_LIMIT);
  });

  test('createdAt 降順で返却する', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        { data: () => makeList({ id: 'old', createdAt: new Date('2026-01-01') }) },
        { data: () => makeList({ id: 'new', createdAt: new Date('2026-06-01') }) },
      ],
    });

    const results = await searchLists({ visibility: 'public' });
    expect(results.map((l) => l.id)).toEqual(['old', 'new']);
    const { orderBy } = jest.requireMock('firebase/firestore');
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  });
});
