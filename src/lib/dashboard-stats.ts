import type { Quiz } from '@/types';

export interface DashboardStats {
  totalPlays: number;
  totalBookmarks: number;
  averageRating: number;
  quizCount: number;
}

export function computeDashboardStats(quizzes: Quiz[]): DashboardStats {
  let plays = 0;
  let bookmarks = 0;
  let reviewsSum = 0;
  let reviewsCount = 0;

  quizzes.forEach((q) => {
    plays += q.playCount || 0;
    bookmarks += q.bookmarksCount || 0;
    if (q.reviewScore !== null && q.reviewScore !== undefined) {
      reviewsSum += q.reviewScore;
      reviewsCount += 1;
    }
  });

  return {
    totalPlays: plays,
    totalBookmarks: bookmarks,
    averageRating: reviewsCount > 0 ? Math.round((reviewsSum / reviewsCount) * 10) / 10 : 0,
    quizCount: quizzes.length,
  };
}
