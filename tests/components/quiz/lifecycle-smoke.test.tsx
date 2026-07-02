/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ChoiceAnswerPanel } from '@/components/quiz/choice-answer-panel';
import { TrueFalseAnswerPanel } from '@/components/quiz/true-false-answer-panel';
import { PostAnswerFeedback } from '@/components/quiz/post-answer-feedback';
import { ReportModal } from '@/components/quiz/report-modal';
import type { Question } from '@/types';

const choiceQuestion: any = {
  id: 'q1',
  type: 'multiple-choice',
  questionText: 'Test?',
  explanation: '',
  imageUrl: null,
  hint: null,
  limitTime: null,
  correctCount: 0,
  incorrectCount: 0,
  choices: [
    { id: 'c1', choiceText: 'A', isCorrect: true, selectedCount: 0 },
    { id: 'c2', choiceText: 'B', isCorrect: false, selectedCount: 0 },
  ],
  correctChoiceIds: ['c1'],
};

const trueFalseQuestion: any = {
  id: 'q2',
  type: 'true-false',
  questionText: 'True or false?',
  explanation: '',
  imageUrl: null,
  hint: null,
  limitTime: null,
  correctCount: 0,
  incorrectCount: 0,
  choices: [
    { id: 'maru', choiceText: '○', isCorrect: true, selectedCount: 0 },
    { id: 'batsu', choiceText: '×', isCorrect: false, selectedCount: 0 },
  ],
  correctChoiceIds: ['maru'],
};

describe('quiz lifecycle component smoke', () => {
  test('ChoiceAnswerPanel renders confirm button', () => {
    render(<ChoiceAnswerPanel question={choiceQuestion} onConfirm={jest.fn()} />);
    expect(screen.getByRole('button', { name: '解答を確定する' })).toBeInTheDocument();
  });

  test('TrueFalseAnswerPanel renders testids', () => {
    render(<TrueFalseAnswerPanel question={trueFalseQuestion} onConfirm={jest.fn()} />);
    expect(screen.getByTestId('true-false-answer-panel')).toBeInTheDocument();
    expect(screen.getByTestId('true-false-answer-true')).toBeInTheDocument();
    expect(screen.getByTestId('true-false-answer-false')).toBeInTheDocument();
  });

  test('PostAnswerFeedback renders feedback testids', () => {
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

  test('ReportModal renders dialog testids when open', () => {
    render(
      <ReportModal
        isOpen
        onClose={jest.fn()}
        quizId="quiz-1"
        reporterId="user-1"
      />
    );
    expect(screen.getByTestId('report-modal-content')).toBeInTheDocument();
    expect(screen.getByTestId('report-reason-input')).toBeInTheDocument();
    expect(screen.getByTestId('report-submit-btn')).toBeInTheDocument();
  });
});
