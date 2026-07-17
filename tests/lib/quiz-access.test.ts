import {
  assertCanSetQuizVisibilitySync,
  canAccessProVisibility,
  canViewQuiz,
  isDiscoveryPublicQuiz,
  isFollowTimelineEligibleQuiz,
  ProRequiredForVisibilityError,
  resolveQuizVisibility,
} from '@/lib/quiz-access';
import type { SubscriptionTier } from '@/types/subscription';

/**
 * Phase 41 以前の DB に残り得る旧tier値。resolveSubscriptionTier() が 'creator' へ
 * マッピングする後方互換パスを検証するため、型システムをあえて迂回して使用する。
 */
const LEGACY_PRO_TIER = 'pro' as unknown as SubscriptionTier;

const publishedPublic = {
  authorId: 'author-1',
  status: 'published' as const,
  visibility: 'public' as const,
};

describe('quiz-access', () => {
  describe('resolveQuizVisibility', () => {
    it('未設定は public', () => {
      expect(resolveQuizVisibility({})).toBe('public');
    });
  });

  describe('canViewQuiz', () => {
    it('public published は未認証でも閲覧可', () => {
      expect(canViewQuiz({ quiz: publishedPublic, viewerUid: null })).toBe(true);
    });

    it('private published は作者のみ', () => {
      const quiz = { ...publishedPublic, visibility: 'private' as const };
      expect(canViewQuiz({ quiz, viewerUid: 'author-1' })).toBe(true);
      expect(canViewQuiz({ quiz, viewerUid: 'other' })).toBe(false);
    });

    it('followers published はフォロワーのみ', () => {
      const quiz = { ...publishedPublic, visibility: 'followers' as const };
      expect(canViewQuiz({ quiz, viewerUid: 'fan', isFollower: true })).toBe(true);
      expect(canViewQuiz({ quiz, viewerUid: 'fan', isFollower: false })).toBe(false);
    });

    it('draft は作者のみ', () => {
      const quiz = { authorId: 'author-1', status: 'draft' as const };
      expect(canViewQuiz({ quiz, viewerUid: 'author-1' })).toBe(true);
      expect(canViewQuiz({ quiz, viewerUid: 'other' })).toBe(false);
    });
  });

  describe('assertCanSetQuizVisibilitySync', () => {
    it('Pro なしで private 設定は拒否', () => {
      expect(() =>
        assertCanSetQuizVisibilitySync({ subscriptionTier: 'free' }, 'private')
      ).toThrow(ProRequiredForVisibilityError);
    });

    it('Pro ありで followers 設定は許可', () => {
      expect(() =>
        assertCanSetQuizVisibilitySync(
          { subscriptionTier: LEGACY_PRO_TIER, subscriptionStatus: 'active' },
          'followers'
        )
      ).not.toThrow();
    });

    it('既存 private の維持（同一値）は Pro なしでも許可', () => {
      expect(() =>
        assertCanSetQuizVisibilitySync(
          { subscriptionTier: 'free' },
          'private',
          'private'
        )
      ).not.toThrow();
    });

    it('public への変更は Pro なしでも許可', () => {
      expect(() =>
        assertCanSetQuizVisibilitySync(
          { subscriptionTier: 'free' },
          'public',
          'private'
        )
      ).not.toThrow();
    });

    it('モデレーターは Pro なしで private 設定可', () => {
      expect(canAccessProVisibility({ moderationTier: 'moderator' })).toBe(true);
    });
  });

  describe('feed filters', () => {
    it('isDiscoveryPublicQuiz', () => {
      expect(isDiscoveryPublicQuiz(publishedPublic)).toBe(true);
      expect(
        isDiscoveryPublicQuiz({ ...publishedPublic, visibility: 'private' })
      ).toBe(false);
    });

    it('isFollowTimelineEligibleQuiz', () => {
      expect(isFollowTimelineEligibleQuiz(publishedPublic)).toBe(true);
      expect(
        isFollowTimelineEligibleQuiz({ ...publishedPublic, visibility: 'followers' })
      ).toBe(true);
      expect(
        isFollowTimelineEligibleQuiz({ ...publishedPublic, visibility: 'private' })
      ).toBe(false);
    });
  });
});
