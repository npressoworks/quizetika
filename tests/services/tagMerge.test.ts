import { runTransaction, doc, getDocs } from 'firebase/firestore';
import {
  createMergeRequest,
  voteMergeRequest,
  runMigration,
  submitGenreRequest,
  voteGenreRequest,
  seedInitialGenres,
} from '../../src/services/tagMerge';

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn((ref, ...paths) => {
      const id = paths.length > 0 ? paths[paths.length - 1] : 'auto-generated-id';
      return { id, path: paths.join('/') };
    }),
    collection: jest.fn((db, path) => ({ path })),
    query: jest.fn((ref, ...clauses) => ({ ref, clauses })),
    where: jest.fn((field, op, value) => ({ field, op, value })),
    limit: jest.fn((n) => ({ limit: n })),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    updateDoc: jest.fn(),
    writeBatch: jest.fn(),
    increment: jest.fn((n) => n),
    arrayUnion: jest.fn((...items) => items),
    runTransaction: jest.fn(),
    Timestamp: {
      fromDate: jest.fn((date) => date),
    },
  };
});

describe('TagMergeService - createMergeRequest', () => {
  const sourceId = 'source-tag';
  const targetId = 'target-tag';
  const userId = 'user-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('マージ提案の起案が正常に完了し、起案者が賛成1票（重み付き）として投票されること', async () => {
    const { getDoc, setDoc } = require('firebase/firestore');

    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ moderationTier: 'moderator', displayName: '山田太郎' }),
    });

    (getDocs as jest.Mock).mockResolvedValue({
      empty: true,
    });

    const newRequestId = await createMergeRequest(sourceId, targetId, 'tag', '重複のため', userId);

    expect(newRequestId).toBeDefined();
    // 循環チェックとマスタ重複チェックが行われていること
    expect(getDoc).toHaveBeenCalledTimes(2);
    expect(getDocs).toHaveBeenCalledTimes(1);
  });

  test('同一ID同士のマージは起案時エラーになること', async () => {
    await expect(
      createMergeRequest(sourceId, sourceId, 'tag', '同じタグ', userId)
    ).rejects.toThrow('同一のタグ/ジャンルをマージすることはできません。');
  });

  test('直接循環参照が発生する場合（ターゲットが既にソースを指している）、起案が拒否されること', async () => {
    const { getDoc } = require('firebase/firestore');

    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ canonicalId: sourceId }),
    });

    await expect(
      createMergeRequest(sourceId, targetId, 'tag', '循環マージテスト', userId)
    ).rejects.toThrow('循環マージが発生するため、このマージ提案は起案できません。');
  });

  test('間接循環参照が発生する場合（A ➔ B ➔ C ➔ A）、起案が拒否されること', async () => {
    const { getDoc } = require('firebase/firestore');

    (getDoc as jest.Mock)
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ canonicalId: 'C-tag' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ canonicalId: sourceId }),
      });

    await expect(
      createMergeRequest(sourceId, targetId, 'tag', '複数ホップ循環マージテスト', userId)
    ).rejects.toThrow('循環マージが発生するため、このマージ提案は起案できません。');
  });
});

