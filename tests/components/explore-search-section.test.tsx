/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExploreSearchSection } from '@/components/explore/explore-search-section';
import { DEFAULT_HOME_FEED_FILTERS } from '@/lib/home-feed-filters';

const tags = [
  { id: 'js', tagName: 'js', canonicalId: null, mergedTagIds: [] },
];

const baseProps = {
  filters: DEFAULT_HOME_FEED_FILTERS,
  onFiltersChange: jest.fn(),
  onClearAll: jest.fn(),
  tags,
  tagsLoading: false,
  tagsError: null,
  tagLabelById: new Map([['js', 'js']]),
  playStatus: 'all' as const,
  onPlayStatusChange: jest.fn(),
};

describe('ExploreSearchSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('フィルターパネルにジャンルは含まず難易度・問題数・プレイ状況を表示する', () => {
    render(<ExploreSearchSection {...baseProps} showQuickSearch />);

    fireEvent.click(screen.getByRole('button', { name: 'フィルター' }));
    expect(screen.queryByText('ジャンル')).not.toBeInTheDocument();
    expect(screen.getByText('難易度範囲 (1 - 10)')).toBeInTheDocument();
    expect(screen.getByText('問題数')).toBeInTheDocument();
    expect(screen.getByText('プレイ状況')).toBeInTheDocument();
    expect(screen.getByText('クイック検索:')).toBeInTheDocument();
  });

  it('ジャンルページではクイック検索を非表示にする', () => {
    render(
      <ExploreSearchSection
        {...baseProps}
        lockedGenreId="programming"
        showQuickSearch={false}
        testId="genre-explore-search"
      />
    );

    expect(screen.getByTestId('genre-explore-search')).toBeInTheDocument();
    expect(screen.queryByText('クイック検索:')).not.toBeInTheDocument();
  });
});
