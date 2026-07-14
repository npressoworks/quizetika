/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExploreSortTabs } from '@/components/explore/explore-sort-tabs';
import type { QuizListSort } from '@/services/quiz';

function Wrapper({ initial = 'latest' as QuizListSort }) {
  const [sort, setSort] = React.useState<QuizListSort>(initial);
  return <ExploreSortTabs activeSort={sort} onSortChange={setSort} />;
}

describe('ExploreSortTabs（共通 UnderlineTabs への統一）', () => {
  it('新着・人気・トレンドの3タブが表示されること', () => {
    render(<Wrapper />);

    expect(screen.getByTestId('explore-sort-latest')).toBeInTheDocument();
    expect(screen.getByTestId('explore-sort-popular')).toBeInTheDocument();
    expect(screen.getByTestId('explore-sort-trending')).toBeInTheDocument();
  });

  it('共通の下線タブ（line バリアント）スタイルが適用されていること', () => {
    render(<Wrapper />);

    const tabList = screen.getByRole('tablist');
    expect(tabList).toHaveAttribute('data-variant', 'line');

    const latestTab = screen.getByTestId('explore-sort-latest');
    expect(latestTab.className).toMatch(/after:h-\[3px\]/);
    expect(latestTab.className).toMatch(/after:bottom-\[1px\]/);
  });

  it('タブをクリックすると onSortChange が呼ばれ、選択状態が切り替わること', () => {
    render(<Wrapper />);

    const latestTab = screen.getByTestId('explore-sort-latest');
    const popularTab = screen.getByTestId('explore-sort-popular');

    expect(latestTab).toHaveAttribute('aria-selected', 'true');
    expect(popularTab).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(popularTab);

    expect(popularTab).toHaveAttribute('aria-selected', 'true');
    expect(latestTab).toHaveAttribute('aria-selected', 'false');
  });
});
