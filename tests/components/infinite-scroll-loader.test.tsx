/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InfiniteScrollLoader } from '../../src/components/ui/infinite-scroll-loader';
import { useIntersectionLoadMore } from '../../src/hooks/useIntersectionLoadMore';

// useIntersectionLoadMore をモック化して sentinelRef を追跡できるようにする
jest.mock('../../src/hooks/useIntersectionLoadMore', () => ({
  useIntersectionLoadMore: jest.fn(() => ({ current: null })),
}));

describe('InfiniteScrollLoader', () => {
  const mockOnLoadMore = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useIntersectionLoadMore as jest.Mock).mockImplementation(({ onIntersect, enabled }) => {
      // 交差監視をシミュレートしやすくするためのヘルパー
      return { current: null };
    });
  });

  it('hasMore が false の場合は何もレンダリングしない', () => {
    const { container } = render(
      <InfiniteScrollLoader
        hasMore={false}
        loading={false}
        onLoadMore={mockOnLoadMore}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('初期状態（hasMore=true, isInfinite=false）では「もっと見る」ボタンが表示される', () => {
    render(
      <InfiniteScrollLoader
        hasMore={true}
        loading={false}
        onLoadMore={mockOnLoadMore}
        testIdPrefix="test"
      />
    );

    const button = screen.getByTestId('test-load-more-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('もっと見る');
    expect(button).not.toBeDisabled();
  });

  it('loading=true の初期状態ではボタンが「読み込み中...」になり無効化され、スケルトンが表示される', () => {
    render(
      <InfiniteScrollLoader
        hasMore={true}
        loading={true}
        onLoadMore={mockOnLoadMore}
        testIdPrefix="test"
      />
    );

    const button = screen.getByTestId('test-load-more-button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('読み込み中...');

    // スケルトンも表示されていること
    expect(screen.getByTestId('test-skeleton')).toBeInTheDocument();
  });

  it('「もっと見る」ボタンをクリックすると onLoadMore が呼ばれ、無限スクロールモードに遷移する（ボタンが消えセンチネルが表示される）', () => {
    const { rerender } = render(
      <InfiniteScrollLoader
        hasMore={true}
        loading={false}
        onLoadMore={mockOnLoadMore}
        testIdPrefix="test"
      />
    );

    const button = screen.getByTestId('test-load-more-button');
    fireEvent.click(button);

    expect(mockOnLoadMore).toHaveBeenCalledTimes(1);

    // 親の再ロードに伴い、loading=true で再レンダリングされたと仮定
    rerender(
      <InfiniteScrollLoader
        hasMore={true}
        loading={true}
        onLoadMore={mockOnLoadMore}
        testIdPrefix="test"
      />
    );

    // 無限スクロールモード（isInfinite=true）に遷移しているため、「もっと見る」ボタンは消え、センチネルとスケルトンが表示される
    expect(screen.queryByTestId('test-load-more-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-sentinel')).toBeInTheDocument();
    expect(screen.getByTestId('test-skeleton')).toBeInTheDocument();
  });

  it('無限スクロールモード遷移後、外部起因のロード開始（クエリ変更など）によって再び「もっと見る」ボタンに戻る', async () => {
    const { rerender } = render(
      <InfiniteScrollLoader
        hasMore={true}
        loading={false}
        onLoadMore={mockOnLoadMore}
        testIdPrefix="test"
      />
    );

    // 1. ボタンを押して無限スクロールモードへ
    const button = screen.getByTestId('test-load-more-button');
    fireEvent.click(button);

    // onLoadMore によって親でロードが開始され、その後完了したとする (loading が true になってから false になる)
    rerender(
      <InfiniteScrollLoader
        hasMore={true}
        loading={true}
        onLoadMore={mockOnLoadMore}
        testIdPrefix="test"
      />
    );

    rerender(
      <InfiniteScrollLoader
        hasMore={true}
        loading={false}
        onLoadMore={mockOnLoadMore}
        testIdPrefix="test"
      />
    );

    expect(screen.queryByTestId('test-load-more-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-sentinel')).toBeInTheDocument();

    // 2. 外部（クエリ変更など）によって loading=true が直接渡される
    rerender(
      <InfiniteScrollLoader
        hasMore={true}
        loading={true}
        onLoadMore={mockOnLoadMore}
        testIdPrefix="test"
      />
    );

    // 内部ステートが isInfinite=false にリセットされるため、再度「もっと見る」ボタン（読み込み中...状態）が表示される
    const loadingButton = await screen.findByTestId('test-load-more-button');
    expect(loadingButton).toBeInTheDocument();
    expect(loadingButton).toHaveTextContent('読み込み中...');
    expect(screen.queryByTestId('test-sentinel')).not.toBeInTheDocument();
  });
});
