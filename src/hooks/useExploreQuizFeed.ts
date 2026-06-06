'use client';

import { useEffect, useState } from 'react';
import {
  getLatestQuizzes,
  getPopularQuizzes,
  getTrendingQuizzes,
  getFollowedTimeline,
  getQuizzesByGenre,
  searchQuizzes,
  type QuizListSort,
} from '@/services/quiz';
import { sortQuizzesForList } from '@/lib/metadata-resolution';
import type { HomeFeedFilters } from '@/lib/home-feed-filters';
import {
  hasActiveExploreFilters,
  hasActiveScopedExploreFilters,
} from '@/lib/explore-filter-active';
import type { Quiz } from '@/types';

const DEBOUNCE_MS = 300;

export type HomeFeedTab = 'latest' | 'popular' | 'trending' | 'timeline';
export type ExploreFeedMode = 'home' | 'scoped';

export interface UseExploreQuizFeedOptions {
  mode: ExploreFeedMode;
  activeTab?: HomeFeedTab;
  userId?: string;
  filters: HomeFeedFilters;
  lockedGenreId?: string;
  activeSort?: QuizListSort;
  limit?: number;
}

function buildSearchArgs(filters: HomeFeedFilters, genreIdOverride?: string) {
  const genreId = genreIdOverride ?? filters.genreId.trim();
  return {
    genreId: genreId || undefined,
    tags: filters.tagChips.length > 0 ? filters.tagChips : undefined,
    format: filters.format || undefined,
    difficultyMin: filters.difficultyMin,
    difficultyMax: filters.difficultyMax,
    minQuestions: filters.minQuestions,
    maxQuestions: filters.maxQuestions,
  };
}

export function useExploreQuizFeed(options: UseExploreQuizFeedOptions) {
  const {
    mode,
    activeTab = 'latest',
    userId,
    filters,
    lockedGenreId,
    activeSort = 'latest',
    limit = 30,
  } = options;

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

        if (mode === 'scoped' && lockedGenreId) {
          if (hasActiveScopedExploreFilters(filters, lockedGenreId)) {
            fetched = await searchQuizzes(
              filters.searchQuery,
              buildSearchArgs(filters, lockedGenreId)
            );
            fetched = sortQuizzesForList(fetched, activeSort);
          } else {
            fetched = await getQuizzesByGenre(lockedGenreId, limit, activeSort);
          }
        } else if (hasActiveExploreFilters(filters)) {
          fetched = await searchQuizzes(filters.searchQuery, buildSearchArgs(filters));
        } else if (activeTab === 'latest') {
          fetched = await getLatestQuizzes(limit);
        } else if (activeTab === 'popular') {
          fetched = await getPopularQuizzes(limit);
        } else if (activeTab === 'trending') {
          fetched = await getTrendingQuizzes(limit);
        } else if (activeTab === 'timeline') {
          fetched = userId ? await getFollowedTimeline(userId, limit) : [];
        }

        if (!cancelled) setQuizzes(fetched);
      } catch (e) {
        console.error('[useExploreQuizFeed]', e);
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
    mode,
    activeTab,
    userId,
    lockedGenreId,
    activeSort,
    limit,
    filters.genreId,
    filters.format,
    filters.searchQuery,
    filters.tagChips.join(','),
    filters.difficultyMin,
    filters.difficultyMax,
    filters.minQuestions,
    filters.maxQuestions,
  ]);

  return { quizzes, loading, error };
}
