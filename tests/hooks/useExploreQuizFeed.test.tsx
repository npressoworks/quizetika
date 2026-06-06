/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { renderHook, waitFor } from '@testing-library/react';
import { useExploreQuizFeed } from '@/hooks/useExploreQuizFeed';
import { DEFAULT_HOME_FEED_FILTERS } from '@/lib/home-feed-filters';

const mockGetLatestQuizzes = jest.fn();
const mockGetQuizzesByGenre = jest.fn();
const mockSearchQuizzes = jest.fn();
const mockSortQuizzesForList = jest.fn((quizzes: unknown[]) => quizzes);

jest.mock('@/services/quiz', () => ({
  getLatestQuizzes: (...args: unknown[]) => mockGetLatestQuizzes(...args),
  getPopularQuizzes: jest.fn(),
  getTrendingQuizzes: jest.fn(),
  getFollowedTimeline: jest.fn(),
  getQuizzesByGenre: (...args: unknown[]) => mockGetQuizzesByGenre(...args),
  searchQuizzes: (...args: unknown[]) => mockSearchQuizzes(...args),
}));

jest.mock('@/lib/metadata-resolution', () => ({
  sortQuizzesForList: (...args: unknown[]) => mockSortQuizzesForList(...args),
}));

describe('useExploreQuizFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLatestQuizzes.mockResolvedValue([{ id: 'latest-1' }]);
    mockGetQuizzesByGenre.mockResolvedValue([{ id: 'genre-1' }]);
    mockSearchQuizzes.mockResolvedValue([{ id: 'search-1' }]);
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
    expect(mockGetLatestQuizzes).toHaveBeenCalled();
    expect(mockSearchQuizzes).not.toHaveBeenCalled();
    expect(result.current.quizzes).toEqual([{ id: 'latest-1' }]);
  });

  it('ホームで format 指定時は searchQuizzes に format を渡す', async () => {
    const { result } = renderHook(() =>
      useExploreQuizFeed({
        mode: 'home',
        activeTab: 'latest',
        filters: { ...DEFAULT_HOME_FEED_FILTERS, format: 'mixed' },
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSearchQuizzes).toHaveBeenCalledWith('', expect.objectContaining({ format: 'mixed' }));
    expect(mockGetLatestQuizzes).not.toHaveBeenCalled();
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
    expect(mockGetQuizzesByGenre).toHaveBeenCalledWith('science', 30, 'popular');
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
