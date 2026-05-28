/**
 * Task 2.3 単体テスト: 解答セッション保護およびオフライン自動同期
 *
 * テスト対象（純粋関数・localStorage操作ロジック）:
 * - LocalAttemptSession: セッションデータのローカル保存・読み込み・クリア
 * - getPendingSyncAttempts: 未同期データ一覧の取得
 * - serializeAttemptSession / deserializeAttemptSession: シリアライズ/デシリアライズ
 *
 * Firestore 依存の saveAttempt はモック不要の純粋関数テストのみ対象とする。
 */

import {
  LocalAttemptSession,
  serializeAttemptSession,
  deserializeAttemptSession,
  getPendingSyncAttempts,
  clearPendingSyncAttempt,
  ATTEMPT_SESSION_KEY_PREFIX,
  PENDING_SYNC_KEY,
  PlayProgressData,
  PendingSyncAttempt,
} from '../../src/services/attempt-session';

/* ============================================================
   localStorage モック
   ============================================================ */

// Node.js テスト環境には localStorage が存在しないためモックを用意する
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

/* ============================================================
   ヘルパー
   ============================================================ */

function makeProgressData(overrides: Partial<PlayProgressData> = {}): PlayProgressData {
  return {
    quizId: 'quiz1',
    userId: 'user1',
    mode: 'normal',
    startedAt: new Date().toISOString(),
    answeredQuestionIds: ['q1', 'q2'],
    failedQuestionIds: [],
    currentScore: 2,
    totalQuestions: 5,
    elapsedSeconds: 30,
    ...overrides,
  };
}

function makePendingAttempt(overrides: Partial<PendingSyncAttempt> = {}): PendingSyncAttempt {
  return {
    localId: 'local_abc123',
    quizId: 'quiz1',
    userId: 'user1',
    mode: 'normal',
    score: 4,
    totalQuestions: 5,
    elapsedSeconds: 120,
    failedQuestionIds: ['q3'],
    aiTurnCount: 0,
    aiTurnLimit: null,
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

/* ============================================================
   各テスト前に localStorage をリセット
   ============================================================ */
beforeEach(() => {
  localStorageMock.clear();
});

/* ============================================================
   serializeAttemptSession / deserializeAttemptSession のテスト
   ============================================================ */
describe('serializeAttemptSession / deserializeAttemptSession', () => {
  test('シリアライズしたデータをデシリアライズすると元のオブジェクトに戻る', () => {
    const data = makeProgressData();
    const serialized = serializeAttemptSession(data);
    const deserialized = deserializeAttemptSession(serialized);
    expect(deserialized).toEqual(data);
  });

  test('不正なJSON文字列をデシリアライズするとnullを返す', () => {
    expect(deserializeAttemptSession('invalid json {')).toBeNull();
  });

  test('空文字列をデシリアライズするとnullを返す', () => {
    expect(deserializeAttemptSession('')).toBeNull();
  });
});

/* ============================================================
   LocalAttemptSession のテスト
   ============================================================ */
describe('LocalAttemptSession', () => {
  const sessionKey = `${ATTEMPT_SESSION_KEY_PREFIX}quiz1_user1`;

  describe('save / load', () => {
    test('セッションデータを保存し、同じキーで読み込める', () => {
      const data = makeProgressData();
      LocalAttemptSession.save('quiz1', 'user1', data);
      const loaded = LocalAttemptSession.load('quiz1', 'user1');
      expect(loaded).toEqual(data);
    });

    test('存在しないキーの読み込みはnullを返す', () => {
      expect(LocalAttemptSession.load('no_quiz', 'no_user')).toBeNull();
    });

    test('上書き保存すると最新データが返る', () => {
      const original = makeProgressData({ currentScore: 1 });
      LocalAttemptSession.save('quiz1', 'user1', original);

      const updated = makeProgressData({ currentScore: 3 });
      LocalAttemptSession.save('quiz1', 'user1', updated);

      expect(LocalAttemptSession.load('quiz1', 'user1')?.currentScore).toBe(3);
    });
  });

  describe('clear', () => {
    test('クリア後に読み込むとnullを返す', () => {
      LocalAttemptSession.save('quiz1', 'user1', makeProgressData());
      LocalAttemptSession.clear('quiz1', 'user1');
      expect(LocalAttemptSession.load('quiz1', 'user1')).toBeNull();
    });
  });
});

/* ============================================================
   getPendingSyncAttempts / clearPendingSyncAttempt のテスト
   ============================================================ */
describe('getPendingSyncAttempts', () => {
  test('未同期データが0件の場合は空配列を返す', () => {
    expect(getPendingSyncAttempts()).toEqual([]);
  });

  test('保存した未同期データを全件取得できる', () => {
    const attempts = [
      makePendingAttempt({ localId: 'local_1', quizId: 'quiz1' }),
      makePendingAttempt({ localId: 'local_2', quizId: 'quiz2' }),
    ];
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(attempts));

    const result = getPendingSyncAttempts();
    expect(result).toHaveLength(2);
    expect(result[0].localId).toBe('local_1');
    expect(result[1].localId).toBe('local_2');
  });

  test('不正なJSONが保存されていた場合は空配列を返す', () => {
    localStorage.setItem(PENDING_SYNC_KEY, 'broken json {');
    expect(getPendingSyncAttempts()).toEqual([]);
  });
});

describe('clearPendingSyncAttempt', () => {
  test('指定したlocalIdのデータのみが削除される', () => {
    const attempts = [
      makePendingAttempt({ localId: 'local_1' }),
      makePendingAttempt({ localId: 'local_2' }),
    ];
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(attempts));

    clearPendingSyncAttempt('local_1');

    const remaining = getPendingSyncAttempts();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].localId).toBe('local_2');
  });

  test('存在しないlocalIdを指定してもエラーにならない', () => {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify([]));
    expect(() => clearPendingSyncAttempt('nonexistent')).not.toThrow();
  });
});
