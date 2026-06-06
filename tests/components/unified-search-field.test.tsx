/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnifiedSearchField } from '@/components/explore/unified-search-field';

const tags = [{ id: 'js', tagName: 'JavaScript', canonicalId: null, mergedTagIds: [] }];

describe('UnifiedSearchField', () => {
  const onTagChipsChange = jest.fn();
  const onKeywordChange = jest.fn();
  const onClearAll = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderField(overrides: Partial<React.ComponentProps<typeof UnifiedSearchField>> = {}) {
    return render(
      <UnifiedSearchField
        tagChips={[]}
        onTagChipsChange={onTagChipsChange}
        keyword=""
        onKeywordChange={onKeywordChange}
        tags={tags}
        tagsLoading={false}
        tagsError={null}
        tagLabelById={new Map([['js', 'JavaScript']])}
        onClearAll={onClearAll}
        {...overrides}
      />
    );
  }

  it('Space でタグチップを追加する', () => {
    renderField({ keyword: 'JavaScript' });
    const input = screen.getByPlaceholderText(/クイズを検索/);
    fireEvent.keyDown(input, { key: ' ' });
    expect(onTagChipsChange).toHaveBeenCalledWith(['javascript']);
    expect(onKeywordChange).toHaveBeenCalledWith('');
  });

  it('重複チップは追加しない', () => {
    renderField({ keyword: 'js', tagChips: ['js'] });
    const input = screen.getByPlaceholderText(/クイズを検索/);
    fireEvent.keyDown(input, { key: ' ' });
    expect(onTagChipsChange).not.toHaveBeenCalled();
  });

  it('サジェストからタグを選択できる', () => {
    renderField({ keyword: 'java' });
    const input = screen.getByPlaceholderText(/クイズを検索/);
    fireEvent.focus(input);
    const option = screen.getByTestId('search-suggest-tag-js');
    fireEvent.mouseDown(option);
    expect(onTagChipsChange).toHaveBeenCalledWith(['js']);
    expect(onKeywordChange).toHaveBeenCalledWith('');
  });

  it('クリアボタンで onClearAll を呼ぶ', () => {
    renderField({ keyword: 'test', tagChips: ['js'] });
    fireEvent.click(screen.getByTestId('search-clear-btn'));
    expect(onClearAll).toHaveBeenCalled();
  });
});
