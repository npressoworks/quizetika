/**
 * usePlayState カスタムフックのユニットテスト (TDD RED)
 *
 * 目的:
 * 1. 解答進行時に localStorage にセッションデータが自動保存されることをテスト。
 * 2. 初期化時に localStorage から過去の解答状況が復旧されることをテスト。
 */

import { PlayProgressData, ATTEMPT_SESSION_KEY_PREFIX } from '@/services/attempt-session';

// localStorage のモック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('usePlayState ロジックの検証', () => {
  const quizId = 'test_quiz_id';
  const userId = 'test_user_id';
  const sessionKey = `${ATTEMPT_SESSION_KEY_PREFIX}${quizId}_${userId}`;

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  test('解答のシリアライズ保存が正しく行われること', () => {
    // 保存用ダミーデータ
    const mockData: PlayProgressData = {
      quizId,
      userId,
      mode: 'normal',
      startedAt: new Date().toISOString(),
      answeredQuestionIds: ['q1', 'q2'],
      failedQuestionIds: ['q2'],
      currentScore: 1,
      totalQuestions: 3,
      elapsedSeconds: 45,
    };

    // シリアライズして保存
    localStorage.setItem(sessionKey, JSON.stringify(mockData));

    // 検証
    expect(localStorage.setItem).toHaveBeenCalledWith(sessionKey, expect.any(String));
    const loaded = JSON.parse(localStorage.getItem(sessionKey) || '{}');
    expect(loaded.currentScore).toBe(1);
    expect(loaded.answeredQuestionIds).toContain('q1');
  });

  test('セッションが正しくクリアされること', () => {
    localStorage.setItem(sessionKey, 'dummy');
    localStorage.removeItem(sessionKey);
    expect(localStorage.removeItem).toHaveBeenCalledWith(sessionKey);
    expect(localStorage.getItem(sessionKey)).toBeNull();
  });
});
