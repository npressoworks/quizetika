/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { GenreEditorSelect } from '@/components/quiz/genre-editor-select';
import type { GenreMetadata } from '@/types';

const ACTIVE: GenreMetadata[] = [
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

describe('GenreEditorSelect', () => {
  it('loading 時は disabled で読み込み中表示', () => {
    render(
      <GenreEditorSelect
        value=""
        onChange={jest.fn()}
        genres={[]}
        loading
        error={null}
      />
    );
    const select = screen.getByTestId('genre-editor-select');
    expect(select).toBeDisabled();
    expect(screen.getByText(/読み込み中/)).toBeInTheDocument();
  });

  it('マスタ option を描画し選択できる', () => {
    const onChange = jest.fn();
    render(
      <GenreEditorSelect
        value=""
        onChange={onChange}
        genres={ACTIVE}
        loading={false}
        error={null}
      />
    );
    fireEvent.change(screen.getByTestId('genre-editor-select'), {
      target: { value: 'history' },
    });
    expect(onChange).toHaveBeenCalledWith('history');
    expect(screen.getByRole('option', { name: '歴史' })).toBeInTheDocument();
  });

  it('orphan 値は追加 option として表示する', () => {
    render(
      <GenreEditorSelect
        value="legacy-genre"
        onChange={jest.fn()}
        genres={ACTIVE}
        loading={false}
        error={null}
      />
    );
    expect(screen.getByRole('option', { name: /legacy-genre/ })).toBeInTheDocument();
  });

  it('error 時は再試行ボタンを表示しハードコード option を出さない', () => {
    const onRetry = jest.fn();
    render(
      <GenreEditorSelect
        value=""
        onChange={jest.fn()}
        genres={[]}
        loading={false}
        error="取得失敗"
        onRetry={onRetry}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('取得失敗');
    expect(screen.queryByRole('option', { name: /プログラミング/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
