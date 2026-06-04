import { getDoc, doc, runTransaction } from 'firebase/firestore';
import {
  resolveModerationTier,
  getReputationScore,
  checkModeratorEligibility,
  getReputationLimit,
  resetUserReputation,
} from '../../src/services/reputation';

// Firebase Firestore モック
jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn((ref, ...paths) => {
      const basePath = typeof ref === 'object' && ref && 'path' in ref ? ref.path : '';
      const id = paths.length > 0 ? paths[paths.length - 1] : 'auto-generated-id';
      const fullPath = paths.length > 0 
        ? (basePath ? `${basePath}/${paths.join('/')}` : paths.join('/'))
        : (basePath ? `${basePath}/${id}` : '');
      return { id, path: fullPath };
    }),
    collection: jest.fn((db, path) => ({ path })),
    getDoc: jest.fn(),
    runTransaction: jest.fn(),
    serverTimestamp: jest.fn(() => new Date()),
  };
});


describe('ReputationService - resolveModerationTier', () => {
  test('0 〜 49 点は newcomer', () => {
    expect(resolveModerationTier(0)).toBe('newcomer');
    expect(resolveModerationTier(49)).toBe('newcomer');
  });

  test('50 〜 149 点は contributor', () => {
    expect(resolveModerationTier(50)).toBe('contributor');
    expect(resolveModerationTier(149)).toBe('contributor');
  });

  test('150 〜 499 点は moderator', () => {
    expect(resolveModerationTier(150)).toBe('moderator');
    expect(resolveModerationTier(499)).toBe('moderator');
  });

  test('500 点以上は senior_moderator', () => {
    expect(resolveModerationTier(500)).toBe('senior_moderator');
    expect(resolveModerationTier(9999)).toBe('senior_moderator');
  });
});

describe('ReputationService - getReputationScore', () => {
  test('ユーザーが存在しない場合は、初期値（0点、newcomer、空履歴）を返す', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
    });

    const result = await getReputationScore('none-uid');
    expect(result).toEqual({
      reputationScore: 0,
      moderationTier: 'newcomer',
      reputationHistory: [],
    });
  });

  test('ユーザーが存在する場合は、設定されたデータを取得する', async () => {
    const mockUserData = {
      reputationScore: 180,
      moderationTier: 'moderator',
      reputationHistory: [{ eventId: '1', delta: 10, reason: 'test', createdAt: new Date() }],
    };

    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => mockUserData,
    });

    const result = await getReputationScore('test-uid');
    expect(result).toEqual(mockUserData);
  });
});

describe('ReputationService - checkModeratorEligibility', () => {
  test('newcomer と contributor は eligibility が false', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ reputationScore: 40, moderationTier: 'newcomer' }),
    });
    expect(await checkModeratorEligibility('uid')).toBe(false);

    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ reputationScore: 80, moderationTier: 'contributor' }),
    });
    expect(await checkModeratorEligibility('uid')).toBe(false);
  });

  test('moderator と senior_moderator は eligibility が true', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ reputationScore: 200, moderationTier: 'moderator' }),
    });
    expect(await checkModeratorEligibility('uid')).toBe(true);

    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ reputationScore: 600, moderationTier: 'senior_moderator' }),
    });
    expect(await checkModeratorEligibility('uid')).toBe(true);
  });
});

describe('ReputationService - getReputationLimit', () => {
  const authorId = 'author-uid';
  const senderId = 'sender-uid';

  test('加算制限データが存在しない場合は、累計 0 pt を返す', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
    });

    const result = await getReputationLimit(authorId, senderId);
    expect(result).toEqual({ totalDelta: 0 });
  });

  test('加算制限データが存在する場合は、設定された totalDelta を返す', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ id: senderId, totalDelta: 3 }),
    });

    const result = await getReputationLimit(authorId, senderId);
    expect(result).toEqual({ totalDelta: 3 });
  });
});

describe('ReputationService - resetUserReputation', () => {
  const targetUid = 'target-user-uid';
  const executorId = 'admin-executor-uid';
  const reason = 'コミュニティ荒らし行為のためリセット';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('管理者が実行した場合、対象ユーザーのスコアとティアーがリセットされ、adminLogsに監査ログが書き込まれること', async () => {
    const mockTargetUserSnap = {
      exists: () => true,
      data: () => ({
        displayName: '荒らしユーザー',
        reputationScore: 250,
        moderationTier: 'moderator',
      }),
    };

    const mockExecutorSnap = {
      exists: () => true,
      data: () => ({
        displayName: 'システム管理者',
        moderationTier: 'admin', // 管理者権限
      }),
    };

    const mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        if (ref.id === targetUid) return mockTargetUserSnap;
        return mockExecutorSnap;
      }),
      update: jest.fn(),
      set: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    await resetUserReputation(targetUid, executorId, reason);

    expect(mockTransaction.get).toHaveBeenCalledTimes(2);
    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    expect(mockTransaction.set).toHaveBeenCalledTimes(1);

    // ユーザー情報のリセット確認
    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: targetUid }),
      {
        reputationScore: 0,
        moderationTier: 'newcomer',
        updatedAt: expect.any(Date),
      }
    );

    // 監査ログの書き込み確認
    expect(mockTransaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('adminLogs') }),
      {
        targetUid,
        executorId,
        action: 'reputation_reset',
        reason,
        createdAt: expect.any(Date),
      }
    );
  });

  test('非管理者が実行した場合、Permission Deniedで処理が拒否されること', async () => {
    const mockTargetUserSnap = {
      exists: () => true,
      data: () => ({ reputationScore: 100 }),
    };

    const mockExecutorSnap = {
      exists: () => true,
      data: () => ({
        displayName: '一般モデレータ',
        moderationTier: 'moderator', // 管理者でない
      }),
    };

    const mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        if (ref.id === targetUid) return mockTargetUserSnap;
        return mockExecutorSnap;
      }),
      update: jest.fn(),
      set: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    await expect(
      resetUserReputation(targetUid, 'non-admin-uid', reason)
    ).rejects.toThrow('この操作を実行する権限がありません');
  });

  test('理由が10文字未満の場合、バリデーションエラーになること', async () => {
    await expect(
      resetUserReputation(targetUid, executorId, '短すぎ')
    ).rejects.toThrow('リセット理由は10文字以上で入力してください。');
  });
});

