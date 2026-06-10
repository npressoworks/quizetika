/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MyQuizSourcePanel } from '@/components/my-quiz/my-quiz-source-panel';
import type { MyQuizSourceFlags } from '@/lib/my-quiz-pool';

const ALL_ON: MyQuizSourceFlags = {
  ownQuizzes: true,
  bookmarkedQuizzes: true,
  bookmarkedQuestions: true,
};

describe('MyQuizSourcePanel', () => {
  it('3ソースの data-testid のみ表示し、トグル変更を通知する', () => {
    const onChange = jest.fn();
    render(<MyQuizSourcePanel flags={ALL_ON} onChange={onChange} />);

    expect(screen.getByTestId('my-quiz-source-own')).toBeInTheDocument();
    expect(screen.getByTestId('my-quiz-source-bookmarked-quiz')).toBeInTheDocument();
    expect(screen.getByTestId('my-quiz-source-bookmarked-question')).toBeInTheDocument();
    expect(screen.queryByTestId('my-quiz-source-bookmarked-list')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('my-quiz-source-own'));
    expect(onChange).toHaveBeenCalledWith({ ...ALL_ON, ownQuizzes: false });
  });
});
