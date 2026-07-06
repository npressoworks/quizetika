/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DifficultyVoteStars } from '@/components/quiz/difficulty-vote-stars';

describe('DifficultyVoteStars', () => {
  it('🔥クリックで onVote を呼び出す', () => {
    const onVote = jest.fn();
    render(<DifficultyVoteStars value={null} onVote={onVote} />);

    fireEvent.click(screen.getByTestId('difficulty-vote-star-3'));
    expect(onVote).toHaveBeenCalledWith(3);
  });

  it('投票済み value=3 のとき 3個は点灯、残り2個は消灯表示になる', () => {
    render(<DifficultyVoteStars value={3} onVote={jest.fn()} />);

    const stars = screen.getAllByRole('button');
    stars.forEach((star) => {
      expect(star).toHaveTextContent('🔥');
    });
    expect(stars[0]).not.toHaveClass('grayscale');
    expect(stars[1]).not.toHaveClass('grayscale');
    expect(stars[2]).not.toHaveClass('grayscale');
    expect(stars[3]).toHaveClass('grayscale');
    expect(stars[4]).toHaveClass('grayscale');
  });

  it('未投票時は全て消灯表示になる', () => {
    render(<DifficultyVoteStars value={null} onVote={jest.fn()} />);

    const stars = screen.getAllByRole('button');
    stars.forEach((star) => {
      expect(star).toHaveTextContent('🔥');
      expect(star).toHaveClass('grayscale');
    });
  });

  it('disabled 時はクリックできない', () => {
    const onVote = jest.fn();
    render(<DifficultyVoteStars value={null} onVote={onVote} disabled />);

    const star = screen.getByTestId('difficulty-vote-star-2');
    expect(star).toBeDisabled();
    fireEvent.click(star);
    expect(onVote).not.toHaveBeenCalled();
  });
});
