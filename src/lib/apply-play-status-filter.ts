import type { Quiz } from '@/types';

export type PlayStatusFilter = 'all' | 'unplayed' | 'played';

/** 認証ユーザーのプレイ済み ID 集合で一覧を後段絞り込み（要件 1.3） */
export function applyPlayStatusFilter(
  quizzes: Quiz[],
  playStatus: PlayStatusFilter,
  playedQuizIds: Set<string> | null
): Quiz[] {
  if (playStatus === 'all' || !playedQuizIds) {
    return quizzes;
  }
  if (playStatus === 'played') {
    return quizzes.filter((q) => playedQuizIds.has(q.id));
  }
  return quizzes.filter((q) => !playedQuizIds.has(q.id));
}
