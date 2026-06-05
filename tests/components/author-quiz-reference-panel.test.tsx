/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthorQuizReferencePanel } from '@/components/quiz/author-quiz-reference-panel';

jest.mock('@/hooks/useAuthorQuizReferenceSearch', () => ({
  useAuthorQuizReferenceSearch: () => ({
    keyword: '',
    setKeyword: jest.fn(),
    tag: '',
    setTag: jest.fn(),
    quizzes: [{ id: 'quiz-1', title: 'テストクイズ', status: 'published' }],
    loading: false,
    error: null,
  }),
}));

jest.mock('@/services/author-quiz-search', () => ({
  getQuestionsByQuiz: jest.fn().mockResolvedValue([
    { id: 'q-ref', type: 'multiple-choice', questionText: '参照設問', correctCount: 0, incorrectCount: 0 },
  ]),
}));

describe('AuthorQuizReferencePanel', () => {
  it('設問リンクで linkKind reference をコールバックする', async () => {
    const onLink = jest.fn();
    render(
      <AuthorQuizReferencePanel
        authorId="author-1"
        onLinkQuestion={onLink}
        linkedQuestionIds={new Set()}
      />
    );

    fireEvent.click(screen.getByTestId('reference-quiz-quiz-1'));
    await waitFor(() => expect(screen.getByTestId('link-reference-q-ref')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('link-reference-q-ref'));

    expect(onLink).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'q-ref', linkKind: 'reference' })
    );
  });
});
