/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExploreAccordionsPanel } from '@/components/explore/explore-accordions-panel';

const genres = [
  {
    id: 'programming',
    displayName: 'コンピュータ・IT',
    iconImageUrl: null,
    canonicalId: null,
    mergedGenreIds: [],
    isActive: true,
  },
  {
    id: 'history',
    displayName: '歴史',
    iconImageUrl: null,
    canonicalId: null,
    mergedGenreIds: [],
    isActive: true,
  },
];

describe('ExploreAccordionsPanel', () => {
  it('ジャンルアコーディオン内に専用検索バーを表示する', () => {
    render(
      <ExploreAccordionsPanel
        genres={genres}
        genresLoading={false}
        genresError={null}
        selectedGenreId=""
        onGenreSelect={jest.fn()}
        selectedFormat=""
        onFormatSelect={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('explore-accordion-genre'));
    expect(screen.getByTestId('genre-explore-search-field')).toBeInTheDocument();
    expect(screen.getByTestId('genre-search-field')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ジャンル名で検索...')).toBeInTheDocument();
  });

  it('ジャンル検索で選択すると onGenreSelect が呼ばれる', () => {
    const onGenreSelect = jest.fn();
    render(
      <ExploreAccordionsPanel
        genres={genres}
        genresLoading={false}
        genresError={null}
        selectedGenreId=""
        onGenreSelect={onGenreSelect}
        selectedFormat=""
        onFormatSelect={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('explore-accordion-genre'));
    const input = screen.getByPlaceholderText('ジャンル名で検索...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '歴' } });
    fireEvent.mouseDown(screen.getByTestId('genre-suggest-history'));
    expect(onGenreSelect).toHaveBeenCalledWith('history');
  });

  it('ジャンル検索入力でカルーセル表示を絞り込む', () => {
    render(
      <ExploreAccordionsPanel
        genres={genres}
        genresLoading={false}
        genresError={null}
        selectedGenreId=""
        onGenreSelect={jest.fn()}
        selectedFormat=""
        onFormatSelect={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('explore-accordion-genre'));
    expect(screen.getByTestId('genre-carousel-card-programming')).toBeInTheDocument();
    expect(screen.getByTestId('genre-carousel-card-history')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('ジャンル名で検索...'), {
      target: { value: 'こんぴゅーた' },
    });

    expect(screen.getByTestId('genre-carousel-card-programming')).toBeInTheDocument();
    expect(screen.queryByTestId('genre-carousel-card-history')).not.toBeInTheDocument();
  });
});
