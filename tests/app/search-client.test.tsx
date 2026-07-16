/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchClient } from '@/app/search/search-client';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, authUser: { uid: 'user-1' }, loading: false }),
}));

const mockSetTab = jest.fn();
jest.mock('@/hooks/useSearchUrlState', () => ({
  useSearchUrlState: () => ({
    tab: 'latest',
    filters: {
      genreId: '',
      format: '',
      difficultyMin: 1,
      difficultyMax: 5,
      minQuestions: 1,
      maxQuestions: 50,
      searchQuery: '',
      tagChips: [],
    },
    playStatus: 'all',
    openFilters: false,
    setTab: mockSetTab,
    patchFilters: jest.fn(),
    setPlayStatus: jest.fn(),
    clearAll: jest.fn(),
  }),
}));

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: () => ({
    genres: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
    genreLabelById: new Map(),
  }),
}));

jest.mock('@/hooks/useActiveTags', () => ({
  useActiveTags: () => ({
    tags: [],
    loading: false,
    error: null,
    tagLabelById: new Map(),
  }),
}));

jest.mock('@/hooks/useExploreQuizFeed', () => ({
  useExploreQuizFeed: () => ({
    quizzes: [],
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    loadMore: jest.fn(),
  }),
}));

jest.mock('@/hooks/usePlayedQuizIds', () => ({
  usePlayedQuizIds: () => ({ playedQuizIds: new Set(), loading: false }),
}));

jest.mock('@/hooks/useAds', () => ({
  useAds: () => ({ showAds: false, shouldShowVideoAd: () => false }),
}));

jest.mock('@/services/bookmark', () => ({
  toggleBookmark: jest.fn(),
  getBookmarkedQuizIds: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/components/explore/explore-search-section', () => ({
  ExploreSearchSection: () => <div data-testid="explore-search-section-mock" />,
}));

jest.mock('@/components/explore/active-filter-chips', () => ({
  ActiveFilterChips: () => null,
}));

jest.mock('@/components/ads/adsense-inline-ad', () => ({
  AdsenseInlineAd: () => null,
}));

describe('SearchClient のタブ（共通 UnderlineTabs への統一）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('新着順・人気順・トレンド・フォローTLの4タブが共通の下線タブとして表示されること', async () => {
    render(<SearchClient />);
    await waitFor(() => {
      expect(screen.getByTestId('explore-search-section-mock')).toBeInTheDocument();
    });

    const tabList = screen.getByRole('tablist');
    expect(tabList).toHaveAttribute('data-variant', 'line');

    const latestTab = screen.getByRole('tab', { name: '新着順' });
    expect(latestTab.className).toMatch(/after:h-\[3px\]/);
    expect(latestTab.className).toMatch(/after:bottom-\[1px\]/);

    expect(screen.getByRole('tab', { name: '人気順' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'トレンド' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'フォローTL' })).toBeInTheDocument();
  });

  it('タブをクリックすると setTab が呼ばれること', async () => {
    render(<SearchClient />);
    await waitFor(() => {
      expect(screen.getByTestId('explore-search-section-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: '人気順' }));
    expect(mockSetTab).toHaveBeenCalledWith('popular');
  });
});
