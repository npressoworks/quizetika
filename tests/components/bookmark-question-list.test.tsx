/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { BookmarkQuestionList } from '@/components/bookmark/bookmark-question-list';
import { Question } from '@/types';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const sampleQuestion: Question = {
  id: 'q1',
  quizId: 'quiz-a',
  questionText: 'サンプル設問テキストです。',
  type: 'multiple-choice',
  explanation: '',
  imageUrl: null,
  hint: null,
  limitTime: null,
  choices: [
    { id: 'c1', choiceText: 'A', isCorrect: true, selectedCount: 0 },
    { id: 'c2', choiceText: 'B', isCorrect: false, selectedCount: 0 },
  ],
  correctCount: 0,
  incorrectCount: 0,
};

describe('BookmarkQuestionList', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('空状態に data-testid を付与する', () => {
    render(<BookmarkQuestionList questions={[]} onRemove={jest.fn()} />);
    expect(screen.getByTestId('bookmarks-empty-question')).toBeInTheDocument();
  });

  it('設問カードクリックで親クイズプレイへ遷移する', () => {
    render(
      <BookmarkQuestionList
        questions={[
          {
            question: sampleQuestion,
            parentQuizId: 'quiz-a',
            parentQuizTitle: '親クイズ',
            bookmarkedAt: new Date('2026-06-01'),
          },
        ]}
        onRemove={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText(/サンプル設問/));
    expect(push).toHaveBeenCalledWith('/quiz/quiz-a/play?startAtQuestionId=q1');
  });
});
