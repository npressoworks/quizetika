/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { renderHook, waitFor } from '@testing-library/react';
import { useExploreQuizFeed } from '@/hooks/useExploreQuizFeed';
import { DEFAULT_HOME_FEED_FILTERS } from '@/lib/home-feed-filters';
import { HOME_FEED_PAGE_SIZE } from '@/lib/quiz-feed-cursor';

const mockGetLatestQuizzesPage = jest.fn();
const mockGetQuizzesByGenre = jest.fn();
const mockSearchQuizzes = jest.fn();
const mockSearchQuizzesPaginated = jest.fn();
const mockSortQuizzesForList = jest.fn((quizzes: any, sort?: any) => quizzes);

jest.mock('@/services/quiz', () => ({
  getLatestQuizzesPage: (...args: unknown[]) => mockGetLatestQuizzesPage(...args),
  getPopularQuizzesPage: jest.fn(),
  getTrendingQuizzesPage: jest.fn(),
  getFollowedTimelinePage: jest.fn(),
  getQuizzesByGenre: (...args: unknown[]) => mockGetQuizzesByGenre(...args),
  searchQuizzes: (...args: unknown[]) => mockSearchQuizzes(...args),
  searchQuizzesPaginated: (...args: unknown[]) => mockSearchQuizzesPaginated(...args),
}));

jest.mock('@/lib/metadata-resolution', () => ({
  sortQuizzesForList: (quizzes: any, sort?: any) => mockSortQuizzesForList(quizzes, sort),
}));

describe('useExploreQuizFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLatestQuizzesPage.mockResolvedValue({
      items: [{ id: 'latest-1' }],
      nextCursor: null,
    });
    mockGetQuizzesByGenre.mockResolvedValue([{ id: 'genre-1' }]);
    mockSearchQuizzes.mockResolvedValue([{ id: 'search-1' }]);
    mockSearchQuizzesPaginated.mockResolvedValue({
      items: [{ id: 'search-1' }],
      nextCursor: null,
    });
  });

  it('ホームでフィルタ未指定時はタブ別取得を使う', async () => {
    const { result } = renderHook(() =>
      useExploreQuizFeed({
        mode: 'home',
        activeTab: 'latest',
        filters: DEFAULT_HOME_FEED_FILTERS,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetLatestQuizzesPage).toHaveBeenCalled();
    expect(mockSearchQuizzesPaginated).not.toHaveBeenCalled();
    expect(result.current.quizzes).toEqual([{ id: 'latest-1' }]);
  });

  it('ホームで format 指定時は searchQuizzesPaginated に format を渡す', async () => {
    const { result } = renderHook(() =>
      useExploreQuizFeed({
        mode: 'home',
        activeTab: 'latest',
        filters: { ...DEFAULT_HOME_FEED_FILTERS, format: 'mixed' },
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSearchQuizzesPaginated).toHaveBeenCalledWith(
      '',
      expect.objectContaining({ format: 'mixed' }),
      expect.objectContaining({ limit: HOME_FEED_PAGE_SIZE })
    );
    expect(mockGetLatestQuizzesPage).not.toHaveBeenCalled();
  });

  it('scoped で固定ジャンルのみのとき getQuizzesByGenre を使う', async () => {
    const { result } = renderHook(() =>
      useExploreQuizFeed({
        mode: 'scoped',
        lockedGenreId: 'science',
        activeSort: 'popular',
        filters: { ...DEFAULT_HOME_FEED_FILTERS, genreId: 'science' },
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetQuizzesByGenre).toHaveBeenCalledWith('science', HOME_FEED_PAGE_SIZE, 'popular');
    expect(mockSearchQuizzes).not.toHaveBeenCalled();
  });

  it('scoped で形式指定時は固定 genreId 付き searchQuizzes を呼ぶ', async () => {
    const { result } = renderHook(() =>
      useExploreQuizFeed({
        mode: 'scoped',
        lockedGenreId: 'science',
        activeSort: 'latest',
        filters: { ...DEFAULT_HOME_FEED_FILTERS, genreId: 'science', format: 'text-input' },
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSearchQuizzes).toHaveBeenCalledWith(
      '',
      expect.objectContaining({ genreId: 'science', format: 'text-input' })
    );
    expect(mockSortQuizzesForList).toHaveBeenCalled();
    expect(mockGetQuizzesByGenre).not.toHaveBeenCalled();
  });
});
