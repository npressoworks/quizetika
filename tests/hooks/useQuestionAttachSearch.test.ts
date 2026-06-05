/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useQuestionAttachSearch } from '@/hooks/useQuestionAttachSearch';

jest.mock('@/services/author-quiz-search', () => ({
  searchAuthorQuizzes: jest.fn(),
}));

jest.mock('@/services/question', () => ({
  getQuestionsByQuiz: jest.fn(),
  getBookmarkedQuestions: jest.fn(),
}));

jest.mock('@/services/quiz', () => ({
  getLatestQuizzes: jest.fn(),
  getQuiz: jest.fn(),
}));

import { searchAuthorQuizzes } from '@/services/author-quiz-search';
import { getQuestionsByQuiz, getBookmarkedQuestions } from '@/services/question';

const mockSearchAuthor = searchAuthorQuizzes as jest.Mock;
const mockGetQuestions = getQuestionsByQuiz as jest.Mock;
const mockBookmarked = getBookmarkedQuestions as jest.Mock;

describe('useQuestionAttachSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('own-published タブで公開クイズの設問候補を返す', async () => {
    mockSearchAuthor.mockResolvedValue([
      { id: 'quiz-1', title: '公開クイズ', status: 'published' },
      { id: 'quiz-2', title: '下書き', status: 'draft' },
    ]);
    mockGetQuestions.mockResolvedValue([
      { id: 'q1', questionText: 'JS の基礎', quizId: 'quiz-1' },
    ]);

    const { result } = renderHook(() =>
      useQuestionAttachSearch('author-1', 'own-published')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.candidates).toHaveLength(1);
    expect(result.current.candidates[0].questionText).toBe('JS の基礎');
    expect(mockGetQuestions).toHaveBeenCalledWith('quiz-1');
    expect(mockGetQuestions).not.toHaveBeenCalledWith('quiz-2');
  });

  it('キーワードで候補をフィルタする', async () => {
    mockBookmarked.mockResolvedValue([
      { id: 'q1', questionText: 'Alpha', quizId: 'z1' },
      { id: 'q2', questionText: 'Beta', quizId: 'z1' },
    ]);

    const { result } = renderHook(() =>
      useQuestionAttachSearch('user-1', 'bookmarked')
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setKeyword('beta'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(result.current.candidates[0].questionText).toBe('Beta');
  });
});
