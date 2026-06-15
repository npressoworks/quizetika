import { isFollowing } from '@/services/user';
import {
  computeUserEntitlements,
  type EntitlementUserFields,
} from '@/services/entitlement-shared';
import type { Quiz, QuizVisibility } from '@/types';

export const PRO_RESTRICTED_VISIBILITY: QuizVisibility[] = ['private', 'followers'];

export class QuizAccessDeniedError extends Error {
  readonly code = 'QUIZ_ACCESS_DENIED' as const;
  constructor(message = 'このクイズを閲覧する権限がありません') {
    super(message);
    this.name = 'QuizAccessDeniedError';
  }
}

export class ProRequiredForVisibilityError extends Error {
  readonly code = 'pro-required-for-visibility' as const;
  constructor(message = '非公開・フォロワー限定の設定には Pro プランが必要です') {
    super(message);
    this.name = 'ProRequiredForVisibilityError';
  }
}

export function resolveQuizVisibility(
  quiz: Pick<Quiz, 'visibility'>
): QuizVisibility {
  return quiz.visibility ?? 'public';
}

export type CanViewQuizInput = {
  quiz: Pick<Quiz, 'authorId' | 'status' | 'visibility'>;
  viewerUid: string | null | undefined;
  isFollower?: boolean;
  isSeniorModeratorOrAdmin?: boolean;
};

export function canViewQuiz(input: CanViewQuizInput): boolean {
  const { quiz, viewerUid } = input;

  if (quiz.status === 'suspended') {
    return (
      !!input.isSeniorModeratorOrAdmin ||
      (!!viewerUid && quiz.authorId === viewerUid)
    );
  }

  if (quiz.status === 'draft') {
    return !!viewerUid && quiz.authorId === viewerUid;
  }

  if (quiz.status !== 'published') {
    return false;
  }

  if (viewerUid && quiz.authorId === viewerUid) {
    return true;
  }

  if (input.isSeniorModeratorOrAdmin) {
    return true;
  }

  const visibility = resolveQuizVisibility(quiz);
  if (visibility === 'public') {
    return true;
  }
  if (visibility === 'private') {
    return false;
  }

  return !!viewerUid && !!input.isFollower;
}

export function canAccessProVisibility(fields: EntitlementUserFields): boolean {
  if (
    fields.moderationTier === 'moderator' ||
    fields.moderationTier === 'senior_moderator'
  ) {
    return true;
  }
  return computeUserEntitlements(fields).hasPaidEntitlements;
}

export function assertCanSetQuizVisibilitySync(
  fields: EntitlementUserFields,
  nextVisibility: QuizVisibility,
  prevVisibility?: QuizVisibility
): void {
  const resolvedPrev = prevVisibility ?? 'public';
  if (!PRO_RESTRICTED_VISIBILITY.includes(nextVisibility)) {
    return;
  }
  if (nextVisibility === resolvedPrev) {
    return;
  }
  if (!canAccessProVisibility(fields)) {
    throw new ProRequiredForVisibilityError();
  }
}

export async function resolveFollowerStatus(
  viewerUid: string | null | undefined,
  authorId: string
): Promise<boolean> {
  if (!viewerUid || viewerUid === authorId) {
    return false;
  }
  return isFollowing(viewerUid, authorId);
}

export async function assertCanViewQuizAsync(
  quiz: Pick<Quiz, 'authorId' | 'status' | 'visibility'>,
  viewerUid: string | null | undefined,
  options?: { isSeniorModeratorOrAdmin?: boolean }
): Promise<void> {
  let isFollower = false;
  if (
    viewerUid &&
    quiz.authorId !== viewerUid &&
    quiz.status === 'published' &&
    resolveQuizVisibility(quiz) === 'followers'
  ) {
    isFollower = await resolveFollowerStatus(viewerUid, quiz.authorId);
  }

  if (
    !canViewQuiz({
      quiz,
      viewerUid,
      isFollower,
      isSeniorModeratorOrAdmin: options?.isSeniorModeratorOrAdmin,
    })
  ) {
    throw new QuizAccessDeniedError();
  }
}

export function isDiscoveryPublicQuiz(
  quiz: Pick<Quiz, 'status' | 'visibility'>
): boolean {
  return quiz.status === 'published' && resolveQuizVisibility(quiz) === 'public';
}

export function isFollowTimelineEligibleQuiz(
  quiz: Pick<Quiz, 'status' | 'visibility'>
): boolean {
  if (quiz.status !== 'published') {
    return false;
  }
  const visibility = resolveQuizVisibility(quiz);
  return visibility === 'public' || visibility === 'followers';
}

export function normalizeQuizVisibilityForSave(
  visibility: QuizVisibility | undefined,
  status: Quiz['status']
): QuizVisibility | undefined {
  if (visibility !== undefined) {
    return visibility;
  }
  if (status === 'published') {
    return 'public';
  }
  return undefined;
}
