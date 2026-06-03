/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { GenreNav } from '@/components/explore/genre-nav';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const genres = [
  {
    id: 'programming',
    displayName: 'コンピュータ・IT',
    iconImageUrl: null,
    canonicalId: null,
    mergedGenreIds: [],
    isActive: true,
  },
];

describe('GenreNav', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('ジャンルクリックで /genres/[id] へ遷移する', () => {
    render(<GenreNav genres={genres} loading={false} error={null} />);
    fireEvent.click(screen.getByTestId('genre-nav-item-programming'));
    expect(push).toHaveBeenCalledWith('/genres/programming');
  });

  it('エラー時は再試行ボタンを表示する', () => {
    const onRetry = jest.fn();
    render(
      <GenreNav genres={[]} loading={false} error="取得失敗" onRetry={onRetry} />
    );
    fireEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
