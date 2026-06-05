/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuestionListAttachPanel } from '@/components/quiz-list/question-list-attach-panel';

jest.mock('@/hooks/useQuestionAttachSearch', () => ({
  useQuestionAttachSearch: () => ({
    keyword: '',
    setKeyword: jest.fn(),
    candidates: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

describe('QuestionListAttachPanel', () => {
  it('listId 未確定時は disabled 案内を表示', () => {
    render(
      <QuestionListAttachPanel
        listId=""
        authorId="user-1"
        attached={[]}
        onAttachedChange={jest.fn()}
        disabled
      />
    );
    expect(screen.getByTestId('question-attach-disabled-hint')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('question-attach-tab-public-explore'));
    expect(screen.getByText(/直近公開クイズの設問から検索/)).toBeInTheDocument();
  });
});
