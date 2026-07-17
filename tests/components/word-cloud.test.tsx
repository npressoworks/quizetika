/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { WordCloud } from '@/components/charts/word-cloud';
import type { WordCloudItem } from '@/lib/word-cloud';

const items: WordCloudItem[] = [
  { text: '歴史', count: 9, accuracy: 85 },
  { text: '数学', count: 4, accuracy: 65 },
  { text: '地理', count: 3, accuracy: 45 },
  { text: '化学', count: 5, accuracy: 30 },
  { text: '物理', count: 2, accuracy: 100 },
  { text: '英語', count: 1, accuracy: 0 },
];

const getSpans = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('span'));

describe('WordCloud', () => {
  it('最大 count の語が最大フォントサイズ 2.25rem になる', () => {
    render(<WordCloud items={items} />);
    expect(screen.getByText('歴史')).toHaveStyle({ fontSize: '2.25rem' });
  });

  it('最小 count の語は最大フォントサイズより小さくなる（sqrt スケール）', () => {
    render(<WordCloud items={items} />);
    // count=1, maxCount=9 → 0.75 + 1.5 * sqrt(1/9) = 1.25rem
    expect(screen.getByText('英語')).toHaveStyle({ fontSize: '1.25rem' });
  });

  it('count 3回未満の語は muted クラスになる', () => {
    render(<WordCloud items={items} />);
    expect(screen.getByText('物理')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('英語')).toHaveClass('text-muted-foreground');
  });

  it('count 3回以上の語は正答率バケットのクラスになる', () => {
    render(<WordCloud items={items} />);
    // 80%以上 → emerald 系
    expect(screen.getByText('歴史')).toHaveClass('text-emerald-600', 'dark:text-emerald-400');
    // 60–79% → primary 系
    expect(screen.getByText('数学')).toHaveClass('text-primary');
    // 40–59% → amber 系
    expect(screen.getByText('地理')).toHaveClass('text-amber-600', 'dark:text-amber-400');
    // 40%未満 → red 系
    expect(screen.getByText('化学')).toHaveClass('text-red-600', 'dark:text-red-400');
  });

  it('同一データで2回レンダーしても並びが同一（決定的シャッフル）', () => {
    const first = render(<WordCloud items={items} />);
    const order1 = getSpans(first.container).map((el) => el.textContent);
    first.unmount();

    const second = render(<WordCloud items={items} />);
    const order2 = getSpans(second.container).map((el) => el.textContent);

    expect(order1).toHaveLength(items.length);
    expect(order2).toEqual(order1);
  });

  it('入力順が変わっても表示順は変わらない（ハッシュキーによる並び）', () => {
    const reversed = [...items].reverse();
    const first = render(<WordCloud items={items} />);
    const order1 = getSpans(first.container).map((el) => el.textContent);
    first.unmount();

    const second = render(<WordCloud items={reversed} />);
    const order2 = getSpans(second.container).map((el) => el.textContent);

    expect(order2).toEqual(order1);
  });

  it('count 3回以上の語の title 属性はプレイ回数と正答率を示す', () => {
    render(<WordCloud items={items} />);
    expect(screen.getByText('歴史')).toHaveAttribute('title', '9回プレイ・正答率85%');
    expect(screen.getByText('地理')).toHaveAttribute('title', '3回プレイ・正答率45%');
  });

  it('count 3回未満の語の title 属性はデータ不足を示す', () => {
    render(<WordCloud items={items} />);
    expect(screen.getByText('物理')).toHaveAttribute('title', '2回プレイ・データ不足');
    expect(screen.getByText('英語')).toHaveAttribute('title', '1回プレイ・データ不足');
  });

  it('items が空配列のときは何も描画しない', () => {
    const { container } = render(<WordCloud items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
