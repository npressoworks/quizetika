/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResultQuestionDetailsAccordion } from '@/components/quiz/result-question-details-accordion';

describe('ResultQuestionDetailsAccordion', () => {
  it('初期状態では子要素を表示しない', () => {
    render(
      <ResultQuestionDetailsAccordion questionId="q-1">
        <p>回答と解説の中身</p>
      </ResultQuestionDetailsAccordion>
    );

    const trigger = screen.getByTestId('result-question-accordion-q-1');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('回答と解説の中身')).not.toBeInTheDocument();
    expect(screen.getByText('回答と解説を表示')).toBeInTheDocument();
  });

  it('見出しクリックで子要素を表示し aria-expanded が true になる', () => {
    render(
      <ResultQuestionDetailsAccordion questionId="q-2">
        <p>展開後の内容</p>
      </ResultQuestionDetailsAccordion>
    );

    const trigger = screen.getByTestId('result-question-accordion-q-2');
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('展開後の内容')).toBeInTheDocument();
    expect(screen.getByText('回答と解説を隠す')).toBeInTheDocument();
  });

  it('問題ごとに開閉状態が独立している', () => {
    render(
      <>
        <ResultQuestionDetailsAccordion questionId="q-a">
          <p>問題Aの詳細</p>
        </ResultQuestionDetailsAccordion>
        <ResultQuestionDetailsAccordion questionId="q-b">
          <p>問題Bの詳細</p>
        </ResultQuestionDetailsAccordion>
      </>
    );

    fireEvent.click(screen.getByTestId('result-question-accordion-q-a'));

    expect(screen.getByText('問題Aの詳細')).toBeInTheDocument();
    expect(screen.queryByText('問題Bの詳細')).not.toBeInTheDocument();
  });
});
