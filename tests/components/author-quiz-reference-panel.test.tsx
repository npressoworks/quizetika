/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthorQuizReferencePanel } from '@/components/quiz/author-quiz-reference-panel';
import { useAuthorQuizReferenceSearch } from '@/hooks/useAuthorQuizReferenceSearch';

jest.mock('@/hooks/useAuthorQuizReferenceSearch');

jest.mock('@/services/author-quiz-search', () => ({
  getQuestionsByQuiz: jest.fn().mockResolvedValue([
    { id: 'q-ref', type: 'multiple-choice', questionText: '参照設問', correctCount: 0, incorrectCount: 0 },
  ]),
}));

const mockUseSearch = useAuthorQuizReferenceSearch as jest.Mock;

const defaultSearchState = {
  keyword: '',
  setKeyword: jest.fn(),
  tag: '',
  setTag: jest.fn(),
  quizzes: [{ id: 'quiz-1', title: 'テストクイズ', status: 'published' }],
  questionsByQuizId: {} as Record<string, unknown[]>,
  loading: false,
  error: null,
};

describe('AuthorQuizReferencePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSearch.mockReturnValue(defaultSearchState);
  });

  it('設問リンクで linkKind reference をコールバックする', async () => {
    const onLink = jest.fn();
    render(
      <AuthorQuizReferencePanel
        authorId="author-1"
        onLinkQuestion={onLink}
        onUnlinkQuestion={jest.fn()}
        linkedQuestionIds={new Set()}
      />
    );

    fireEvent.click(screen.getByTestId('reference-quiz-quiz-1'));
    await waitFor(() => expect(screen.getByTestId('link-reference-q-ref')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('link-reference-q-ref'));

    expect(onLink).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'q-ref', linkKind: 'reference' })
    );
    expect(screen.getByTestId('reference-link-success')).toHaveTextContent(
      '設問をリンクしました: 参照設問'
    );
  });

  it('問題文ヒット時はアコーディオンを開き設問を最初から表示する', async () => {
    mockUseSearch.mockReturnValue({
      ...defaultSearchState,
      keyword: 'キーワード',
      quizzes: [{ id: 'quiz-hit', title: '無関係タイトル', status: 'published' }],
      questionsByQuizId: {
        'quiz-hit': [
          { id: 'q-hit', type: 'text-input', questionText: 'キーワードを含む問題文', correctCount: 0, incorrectCount: 0 },
          { id: 'q-other', type: 'text-input', questionText: '別の問題', correctCount: 0, incorrectCount: 0 },
        ],
      },
    });

    render(
      <AuthorQuizReferencePanel
        authorId="author-1"
        onLinkQuestion={jest.fn()}
        onUnlinkQuestion={jest.fn()}
        linkedQuestionIds={new Set()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('reference-quiz-questions-quiz-hit')).toBeInTheDocument();
      expect(screen.getByTestId('link-reference-q-hit')).toBeInTheDocument();
    });
    expect(screen.getByTestId('reference-quiz-quiz-hit')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByTestId('link-reference-q-other')).not.toBeInTheDocument();
  });

  it('検索プレースホルダーが問題文・正解を示す', () => {
    render(
      <AuthorQuizReferencePanel
        authorId="author-1"
        onLinkQuestion={jest.fn()}
        onUnlinkQuestion={jest.fn()}
        linkedQuestionIds={new Set()}
      />
    );
    expect(screen.getByTestId('reference-search-keyword')).toHaveAttribute(
      'placeholder',
      'タイトル・説明・問題文・正解で検索'
    );
  });

  it('リンク済み設問はリンク解除ボタンを表示する', async () => {
    const onUnlink = jest.fn();
    render(
      <AuthorQuizReferencePanel
        authorId="author-1"
        onLinkQuestion={jest.fn()}
        onUnlinkQuestion={onUnlink}
        linkedQuestionIds={new Set(['q-ref'])}
      />
    );
    fireEvent.click(screen.getByTestId('reference-quiz-quiz-1'));
    await waitFor(() => expect(screen.getByTestId('unlink-reference-q-ref')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('unlink-reference-q-ref'));
    expect(onUnlink).toHaveBeenCalledWith('q-ref');
    expect(screen.getByTestId('reference-link-success')).toHaveTextContent(
      'リンクを解除しました: 参照設問'
    );
  });
});
