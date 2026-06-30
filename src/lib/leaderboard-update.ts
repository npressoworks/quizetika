import {
  buildLeaderboardFieldUpdates,
  resolveLeaderboardBoard,
  type LeaderboardBoard,
} from '@/lib/leaderboard-ranking';
import type { Attempt, LeaderboardRecord, Quiz } from '@/types';

export function isLeaderboardEligibleAttempt(
  attemptData: Pick<Attempt, 'userId' | 'mode'>
): boolean {
  if (!attemptData.userId || attemptData.userId === 'guest') {
    return false;
  }
  if (attemptData.mode === 'test-play') {
    return false;
  }
  if (attemptData.mode === 'exam' || attemptData.mode === 'flashcard') {
    return false;
  }
  return true;
}

export function buildLeaderboardUpdatesForQuiz(
  quiz: Quiz,
  priorCompletedCount: number,
  entry: LeaderboardRecord,
  mode: Attempt['mode']
): { board: LeaderboardBoard; updates: ReturnType<typeof buildLeaderboardFieldUpdates> } | null {
  if (!isLeaderboardEligibleAttempt({ userId: entry.userId, mode })) {
    return null;
  }
  // クイズ作成者自身はリーダーボードに載せない
  if (entry.userId === quiz.authorId) {
    return null;
  }
  const board = resolveLeaderboardBoard(priorCompletedCount);
  const updates = buildLeaderboardFieldUpdates(quiz, board, entry);
  return { board, updates };
}
