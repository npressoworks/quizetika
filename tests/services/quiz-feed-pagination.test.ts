import {
  getLatestQuizzes,
  getLatestQuizzesPage,
  searchQuizzesPaginated,
  QuizFeedCursorError,
  getQuizzesByAuthorPage,
} from '../../src/services/quiz';
import { getDoc, getDocs, query } from 'firebase/firestore';
import type { Quiz } from '../../src/types';
import {
  buildSearchFingerprint,
  encodeSearchOffsetCursor,
} from '../../src/lib/quiz-feed-cursor';

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
    startAfter: jest.fn((snap) => ({ startAfter: snap })),
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

function makeQuiz(id: string, createdAtMs: number): Quiz {
  return {
    id,
    authorId: 'author-1',
    authorName: '作者',
    authorAvatar: '',
    title: `Quiz ${id}`,
    description: '',
    thumbnailUrl: null,
    difficulty: 3,
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
    createdAt: new Date(createdAtMs),
    updatedAt: new Date(createdAtMs),
  };
}

describe('quiz feed pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getLatestQuizzesPage の2ページ目先頭 ID が1ページ目に含まれない', async () => {
    const page1 = [makeQuiz('q-1', 3000), makeQuiz('q-2', 2000)];

    (getDocs as jest.Mock)
      .mockResolvedValueOnce({
        docs: page1.map((q) => ({ data: () => q })),
      })
      .mockResolvedValueOnce({
        docs: [page1[1]].map((q) => ({ data: () => q })),
      });

    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => page1[0],
    });

    const first = await getLatestQuizzesPage({ limit: 1 });
    expect(first.items.map((q) => q.id)).toEqual(['q-1']);
    expect(first.nextCursor).toBeTruthy();

    const second = await getLatestQuizzesPage({ limit: 1, cursor: first.nextCursor });
    expect(second.items.map((q) => q.id)).toEqual(['q-2']);
    expect(first.items.some((q) => second.items.some((s) => s.id === q.id))).toBe(false);
  });

  it('getLatestQuizzes は先頭ページ API の薄いラッパーとして動作する', async () => {
    const rows = [makeQuiz('wrap-1', 1000), makeQuiz('wrap-2', 900)];
    (getDocs as jest.Mock).mockResolvedValue({
      docs: rows.map((q) => ({ data: () => q })),
    });

    const items = await getLatestQuizzes(2);
    expect(items.map((q) => q.id)).toEqual(['wrap-1', 'wrap-2']);
  });

  it('searchQuizzesPaginated は offset 0/1 で件数が整合する', async () => {
    const rows = [makeQuiz('s-1', 3000), makeQuiz('s-2', 2000), makeQuiz('s-3', 1000)];
    (getDocs as jest.Mock).mockResolvedValue({
      docs: rows.map((q) => ({ data: () => q })),
    });

    const page1 = await searchQuizzesPaginated('', {}, { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await searchQuizzesPaginated('', {}, { limit: 2, cursor: page1.nextCursor });
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
    expect([...page1.items, ...page2.items]).toHaveLength(3);
  });

  it('fingerprint 不一致の検索カーソルはエラーになる', async () => {
    const fingerprint = buildSearchFingerprint('', {});
    const staleCursor = encodeSearchOffsetCursor(10, fingerprint);

    await expect(
      searchQuizzesPaginated('', { genreId: 'science' }, { cursor: staleCursor })
    ).rejects.toThrow(QuizFeedCursorError);
  });

  describe('getQuizzesByAuthorPage', () => {
    it('作成者IDで絞り込まれたクイズ一覧を createdAt 降順でロードできる', async () => {
      const page1 = [makeQuiz('q-author-1', 3000), makeQuiz('q-author-2', 2000)];
      (getDocs as jest.Mock).mockResolvedValue({
        docs: page1.map((q) => ({ data: () => q })),
      });

      const result = await getQuizzesByAuthorPage('author-1', { limit: 1 });
      expect(result.items.map((q) => q.id)).toEqual(['q-author-1']);
      expect(result.nextCursor).toBeTruthy();
    });

    it('下書きを含める場合と含めない場合でクエリの制約が切り替わる', async () => {
      const page = [makeQuiz('q-author-1', 3000), makeQuiz('q-author-2', 2000)];
      (getDocs as jest.Mock).mockResolvedValue({
        docs: page.map((q) => ({ data: () => q })),
      });

      // includeUnpublished === true の場合 (status=published や visibility=public の where 条件がない)
      await getQuizzesByAuthorPage('author-1', { includeUnpublished: true });
      const lastQueryCall = (jest.mocked(query).mock.calls);
      const callForDrafts = lastQueryCall[lastQueryCall.length - 1];
      const clausesDraft = callForDrafts.slice(1);
      expect(clausesDraft.some((c: any) => c.field === 'status')).toBe(false);
      expect(clausesDraft.some((c: any) => c.field === 'visibility')).toBe(false);

      // includeUnpublished === false の場合
      await getQuizzesByAuthorPage('author-1', { includeUnpublished: false });
      const lastQueryCall2 = (jest.mocked(query).mock.calls);
      const callForPublic = lastQueryCall2[lastQueryCall2.length - 1];
      const clausesPublic = callForPublic.slice(1);
      expect(clausesPublic.some((c: any) => c.field === 'status' && c.value === 'published')).toBe(true);
      expect(clausesPublic.some((c: any) => c.field === 'visibility' && c.value === 'public')).toBe(true);
    });

    it('カーソルを指定したとき startAfter が正しく設定される', async () => {
      const page = [makeQuiz('q-author-1', 3000), makeQuiz('q-author-2', 2000)];
      (getDocs as jest.Mock).mockResolvedValue({
        docs: page.map((q) => ({ data: () => q })),
      });
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => page[0],
      });

      const first = await getQuizzesByAuthorPage('author-1', { limit: 1 });
      expect(first.nextCursor).toBeTruthy();

      await getQuizzesByAuthorPage('author-1', { limit: 1, cursor: first.nextCursor });
      
      const lastQueryCall = (jest.mocked(query).mock.calls);
      const callWithCursor = lastQueryCall[lastQueryCall.length - 1];
      const clauses = callWithCursor.slice(1);
      expect(clauses.some((c: any) => c.hasOwnProperty('startAfter'))).toBe(true);
    });
  });
});
