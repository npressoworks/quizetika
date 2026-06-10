import {
  fetchPlayHistoryPage,
  getAttemptModeLabel,
  PlayHistoryApiError,
} from '../../src/lib/play-history-client';

const mockListUserPlayHistory = jest.fn();

jest.mock('@/lib/firebase/config', () => ({
  auth: {
    currentUser: null as { uid: string } | null,
  },
}));

jest.mock('@/services/attempt', () => ({
  listUserPlayHistory: (...args: unknown[]) => mockListUserPlayHistory(...args),
}));

describe('play-history-client', () => {
  const { auth } = jest.requireMock('@/lib/firebase/config') as {
    auth: { currentUser: { uid: string } | null };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auth.currentUser = { uid: 'user-1' };
  });

  test('getAttemptModeLabel: 各モードの日本語ラベル', () => {
    expect(getAttemptModeLabel('normal')).toBe('通常モード');
    expect(getAttemptModeLabel('exam')).toBe('模擬試験');
    expect(getAttemptModeLabel('flashcard')).toBe('フラッシュカード');
    expect(getAttemptModeLabel('review')).toBe('弱点克服');
    expect(getAttemptModeLabel('list')).toBe('レガシープレイ');
    expect(getAttemptModeLabel('question-list')).toBe('レガシープレイ');
  });

  test('fetchPlayHistoryPage: 未ログインで PlayHistoryApiError', async () => {
    auth.currentUser = null;

    await expect(fetchPlayHistoryPage({})).rejects.toMatchObject({
      name: 'PlayHistoryApiError',
      status: 401,
      message: 'ログインが必要です',
    });
    expect(mockListUserPlayHistory).not.toHaveBeenCalled();
  });

  test('fetchPlayHistoryPage: listUserPlayHistory の結果を返す', async () => {
    const completedAt = new Date('2026-01-15T12:00:00.000Z');
    mockListUserPlayHistory.mockResolvedValue({
      items: [
        {
          attemptId: 'a1',
          quizId: 'q1',
          quizTitle: 'テスト',
          score: 3,
          totalQuestions: 5,
          mode: 'normal',
          completedAt,
          elapsedSeconds: 42,
        },
      ],
      nextCursor: 'cursor-abc',
    });

    const page = await fetchPlayHistoryPage({ cursor: 'prev', limit: 10 });
    expect(page.items[0].completedAt).toBe(completedAt);
    expect(page.items[0].quizTitle).toBe('テスト');
    expect(page.nextCursor).toBe('cursor-abc');
    expect(mockListUserPlayHistory).toHaveBeenCalledWith({
      uid: 'user-1',
      cursor: 'prev',
      limit: 10,
    });
  });
});
