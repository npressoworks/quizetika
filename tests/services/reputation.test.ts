import { getDoc, doc } from 'firebase/firestore';
import {
  resolveModerationTier,
  getReputationScore,
  checkModeratorEligibility,
  getReputationLimit,
} from '../../src/services/reputation';

// Firebase Firestore モック
jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn((ref, ...paths) => ({ id: paths[paths.length - 1], path: paths.join('/') })),
    getDoc: jest.fn(),
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
