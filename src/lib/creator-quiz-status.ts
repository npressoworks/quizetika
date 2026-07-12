import { resolveQuizVisibility } from '@/lib/quiz-access';
import type { Quiz } from '@/types';

export type CreatorQuizStatus =
  | 'draft'
  | 'public'
  | 'followers'
  | 'private'
  | 'suspended';

/**
 * クイズの `status` と `visibility` から、作成者管理画面向けの統合ステータスを導出する。
 *
 * Preconditions: `quiz.status` は `'draft' | 'published' | 'suspended'`。
 * Postconditions: 常に5値のいずれか1つを返す（null/undefined を返さない）。
 * Invariants: `status === 'suspended'` を最優先で判定し、`draft`/`visibility` 分岐より前に評価する。
 */
export function resolveCreatorQuizStatus(
  quiz: Pick<Quiz, 'status' | 'visibility'>
): CreatorQuizStatus {
  if (quiz.status === 'suspended') {
    return 'suspended';
  }
  if (quiz.status !== 'published') {
    return 'draft';
  }
  const visibility = resolveQuizVisibility(quiz);
  if (visibility === 'private') return 'private';
  if (visibility === 'followers') return 'followers';
  return 'public';
}
