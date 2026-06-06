/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GenreSearchField } from '../../src/components/explore/genre-search-field';
import type { GenreMetadata } from '../../src/types';

// useSearchHistory Hookのモック
const mockAddRecentGenre = jest.fn();
const mockRecentGenres = ['genre-1'];

jest.mock('../../src/hooks/useSearchHistory', () => ({
  useSearchHistory: () => ({
    recentGenres: mockRecentGenres,
    addRecentGenre: mockAddRecentGenre,
    recentKeywords: [],
    addRecentKeyword: jest.fn(),
  }),
}));

// useWeeklyTopGenres Hookのモック
const mockWeeklyGenres = [{ genreId: 'genre-2', playCount: 8 }];
let mockLoadingWeekly = false;
let mockErrorWeekly = false;

jest.mock('../../src/hooks/useWeeklyTrends', () => ({
  useWeeklyTopGenres: () => ({
    genres: mockWeeklyGenres,
    loading: mockLoadingWeekly,
    error: mockErrorWeekly,
  }),
}));

const mockGenres: GenreMetadata[] = [
  { id: 'genre-1', displayName: 'ジャンル1', isActive: true, iconImageUrl: null, canonicalId: null, mergedGenreIds: [] },
  { id: 'genre-2', displayName: 'ジャンル2', isActive: true, iconImageUrl: null, canonicalId: null, mergedGenreIds: [] },
  { id: 'genre-3', displayName: 'ジャンル3', isActive: true, iconImageUrl: null, canonicalId: null, mergedGenreIds: [] },
];

describe('GenreSearchField - Smart Suggest', () => {
  let mockOnChange: jest.Mock;
  let mockOnQueryChange: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnChange = jest.fn();
    mockOnQueryChange = jest.fn();
    mockLoadingWeekly = false;
    mockErrorWeekly = false;
  });

  test('フォーカスした時に入力が空であれば、スマートサジェストが表示されること', () => {
    render(
      <GenreSearchField
        genres={mockGenres}
        query=""
        onQueryChange={mockOnQueryChange}
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByPlaceholderText('ジャンル名で検索...');
    fireEvent.focus(input);

    expect(screen.getByTestId('genre-smart-suggest')).toBeInTheDocument();
    expect(screen.getByTestId('recent-genres-section')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-top-genres-section')).toBeInTheDocument();
  });

  test('週間人気ジャンルが読み込み中のとき、ローディングが表示されること', () => {
    mockLoadingWeekly = true;

    render(
      <GenreSearchField
        genres={mockGenres}
        query=""
        onQueryChange={mockOnQueryChange}
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByPlaceholderText('ジャンル名で検索...');
    fireEvent.focus(input);

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  test('サジェスト選択時に、履歴追加・ジャンル選択・ドロップダウン閉鎖が機能すること', () => {
    render(
      <GenreSearchField
        genres={mockGenres}
        query=""
        onQueryChange={mockOnQueryChange}
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByPlaceholderText('ジャンル名で検索...');
    fireEvent.focus(input);

    // 「今週の人気ジャンル」の「ジャンル2」を選択
    const option = screen.getByText('ジャンル2');
    fireEvent.mouseDown(option);

    expect(mockAddRecentGenre).toHaveBeenCalledWith('genre-2');
    expect(mockOnChange).toHaveBeenCalledWith('genre-2');
    expect(screen.queryByTestId('genre-smart-suggest')).not.toBeInTheDocument();
  });
});
