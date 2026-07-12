/**
 * @jest-environment jsdom
 */

// jsdom は PointerEvent および要素の pointer capture 関連 API を実装していないため、
// base-ui の Select/AlertDialog コンポーネントが内部で使用するイベント生成・API 呼び出しに
// 失敗する。テスト用に軽量ポリフィルを注入する。
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  // @ts-expect-error jsdom 環境向けの簡易ポリフィルのため型は緩めに扱う
  window.PointerEvent = PointerEventPolyfill;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.setPointerCapture) {
  window.HTMLElement.prototype.setPointerCapture = () => {};
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.releasePointerCapture) {
  window.HTMLElement.prototype.releasePointerCapture = () => {};
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteGenreDialog } from '@/components/admin/delete-genre-dialog';

interface GenreMetadata {
  id: string;
  displayName: string;
  description: string;
  iconImageUrl: string | null;
  isActive: boolean;
  createdAt?: string | Date;
}

const TARGET_GENRE: GenreMetadata = {
  id: 'history',
  displayName: '歴史',
  description: '歴史ジャンル',
  iconImageUrl: null,
  isActive: true,
};

const OTHER_GENRES: GenreMetadata[] = [
  {
    id: 'science',
    displayName: '科学',
    description: '科学ジャンル',
    iconImageUrl: null,
    isActive: true,
  },
  {
    id: 'sports',
    displayName: 'スポーツ',
    description: 'スポーツジャンル',
    iconImageUrl: null,
    isActive: true,
  },
];

function defaultProps(overrides: Partial<React.ComponentProps<typeof DeleteGenreDialog>> = {}) {
  return {
    open: true,
    targetGenre: TARGET_GENRE,
    otherGenres: OTHER_GENRES,
    affectedQuizCount: null,
    submitLoading: false,
    errorMessage: null,
    onOpenChange: jest.fn(),
    onConfirm: jest.fn(),
    ...overrides,
  };
}

describe('DeleteGenreDialog', () => {
  it('影響件数が取得中 (null) の間はローディング表示のみを行い、確定ボタンは非活性である', () => {
    render(<DeleteGenreDialog {...defaultProps({ affectedQuizCount: null })} />);

    expect(screen.getByTestId('delete-genre-usage-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-genre-reassign-select')).not.toBeInTheDocument();
    expect(screen.getByTestId('delete-genre-confirm-btn')).toBeDisabled();
  });

  it('影響件数が0件のとき、再割当て先選択を表示せず確定ボタンは活性である', () => {
    render(<DeleteGenreDialog {...defaultProps({ affectedQuizCount: 0 })} />);

    expect(screen.queryByTestId('delete-genre-usage-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-genre-reassign-select')).not.toBeInTheDocument();
    expect(screen.getByTestId('delete-genre-confirm-btn')).not.toBeDisabled();
  });

  it('影響件数が0件のとき確定ボタン押下で onConfirm(null) が呼ばれる', () => {
    const onConfirm = jest.fn();
    render(<DeleteGenreDialog {...defaultProps({ affectedQuizCount: 0, onConfirm })} />);

    fireEvent.click(screen.getByTestId('delete-genre-confirm-btn'));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('影響件数が1件以上のとき、再割当て先選択を表示し、削除対象ジャンル自身を選択肢から除外する', () => {
    render(<DeleteGenreDialog {...defaultProps({ affectedQuizCount: 3 })} />);

    expect(screen.getByTestId('delete-genre-reassign-select')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('delete-genre-reassign-select'));

    expect(screen.getByTestId('delete-genre-reassign-option-science')).toBeInTheDocument();
    expect(screen.getByTestId('delete-genre-reassign-option-sports')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-genre-reassign-option-history')).not.toBeInTheDocument();
  });

  it('影響件数が1件以上かつ未選択のとき確定ボタンは非活性である', () => {
    render(<DeleteGenreDialog {...defaultProps({ affectedQuizCount: 3 })} />);

    expect(screen.getByTestId('delete-genre-confirm-btn')).toBeDisabled();
  });

  it('影響件数が1件以上のとき再割当て先を選択すると確定ボタンが活性化し、onConfirm に選択IDが渡る', () => {
    const onConfirm = jest.fn();
    render(<DeleteGenreDialog {...defaultProps({ affectedQuizCount: 3, onConfirm })} />);

    fireEvent.click(screen.getByTestId('delete-genre-reassign-select'));
    fireEvent.click(screen.getByTestId('delete-genre-reassign-option-science'));

    expect(screen.getByTestId('delete-genre-confirm-btn')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('delete-genre-confirm-btn'));
    expect(onConfirm).toHaveBeenCalledWith('science');
  });

  it('キャンセル操作では選択状態を破棄し、onConfirm を呼ばない', () => {
    const onConfirm = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <DeleteGenreDialog
        {...defaultProps({ affectedQuizCount: 3, onConfirm, onOpenChange })}
      />,
    );

    fireEvent.click(screen.getByTestId('delete-genre-reassign-select'));
    fireEvent.click(screen.getByTestId('delete-genre-reassign-option-science'));
    expect(screen.getByTestId('delete-genre-confirm-btn')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('delete-genre-cancel-btn'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('エラーメッセージが指定されたとき表示する', () => {
    render(
      <DeleteGenreDialog
        {...defaultProps({ affectedQuizCount: 0, errorMessage: '削除に失敗しました' })}
      />,
    );

    expect(screen.getByTestId('delete-genre-error')).toHaveTextContent('削除に失敗しました');
  });

  it('submitLoading 中は確定ボタン・キャンセルボタンが非活性である', () => {
    render(
      <DeleteGenreDialog {...defaultProps({ affectedQuizCount: 0, submitLoading: true })} />,
    );

    expect(screen.getByTestId('delete-genre-confirm-btn')).toBeDisabled();
    expect(screen.getByTestId('delete-genre-cancel-btn')).toBeDisabled();
  });
});
