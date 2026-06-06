/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UnifiedSearchField } from '../../src/components/explore/unified-search-field';
import type { TagMetadata } from '../../src/types';

// useSearchHistory Hookのモック
const mockAddRecentKeyword = jest.fn();
const mockRecentKeywords = ['react-history'];

jest.mock('../../src/hooks/useSearchHistory', () => ({
  useSearchHistory: () => ({
    recentGenres: [],
    addRecentGenre: jest.fn(),
    recentKeywords: mockRecentKeywords,
    addRecentKeyword: mockAddRecentKeyword,
  }),
}));

// useWeeklyTopSearch Hookのモック
const mockWeeklyKeywords = ['nextjs', 'vue'];
const mockWeeklyTags = ['tag-js'];
let mockLoadingWeekly = false;
let mockErrorWeekly = false;

jest.mock('../../src/hooks/useWeeklyTrends', () => ({
  useWeeklyTopSearch: () => ({
    keywords: mockWeeklyKeywords,
    tags: mockWeeklyTags,
    loading: mockLoadingWeekly,
    error: mockErrorWeekly,
  }),
}));

const mockTags: TagMetadata[] = [
  { id: 'tag-js', tagName: 'JavaScript', canonicalId: null, mergedTagIds: [] },
  { id: 'tag-react', tagName: 'React', canonicalId: null, mergedTagIds: [] },
];

describe('UnifiedSearchField - Smart Suggest', () => {
  let mockOnTagChipsChange: jest.Mock;
  let mockOnKeywordChange: jest.Mock;
  let mockOnClearAll: jest.Mock;
  const tagLabelById = new Map<string, string>([
    ['tag-js', 'JavaScript'],
    ['tag-react', 'React'],
  ]);

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnTagChipsChange = jest.fn();
    mockOnKeywordChange = jest.fn();
    mockOnClearAll = jest.fn();
    mockLoadingWeekly = false;
    mockErrorWeekly = false;
  });

  test('入力がなくタグチップも空のフォーカス時に、スマートサジェストが表示されること', () => {
    render(
      <UnifiedSearchField
        tagChips={[]}
        onTagChipsChange={mockOnTagChipsChange}
        keyword=""
        onKeywordChange={mockOnKeywordChange}
        tags={mockTags}
        tagsLoading={false}
        tagsError={null}
        tagLabelById={tagLabelById}
        onClearAll={mockOnClearAll}
      />
    );

    const input = screen.getByPlaceholderText('タイトル、説明文、作成者、タグでクイズを検索...');
    fireEvent.focus(input);

    expect(screen.getByTestId('search-smart-suggest')).toBeInTheDocument();
    expect(screen.getByTestId('recent-keywords-section')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-top-tags-section')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-top-keywords-section')).toBeInTheDocument();
  });

  test('タグチップが1個以上ある場合、スマートサジェストが表示されないこと', () => {
    render(
      <UnifiedSearchField
        tagChips={['tag-js']}
        onTagChipsChange={mockOnTagChipsChange}
        keyword=""
        onKeywordChange={mockOnKeywordChange}
        tags={mockTags}
        tagsLoading={false}
        tagsError={null}
        tagLabelById={tagLabelById}
        onClearAll={mockOnClearAll}
      />
    );

    const input = screen.getByPlaceholderText('タイトル、説明文、作成者、タグでクイズを検索...');
    fireEvent.focus(input);

    expect(screen.queryByTestId('search-smart-suggest')).not.toBeInTheDocument();
  });

  test('キーワード入力がある場合、スマートサジェストが表示されないこと', () => {
    render(
      <UnifiedSearchField
        tagChips={[]}
        onTagChipsChange={mockOnTagChipsChange}
        keyword="react"
        onKeywordChange={mockOnKeywordChange}
        tags={mockTags}
        tagsLoading={false}
        tagsError={null}
        tagLabelById={tagLabelById}
        onClearAll={mockOnClearAll}
      />
    );

    const input = screen.getByPlaceholderText('タイトル、説明文、作成者、タグでクイズを検索...');
    fireEvent.focus(input);

    expect(screen.queryByTestId('search-smart-suggest')).not.toBeInTheDocument();
  });

  test('週間人気キーワードの選択時に、履歴追加・キーワード変更・ドロップダウン閉鎖が機能すること', () => {
    render(
      <UnifiedSearchField
        tagChips={[]}
        onTagChipsChange={mockOnTagChipsChange}
        keyword=""
        onKeywordChange={mockOnKeywordChange}
        tags={mockTags}
        tagsLoading={false}
        tagsError={null}
        tagLabelById={tagLabelById}
        onClearAll={mockOnClearAll}
      />
    );

    const input = screen.getByPlaceholderText('タイトル、説明文、作成者、タグでクイズを検索...');
    fireEvent.focus(input);

    const option = screen.getByText('nextjs');
    fireEvent.mouseDown(option);

    expect(mockAddRecentKeyword).toHaveBeenCalledWith('nextjs');
    expect(mockOnKeywordChange).toHaveBeenCalledWith('nextjs');
    expect(screen.queryByTestId('search-smart-suggest')).not.toBeInTheDocument();
  });

  test('週間人気タグの選択時に、履歴追加・タグチップ追加・ドロップダウン閉鎖が機能すること', () => {
    render(
      <UnifiedSearchField
        tagChips={[]}
        onTagChipsChange={mockOnTagChipsChange}
        keyword=""
        onKeywordChange={mockOnKeywordChange}
        tags={mockTags}
        tagsLoading={false}
        tagsError={null}
        tagLabelById={tagLabelById}
        onClearAll={mockOnClearAll}
      />
    );

    const input = screen.getByPlaceholderText('タイトル、説明文、作成者、タグでクイズを検索...');
    fireEvent.focus(input);

    const option = screen.getByText('JavaScript');
    fireEvent.mouseDown(option);

    expect(mockAddRecentKeyword).toHaveBeenCalledWith('tag-js');
    expect(mockOnTagChipsChange).toHaveBeenCalledWith(['tag-js']);
    expect(mockOnKeywordChange).toHaveBeenCalledWith('');
    expect(screen.queryByTestId('search-smart-suggest')).not.toBeInTheDocument();
  });
});
