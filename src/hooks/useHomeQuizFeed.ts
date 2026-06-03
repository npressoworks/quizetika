'use client';

import { useEffect, useState } from 'react';
import {
  getLatestQuizzes,
  getPopularQuizzes,
  getTrendingQuizzes,
  getFollowedTimeline,
  searchQuizzes,
} from '@/services/quiz';
import {
  hasActiveHomeSearchFilters,
  type HomeFeedFilters,
} from '@/lib/home-feed-filters';
import type { Quiz } from '@/types';

const DEBOUNCE_MS = 300;

export type HomeFeedTab = 'latest' | 'popular' | 'trending' | 'timeline';

export function useHomeQuizFeed(
  activeTab: HomeFeedTab,
  userId: string | undefined,
  filters: HomeFeedFilters
) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        let fetched: Quiz[] = [];

        if (hasActiveHomeSearchFilters(filters)) {
          fetched = await searchQuizzes(filters.searchQuery, {
            genreId: filters.genreId.trim() || undefined,
            difficultyMin: filters.difficultyMin,
            difficultyMax: filters.difficultyMax,
            minQuestions: filters.minQuestions,
            maxQuestions: filters.maxQuestions,
          });
        } else if (activeTab === 'latest') {
          fetched = await getLatestQuizzes(30);
        } else if (activeTab === 'popular') {
          fetched = await getPopularQuizzes(30);
        } else if (activeTab === 'trending') {
          fetched = await getTrendingQuizzes(30);
        } else if (activeTab === 'timeline') {
          fetched = userId ? await getFollowedTimeline(userId, 30) : [];
        }

        if (!cancelled) setQuizzes(fetched);
      } catch (e) {
        console.error('[useHomeQuizFeed]', e);
        if (!cancelled) {
          setQuizzes([]);
          setError('クイズ一覧の取得に失敗しました。');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    activeTab,
    userId,
    filters.genreId,
    filters.searchQuery,
    filters.difficultyMin,
    filters.difficultyMax,
    filters.minQuestions,
    filters.maxQuestions,
  ]);

  return { quizzes, loading, error };
}
