/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChoiceAnswerPanel } from '@/components/quiz/choice-answer-panel';
import { TrueFalseAnswerPanel } from '@/components/quiz/true-false-answer-panel';
import { PostAnswerFeedback } from '@/components/quiz/post-answer-feedback';
import { ReportModal } from '@/components/quiz/report-modal';
import type { Question } from '@/types';

const choiceQuestion: any = {
  id: 'q1',
  type: 'multiple-choice',
  text: 'テスト問題',
  choices: [
    { id: 'c1', choiceText: 'A' },
    { id: 'c2', choiceText: 'B' },
  ],
  correctAnswer: 'c1',
  explanation: '',
};

const trueFalseQuestion: any = {
  id: 'q2',
  type: 'true-false',
  text: '○×問題',
  choices: [
    { id: 'maru', choiceText: '○' },
    { id: 'batsu', choiceText: '×' },
  ],
  correctAnswer: 'maru',
  explanation: '',
};

describe('lifecycle answer panels smoke', () => {
  test('ChoiceAnswerPanel renders confirm button', () => {
    render(
      <ChoiceAnswerPanel question={choiceQuestion} onConfirm={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: '解答を確定する' })).toBeInTheDocument();
  });

  test('TrueFalseAnswerPanel renders testids', () => {
    render(
      <TrueFalseAnswerPanel question={trueFalseQuestion} onConfirm={jest.fn()} />
    );
    expect(screen.getByTestId('true-false-answer-panel')).toBeInTheDocument();
    expect(screen.getByTestId('true-false-answer-true')).toBeInTheDocument();
    expect(screen.getByTestId('true-false-answer-false')).toBeInTheDocument();
  });

  test('PostAnswerFeedback renders feedback and next button', () => {
    render(
      <PostAnswerFeedback
        isCorrect
        isLastQuestion={false}
        onNext={jest.fn()}
        onViewResults={jest.fn()}
      />
    );
    expect(screen.getByTestId('play-answer-feedback')).toBeInTheDocument();
    expect(screen.getByTestId('play-next-question')).toBeInTheDocument();
  });

  test('PostAnswerFeedback renders view results on last question', () => {
    render(
      <PostAnswerFeedback
        isCorrect={false}
        isLastQuestion
        onNext={jest.fn()}
        onViewResults={jest.fn()}
      />
    );
    expect(screen.getByTestId('play-view-results')).toBeInTheDocument();
  });
});

describe('ReportModal smoke', () => {
  test('ReportModal renders content and inputs when open', () => {
    render(
      <ReportModal isOpen onClose={jest.fn()} quizId="quiz-1" reporterId="user-1" />
    );
    expect(screen.getByTestId('report-modal-content')).toBeInTheDocument();
    expect(screen.getByTestId('report-reason-input')).toBeInTheDocument();
    expect(screen.getByTestId('report-submit-btn')).toBeInTheDocument();
  });

  test('ReportModal submit shows success message', async () => {
    jest.spyOn(require('@/services/moderation'), 'flagContent').mockResolvedValue(undefined);

    render(
      <ReportModal isOpen onClose={jest.fn()} quizId="quiz-1" reporterId="user-1" />
    );

    fireEvent.change(screen.getByTestId('report-reason-input'), {
      target: { value: '不適切な内容です' },
    });
    fireEvent.click(screen.getByTestId('report-submit-btn'));

    expect(await screen.findByTestId('report-success-message')).toBeInTheDocument();
  });
});
