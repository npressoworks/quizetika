/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchClient } from '@/app/search/search-client';

const push = jest.fn();
const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/hooks/useSearchUrlState', () => {
  const React = require('react') as any;
  const { DEFAULT_HOME_FEED_FILTERS } = require('@/lib/home-feed-filters');
  return {
    useSearchUrlState: () => {
      const [tab, setTab] = React.useState('latest');
      const [filters, setFilters] = React.useState({
        ...DEFAULT_HOME_FEED_FILTERS,
        tagChips: [] as string[],
      });
      const [playStatus, setPlayStatus] = React.useState('all');
      const [openFilters, setOpenFilters] = React.useState(false);

      return {
        tab,
        filters,
        playStatus,
        openFilters,
        setTab,
        patchFilters: (patch: Partial<typeof DEFAULT_HOME_FEED_FILTERS>) =>
          setFilters((prev: any) => ({
            ...prev,
            ...patch,
            tagChips: (patch as any).tagChips ? [...(patch as any).tagChips] : prev.tagChips,
          })),
        setPlayStatus,
        setOpenFilters,
        clearAll: () =>
          setFilters({
            ...DEFAULT_HOME_FEED_FILTERS,
            tagChips: [],
          }),
      };
    },
  };
});

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    firebaseUser: { uid: 'user-1' },
    loading: false,
  }),
}));

const mockGenres = [
  { id: 'programming', displayName: 'コンピュータ・IT', iconImageUrl: null, canonicalId: null, mergedGenreIds: [], isActive: true },
];

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: () => ({
    genres: mockGenres,
    loading: false,
    error: null,
    genreLabelById: new Map([['programming', 'コンピュータ・IT']]),
    refetch: jest.fn(),
  }),
}));

jest.mock('@/hooks/useActiveTags', () => ({
  useActiveTags: () => ({
    tags: [{ id: 'ウミガメのスープ', tagName: 'ウミガメのスープ', canonicalId: null, mergedTagIds: [] }],
    loading: false,
    error: null,
    tagLabelById: new Map([['ウミガメのスープ', 'ウミガメのスープ']]),
    refetch: jest.fn(),
  }),
}));

const mockQuizzes: any = [
  {
    id: 'quiz-1',
    authorId: 'author-1',
    authorName: 'テスト作者',
    title: 'JavaScript 基礎クイズ',
    description: 'JSの基礎知識を問います',
    thumbnailUrl: null,
    difficulty: 5,
    genre: 'programming',
    tags: ['js'],
    questionCount: 10,
    status: 'published',
    playCount: 10,
    bookmarksCount: 3,
    reviewScore: 4.5,
    questions: [],
    questionIds: [],
  },
];

let mockFeedLoading = false;
jest.mock('@/hooks/useExploreQuizFeed', () => ({
  useExploreQuizFeed: () => ({
    quizzes: mockQuizzes,
    loading: mockFeedLoading,
    loadingMore: false,
    error: null,
    hasMore: false,
    loadMore: jest.fn(),
  }),
}));

jest.mock('@/hooks/usePlayedQuizIds', () => ({
  usePlayedQuizIds: () => ({
    playedQuizIds: new Set(),
  }),
}));

jest.mock('@/services/bookmark', () => ({
  toggleBookmark: jest.fn(),
  getBookmarkedQuizIds: () => Promise.resolve([]),
}));

jest.mock('@/hooks/useSearchHistory', () => ({
  useSearchHistory: () => ({
    recentGenres: [],
    addRecentGenre: jest.fn(),
    recentKeywords: [],
    addRecentKeyword: jest.fn(),
  }),
}));

jest.mock('@/hooks/useWeeklyTrends', () => ({
  useWeeklyTopSearch: () => ({
    keywords: [],
    tags: ['ウミガメのスープ'],
    loading: false,
    error: null,
  }),
  useWeeklyTopGenres: () => ({
    genres: [],
    loading: false,
    error: null,
  }),
}));

describe('Search Page UI', () => {
  beforeEach(() => {
    push.mockClear();
    mockFeedLoading = false;
  });

  it('検索バーに入力でき、消去ボタンでクリアされること', () => {
    render(<SearchClient initialGenres={mockGenres} initialTags={[]} initialQuizzes={mockQuizzes} />);

    const input = screen.getByPlaceholderText(/クイズを検索/);
    fireEvent.change(input, { target: { value: 'TypeScript' } });
    expect(input).toHaveValue('TypeScript');

    const clearBtn = screen.getByTestId('search-clear-btn');
    fireEvent.click(clearBtn);
    expect(input).toHaveValue('');
  });

  it('クイック検索チップをクリックするとタグチップが追加されること', () => {
    render(<SearchClient initialGenres={mockGenres} initialTags={[]} initialQuizzes={mockQuizzes} />);

    const chip = screen.getByRole('button', { name: '#ウミガメのスープ' });
    fireEvent.click(chip);

    expect(screen.getAllByTestId('search-tag-chip').length).toBeGreaterThanOrEqual(1);
  });

  it('ロード中はフィード領域のみスケルトンが表示されること', () => {
    mockFeedLoading = true;
    render(<SearchClient initialGenres={mockGenres} initialTags={[]} initialQuizzes={mockQuizzes} />);

    expect(screen.getByTestId('search-feed-skeleton')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/クイズを検索/)).toBeInTheDocument();
    expect(screen.queryByTestId('home-genre-carousel-block')).not.toBeInTheDocument();
  });

  it('ロード完了後はクイズカードが表示されること', () => {
    mockFeedLoading = false;
    render(<SearchClient initialGenres={mockGenres} initialTags={[]} initialQuizzes={mockQuizzes} />);

    expect(screen.getByText('JavaScript 基礎クイズ')).toBeInTheDocument();
    expect(screen.getByTestId('quiz-card-difficulty')).toBeInTheDocument();
  });

  it('GenreNav は表示せずフィルター展開時にカルーセルを表示すること', () => {
    render(<SearchClient initialGenres={mockGenres} initialTags={[]} initialQuizzes={mockQuizzes} />);

    expect(screen.queryByTestId('genre-nav')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-genre-carousel-block')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-search-bar-sticky')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'フィルター' }));

    expect(screen.getByTestId('home-genre-carousel-block')).toBeInTheDocument();
    expect(screen.getByTestId('home-format-carousel-block')).toBeInTheDocument();
  });

  it('ジャンルカルーセル選択で router.push しないこと', () => {
    render(<SearchClient initialGenres={mockGenres} initialTags={[]} initialQuizzes={mockQuizzes} />);

    fireEvent.click(screen.getByRole('button', { name: 'フィルター' }));
    fireEvent.click(screen.getByTestId('genre-carousel-card-programming'));

    expect(push).not.toHaveBeenCalled();
  });
});