describe('TagMergeService - voteMergeRequest', () => {
  const requestId = 'request-id';
  const voterId = 'voter-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('モデレータによる投票が反映されること', async () => {
    const mockRequestSnap = {
      exists: () => true,
      data: () => ({
        targetType: 'tag',
        sourceId: 'tagA',
        targetId: 'tagB',
        status: 'pending',
        votedUserIds: ['user1'],
        votesForCount: 1,
        votesAgainstCount: 0,
        weightedVotesFor: 1,
        weightedVotesAgainst: 0,
        votes: [],
      }),
    };

    const mockVoterSnap = {
      exists: () => true,
      data: () => ({ moderationTier: 'moderator' }), // 重み1
    };

    const mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        if (ref.id === requestId) return mockRequestSnap;
        return mockVoterSnap;
      }),
      update: jest.fn(),
      set: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    await voteMergeRequest(requestId, voterId, 'approve');

    expect(mockTransaction.get).toHaveBeenCalledTimes(2);
    expect(mockTransaction.update).toHaveBeenCalledTimes(1);

    // 投票数がインクリメントされていること
    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: requestId }),
      expect.objectContaining({
        votesForCount: 2,
        weightedVotesFor: 2,
      })
    );
  });

  test('可決条件（重み付き賛成票 >= 5 かつ 賛成率 >= 70%）達成時に、自動適用と移行バッチの起動がされること', async () => {
    jest.useFakeTimers();

    const mockRequestSnap = {
      exists: () => true,
      data: () => ({
        targetType: 'tag',
        sourceId: 'tagA',
        targetId: 'tagB',
        status: 'pending',
        votedUserIds: ['u1', 'u2', 'u3', 'u4'],
        votesForCount: 4,
        votesAgainstCount: 0,
        // すでに重み4点（賛成票）
        weightedVotesFor: 4,
        weightedVotesAgainst: 0,
        votes: [],
      }),
    };

    const mockVoterSnap = {
      exists: () => true,
      data: () => ({ moderationTier: 'senior_moderator' }), // シニアモデレータ（重み2）
    };

    const mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        if (ref.id === requestId) return mockRequestSnap;
        return mockVoterSnap;
      }),
      update: jest.fn(),
      set: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    await voteMergeRequest(requestId, voterId, 'approve');

    expect(mockTransaction.get).toHaveBeenCalledTimes(2);
    // status の 'approved' 更新、sourceマスタとtargetマスタの適用の3箇所が update される
    expect(mockTransaction.update).toHaveBeenCalledTimes(3);

    // status が approved になっていること
    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: requestId }),
      expect.objectContaining({
        status: 'approved',
        migrationStatus: 'processing',
      })
    );

    jest.useRealTimers();
  });
});

describe('TagMergeService - voteGenreRequest', () => {
  const requestId = 'req-id';
  const voterId = 'voter-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ジャンル新設申請で可決（賛成票 >= 5かつ賛成率 >= 80%）時に、metadata_genres マスタが自動登録されること', async () => {
    const mockRequestSnap = {
      exists: () => true,
      data: () => ({
        genreId: 'retro',
        displayName: 'レトロゲーム',
        iconImageUrl: 'icon-url',
        status: 'pending',
        votedUserIds: ['u1', 'u2', 'u3', 'u4'],
        votesForCount: 4,
        votesAgainstCount: 0,
        weightedVotesFor: 4,
        weightedVotesAgainst: 0,
      }),
    };

    const mockVoterSnap = {
      exists: () => true,
      data: () => ({ moderationTier: 'moderator' }), // 重み1
    };

    const mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        if (ref.id === requestId) return mockRequestSnap;
        return mockVoterSnap;
      }),
      update: jest.fn(),
      set: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    await voteGenreRequest(requestId, voterId, 'approve');

    expect(mockTransaction.get).toHaveBeenCalledTimes(2);
    expect(mockTransaction.update).toHaveBeenCalledTimes(1); // 申請 status の更新
    expect(mockTransaction.set).toHaveBeenCalledTimes(1); // ジャンルマスタの新規登録

    // ジャンルマスタ登録検証
    expect(mockTransaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'retro' }),
      expect.objectContaining({
        id: 'retro',
        displayName: 'レトロゲーム',
        iconImageUrl: 'icon-url',
        isActive: true,
      })
    );
  });
});

describe('TagMergeService - seedInitialGenres', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('未登録ジャンルは新規作成され added が増えること', async () => {
    const { getDoc, setDoc } = require('firebase/firestore');

    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    const result = await seedInitialGenres();

    expect(result.added).toBeGreaterThan(0);
    expect(result.updated).toBe(0);
    expect(setDoc).toHaveBeenCalled();
  });

  test('既存ジャンルIDは更新され updated が増えること', async () => {
    const { getDoc, updateDoc, setDoc } = require('firebase/firestore');

    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true });
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    const result = await seedInitialGenres();

    expect(result.updated).toBeGreaterThan(0);
    expect(updateDoc).toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  test('新規と既存が混在する場合、added と updated が両方カウントされること', async () => {
    const { getDoc, updateDoc, setDoc } = require('firebase/firestore');
    let callIndex = 0;

    (getDoc as jest.Mock).mockImplementation(() => {
      const exists = callIndex % 2 === 1;
      callIndex += 1;
      return Promise.resolve({ exists: () => exists });
    });
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    const result = await seedInitialGenres();

    expect(result.added).toBeGreaterThan(0);
    expect(result.updated).toBeGreaterThan(0);
    expect(result.added + result.updated).toBeGreaterThan(0);
  });
});
