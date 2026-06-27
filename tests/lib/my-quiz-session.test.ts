import {
  MY_QUIZ_SESSION_KEY,
  initMyQuizSession,
  readMyQuizSession,
  advanceMyQuizSession,
  clearMyQuizSession,
  buildMyQuizPlayUrl,
  peekNextMyQuizEntry,
  syncMyQuizSessionIndex,
} from '../../src/lib/my-quiz-session';

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

const entries = [
  { questionId: 'q1', parentQuizId: 'quiz-a' },
  { questionId: 'q2', parentQuizId: 'quiz-b' },
];

describe('my-quiz-session', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
  });

  test('init → read → advance → 最終後 null → clear', () => {
    initMyQuizSession('session-uuid', entries);
    const read = readMyQuizSession();
    expect(read?.sessionId).toBe('session-uuid');
    expect(read?.currentIndex).toBe(0);

    const next = advanceMyQuizSession();
    expect(next?.questionId).toBe('q2');
    expect(readMyQuizSession()?.currentIndex).toBe(1);

    expect(advanceMyQuizSession()).toBeNull();
    clearMyQuizSession();
    expect(readMyQuizSession()).toBeNull();
  });

  test('buildMyQuizPlayUrl に mode=my-quiz と sessionId を含む', () => {
    initMyQuizSession('session-uuid', entries);
    const session = readMyQuizSession()!;
    const url = buildMyQuizPlayUrl(session, 0);
    expect(url).toContain('/quiz/quiz-a/play?');
    expect(url).toContain('mode=my-quiz');
    expect(url).toContain('sessionId=session-uuid');
    expect(url).toContain('questionId=q1');
    expect(url).toContain('qIndex=0');
  });

  test('MY_QUIZ_SESSION_KEY は固定値 quizetika_my_quiz_session である', () => {
    expect(MY_QUIZ_SESSION_KEY).toBe('quizetika_my_quiz_session');
  });

  test('syncMyQuizSessionIndex で currentIndex を同期する', () => {
    initMyQuizSession('session-uuid', entries);
    syncMyQuizSessionIndex(1);
    expect(readMyQuizSession()?.currentIndex).toBe(1);
  });

  test('peekNextMyQuizEntry はインデックスを進めない', () => {
    initMyQuizSession('session-uuid', entries);
    expect(peekNextMyQuizEntry()?.questionId).toBe('q2');
    expect(readMyQuizSession()?.currentIndex).toBe(0);
  });
});
