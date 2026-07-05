jest.mock('@/services/user', () => ({
  getUserProfile: jest.fn(),
}));

import { getUserProfile } from '@/services/user';
import { assertSeedGenresAccess } from '@/lib/seed-genres-access';
import type { User } from '@/types';

const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'uid-1',
    email: 'user@example.com',
    displayName: 'テストユーザー',
    avatarUrl: '',
    bio: '',
    followedGenres: [],
    badges: [],
    createdQuizzesCount: 0,
    totalPlayCount: 0,
    followersCount: 0,
    followingCount: 0,
    reputationScore: 0,
    moderationTier: 'newcomer',
    reputationHistory: [],
    lastReputationCalculatedAt: null,
    totalFailedQuestionsCount: 0,
    deleteStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

describe('assertSeedGenresAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ユーザーが存在しない場合はエラーを投げる', async () => {
    mockGetUserProfile.mockResolvedValue(null);

    await expect(assertSeedGenresAccess('missing-uid')).rejects.toThrow(
      'users/missing-uid が存在しません'
    );
  });

  test('BANされているユーザーはエラーを投げる', async () => {
    mockGetUserProfile.mockResolvedValue(
      buildUser({ moderationTier: 'admin' as User['moderationTier'], isBanned: true })
    );

    await expect(assertSeedGenresAccess('uid-1')).rejects.toThrow('停止（BAN）されている');
  });

  test('moderationTier が admin でない、かつ role も admin でない場合はエラーを投げる', async () => {
    mockGetUserProfile.mockResolvedValue(
      buildUser({ moderationTier: 'senior_moderator' })
    );

    await expect(assertSeedGenresAccess('uid-1')).rejects.toThrow('管理者権限がありません');
  });

  test('moderationTier が admin の場合はアクセスを許可する', async () => {
    const user = buildUser({ moderationTier: 'admin' as User['moderationTier'] });
    mockGetUserProfile.mockResolvedValue(user);

    await expect(assertSeedGenresAccess('uid-1')).resolves.toEqual(user);
  });

  test('role が admin の場合はアクセスを許可する（moderationTier が admin でなくても）', async () => {
    const user = buildUser({ moderationTier: 'newcomer', role: 'admin' });
    mockGetUserProfile.mockResolvedValue(user);

    await expect(assertSeedGenresAccess('uid-1')).resolves.toEqual(user);
  });
});
