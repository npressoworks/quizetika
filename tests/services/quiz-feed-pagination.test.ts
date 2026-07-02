import {
  getLatestQuizzes,
  getLatestQuizzesPage,
  searchQuizzesPaginated,
  QuizFeedCursorError,
  getQuizzesByAuthorPage,
} from '../../src/services/quiz';
import type { Quiz } from '../../src/types';
import {
  buildSearchFingerprint,
  encodeSearchOffsetCursor,
} from '../../src/lib/quiz-feed-cursor';

jest.mock('@/lib/supabase/client', () => {
  const mock = {
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    in: jest.fn(() => mock),
    maybeSingle: jest.fn(),
    order: jest.fn(() => mock),
    limit: jest.fn(() => mock),
    or: jest.fn(() => mock),
    is: jest.fn(() => mock),
    contains: jest.fn(() => mock),
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

function makeQuiz(id: string, createdAtMs: number, playCount: number = 1): Quiz {
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
    playCount,
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
    created_at: quiz.createdAt.toISOString(),
    updated_at: quiz.updatedAt.toISOString(),
  };
}

describe('quiz feed pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockClear();
    mockSupabase.select.mockClear();
    mockSupabase.eq.mockClear();
    mockSupabase.in.mockClear();
    mockSupabase.maybeSingle.mockReset();
    mockSupabase.order.mockClear();
    mockSupabase.limit.mockClear();
    mockSupabase.or.mockClear();
    mockSupabase.is.mockClear();
    mockSupabase.contains.mockClear();

    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.in.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.limit.mockReturnValue(mockSupabase);
    mockSupabase.or.mockReturnValue(mockSupabase);
    mockSupabase.is.mockReturnValue(mockSupabase);
    mockSupabase.contains.mockReturnValue(mockSupabase);
  });

  it('getLatestQuizzesPage の2ページ目先頭 ID が1ページ目に含まれない', async () => {
    const page1 = [makeQuiz('q-1', 3000), makeQuiz('q-2', 2000)];

    mockSupabase.limit.mockResolvedValueOnce({
      data: page1.map(makeQuizRow),
      error: null,
    });

    // 2ページ目取得時、カーソル用レコードを maybeSingle で取得
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: makeQuizRow(page1[0]),
      error: null,
    });

    // 2ページ目の取得
    mockSupabase.limit.mockResolvedValueOnce({
      data: [makeQuizRow(page1[1])],
      error: null,
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
    mockSupabase.limit.mockResolvedValueOnce({
      data: rows.map(makeQuizRow),
      error: null,
    });

    const items = await getLatestQuizzes(2);
    expect(items.map((q) => q.id)).toEqual(['wrap-1', 'wrap-2']);
  });

  it('searchQuizzesPaginated は offset 0/1 で件数が整合する', async () => {
    const rows = [makeQuiz('s-1', 3000), makeQuiz('s-2', 2000), makeQuiz('s-3', 1000)];
    mockSupabase.limit
      .mockResolvedValueOnce({
        data: rows.map(makeQuizRow),
        error: null,
      })
      .mockResolvedValueOnce({
        data: rows.map(makeQuizRow),
        error: null,
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
      mockSupabase.limit.mockResolvedValueOnce({
        data: page1.map(makeQuizRow),
        error: null,
      });

      const result = await getQuizzesByAuthorPage('author-1', { limit: 1 });
      expect(result.items.map((q) => q.id)).toEqual(['q-author-1']);
      expect(result.nextCursor).toBeTruthy();
    });

    it('下書きを含める場合と含めない場合でクエリの制約が切り替わる', async () => {
      const page = [makeQuiz('q-author-1', 3000), makeQuiz('q-author-2', 2000)];
      
      // 1回目：下書きを含める
      mockSupabase.limit.mockResolvedValueOnce({
        data: page.map(makeQuizRow),
        error: null,
      });
      await getQuizzesByAuthorPage('author-1', { includeUnpublished: true });
      
      const callsForDrafts = mockSupabase.eq.mock.calls;
      // 'author_id' は指定するが 'status' や 'visibility' は指定しない
      expect(callsForDrafts.some((c: any) => c[0] === 'author_id' && c[1] === 'author-1')).toBe(true);
      expect(callsForDrafts.some((c: any) => c[0] === 'status')).toBe(false);

      mockSupabase.eq.mockClear();

      // 2回目：下書きを含めない
      mockSupabase.limit.mockResolvedValueOnce({
        data: page.map(makeQuizRow),
        error: null,
      });
      await getQuizzesByAuthorPage('author-1', { includeUnpublished: false });
      
      const callsForPublic = mockSupabase.eq.mock.calls;
      expect(callsForPublic.some((c: any) => c[0] === 'status' && c[1] === 'published')).toBe(true);
      expect(callsForPublic.some((c: any) => c[0] === 'visibility' && c[1] === 'public')).toBe(true);
    });

    it('カーソルを指定したとき or フィルタが正しく設定される', async () => {
      const page = [makeQuiz('q-author-1', 3000), makeQuiz('q-author-2', 2000)];
      
      // 1回目のロード
      mockSupabase.limit.mockResolvedValueOnce({
        data: page.map(makeQuizRow),
        error: null,
      });

      // maybeSingle (カーソル用のクイズ取得)
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: makeQuizRow(page[0]),
        error: null,
      });

      // 2回目のロード
      mockSupabase.limit.mockResolvedValueOnce({
        data: [makeQuizRow(page[1])],
        error: null,
      });

      const first = await getQuizzesByAuthorPage('author-1', { limit: 1 });
      expect(first.nextCursor).toBeTruthy();

      await getQuizzesByAuthorPage('author-1', { limit: 1, cursor: first.nextCursor });
      
      // or メソッドが呼び出されていることを確認
      expect(mockSupabase.or).toHaveBeenCalled();
      const orCallArg = mockSupabase.or.mock.calls[0][0];
      expect(orCallArg).toContain('created_at.lt');
    });
  });
});
