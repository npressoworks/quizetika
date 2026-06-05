import {
  QUESTION_LIST_SESSION_KEY,
  initQuestionListSession,
  readQuestionListSession,
  advanceQuestionListSession,
  clearQuestionListSession,
  buildQuestionListPlayUrl,
  peekNextQuestionListEntry,
} from '../../src/lib/question-list-session';

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

describe('question-list-session', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
  });

  test('init → read → advance → 最終後 null → clear', () => {
    initQuestionListSession('list-1', entries);
    const read = readQuestionListSession();
    expect(read?.listId).toBe('list-1');
    expect(read?.currentIndex).toBe(0);

    const next = advanceQuestionListSession();
    expect(next?.questionId).toBe('q2');
    expect(readQuestionListSession()?.currentIndex).toBe(1);

    expect(advanceQuestionListSession()).toBeNull();
    clearQuestionListSession();
    expect(readQuestionListSession()).toBeNull();
  });

  test('buildQuestionListPlayUrl に mode=question-list と questionId を含む', () => {
    initQuestionListSession('list-1', entries);
    const session = readQuestionListSession()!;
    const url = buildQuestionListPlayUrl(session, 0);
    expect(url).toContain('/quiz/quiz-a/play?');
    expect(url).toContain('mode=question-list');
    expect(url).toContain('questionId=q1');
    expect(url).toContain('qIndex=0');
    expect(url).toContain('listId=list-1');
  });

  test('peekNextQuestionListEntry はインデックスを進めない', () => {
    initQuestionListSession('list-1', entries);
    expect(peekNextQuestionListEntry()?.questionId).toBe('q2');
    expect(readQuestionListSession()?.currentIndex).toBe(0);
  });

  test('sessionStorage キーが設計どおり', () => {
    initQuestionListSession('list-1', entries);
    expect(sessionStorageMock.getItem(QUESTION_LIST_SESSION_KEY)).toBeTruthy();
  });
});
