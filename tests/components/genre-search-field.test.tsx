/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { GenreSearchField } from '@/components/explore/genre-search-field';

const genres = [
  {
    id: 'history',
    displayName: '歴史',
    iconImageUrl: null,
    canonicalId: null,
    mergedGenreIds: [],
    isActive: true,
  },
  {
    id: 'programming',
    displayName: 'コンピュータ・IT',
    iconImageUrl: null,
    canonicalId: null,
    mergedGenreIds: [],
    isActive: true,
  },
];

describe('GenreSearchField', () => {
  it('サジェスト選択で onChange が呼ばれる', () => {
    const onChange = jest.fn();
    render(<GenreSearchField genres={genres} value="" onChange={onChange} />);

    const input = screen.getByPlaceholderText('ジャンル名で検索...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '歴' } });

    fireEvent.mouseDown(screen.getByTestId('genre-suggest-history'));
    expect(onChange).toHaveBeenCalledWith('history');
  });
});
