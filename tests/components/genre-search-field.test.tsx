/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React, { useState } from 'react';
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

function ControlledField(
  props: Omit<React.ComponentProps<typeof GenreSearchField>, 'query' | 'onQueryChange'> & {
    initialQuery?: string;
  }
) {
  const { initialQuery = '', ...rest } = props;
  const [query, setQuery] = useState(initialQuery);
  return <GenreSearchField {...rest} query={query} onQueryChange={setQuery} />;
}

describe('GenreSearchField', () => {
  it('サジェスト選択で onChange が呼ばれる', () => {
    const onChange = jest.fn();
    render(<ControlledField genres={genres} value="" onChange={onChange} />);

    const input = screen.getByPlaceholderText('ジャンル名で検索...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '歴' } });

    fireEvent.mouseDown(screen.getByTestId('genre-suggest-history'));
    expect(onChange).toHaveBeenCalledWith('history');
  });

  it('入力変更で onQueryChange が呼ばれる', () => {
    const onQueryChange = jest.fn();
    render(
      <GenreSearchField
        genres={genres}
        query=""
        onQueryChange={onQueryChange}
        value=""
        onChange={jest.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('ジャンル名で検索...'), {
      target: { value: 'コンピュータ' },
    });
    expect(onQueryChange).toHaveBeenCalledWith('コンピュータ');
  });
});
