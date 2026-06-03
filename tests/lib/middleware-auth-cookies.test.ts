/**
 * @jest-environment jsdom
 */
import {
  clearMiddlewareAuthCookies,
  syncMiddlewareAuthCookies,
} from '@/lib/middleware-auth-cookies';
import type { User } from '@/types';

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Test',
    avatarUrl: '',
    bio: '',
    followedGenres: [],
    badges: [],
    createdQuizzesCount: 0,
    totalPlayCount: 0,
    followersCount: 0,
    followingCount: 0,
    reputationScore: 0,
    moderationTier: 'contributor',
    reputationHistory: [],
    lastReputationCalculatedAt: null,
    totalFailedQuestionsCount: 0,
    deleteStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('middleware-auth-cookies', () => {
  beforeEach(() => {
    document.cookie = 'quizeum_uid=; path=/; max-age=0';
    document.cookie = 'quizeum_tier=; path=/; max-age=0';
    document.cookie = 'quizeum_role=; path=/; max-age=0';
  });

  it('ログイン時に uid と tier Cookie を設定する', () => {
    syncMiddlewareAuthCookies(baseUser(), 'user-1');

    expect(document.cookie).toContain('quizeum_uid=user-1');
    expect(document.cookie).toContain('quizeum_tier=contributor');
    expect(document.cookie).not.toContain('quizeum_role=admin');
  });

  it('admin ユーザーは quizeum_role Cookie も設定する', () => {
    syncMiddlewareAuthCookies(
      baseUser({ moderationTier: 'admin' as User['moderationTier'] }),
      'admin-1'
    );

    expect(document.cookie).toContain('quizeum_role=admin');
  });

  it('ログアウト時に Cookie をクリアする', () => {
    syncMiddlewareAuthCookies(baseUser(), 'user-1');
    clearMiddlewareAuthCookies();

    expect(document.cookie).not.toContain('quizeum_uid=');
    expect(document.cookie).not.toContain('quizeum_tier=');
    expect(document.cookie).not.toContain('quizeum_role=');
  });
});
