/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBookmarkFeed } from '@/hooks/useBookmarkFeed';

const mockGetBookmarkFeed = jest.fn();
const mockToggleBookmark = jest.fn();

jest.mock('@/services/bookmark', () => ({
  getBookmarkFeed: (...args: unknown[]) => mockGetBookmarkFeed(...args),
  toggleBookmark: (...args: unknown[]) => mockToggleBookmark(...args),
}));

describe('useBookmarkFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBookmarkFeed.mockResolvedValue({
      quizzes: [{ id: 'quiz-1' }],
      lists: [{ id: 'list-1' }],
      questions: [{ question: { id: 'q1' }, parentQuizId: 'quiz-a', parentQuizTitle: 'A', bookmarkedAt: new Date() }],
    });
    mockToggleBookmark.mockResolvedValue(false);
  });

  it('マウント時に feed を取得する', async () => {
    const { result } = renderHook(() => useBookmarkFeed('user-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.feed?.quizzes).toHaveLength(1);
    expect(mockGetBookmarkFeed).toHaveBeenCalledWith('user-1');
  });

  it('removeBookmark で楽観的に設問を除去する', async () => {
    const { result } = renderHook(() => useBookmarkFeed('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeBookmark('question', 'q1');
    });

    expect(result.current.feed?.questions).toHaveLength(0);
    expect(mockToggleBookmark).toHaveBeenCalledWith('user-1', 'q1', 'question');
  });
});
