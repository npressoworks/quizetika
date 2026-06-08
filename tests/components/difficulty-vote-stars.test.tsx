/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DifficultyVoteStars } from '@/components/quiz/difficulty-vote-stars';

describe('DifficultyVoteStars', () => {
  it('★クリックで onVote を呼び出す', () => {
    const onVote = jest.fn();
    render(<DifficultyVoteStars value={null} onVote={onVote} />);

    fireEvent.click(screen.getByTestId('difficulty-vote-star-3'));
    expect(onVote).toHaveBeenCalledWith(3);
  });

  it('投票済み value=3 のとき ★3 と ☆2 を表示する', () => {
    render(<DifficultyVoteStars value={3} onVote={jest.fn()} />);

    const stars = screen.getAllByRole('button');
    expect(stars[0]).toHaveTextContent('★');
    expect(stars[1]).toHaveTextContent('★');
    expect(stars[2]).toHaveTextContent('★');
    expect(stars[3]).toHaveTextContent('☆');
    expect(stars[4]).toHaveTextContent('☆');
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
