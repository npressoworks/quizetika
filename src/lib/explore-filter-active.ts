import {
  DEFAULT_HOME_FEED_FILTERS,
  type HomeFeedFilters,
} from '@/lib/home-feed-filters';

function hasNonDefaultNumericFilters(filters: HomeFeedFilters): boolean {
  if (filters.difficultyMin !== DEFAULT_HOME_FEED_FILTERS.difficultyMin) return true;
  if (filters.difficultyMax !== DEFAULT_HOME_FEED_FILTERS.difficultyMax) return true;
  if (filters.minQuestions !== DEFAULT_HOME_FEED_FILTERS.minQuestions) return true;
  if (filters.maxQuestions !== DEFAULT_HOME_FEED_FILTERS.maxQuestions) return true;
  return false;
}

/** ホーム: いずれかの探索フィルタが active（format 含む） */
export function hasActiveExploreFilters(filters: HomeFeedFilters): boolean {
  if (filters.genreId.trim()) return true;
  if (filters.format) return true;
  if (filters.searchQuery.trim()) return true;
  if (filters.tagChips.length > 0) return true;
  return hasNonDefaultNumericFilters(filters);
}

/** ジャンルページ: 固定ジャンル以外の条件が active のとき true */
export function hasActiveScopedExploreFilters(
  filters: HomeFeedFilters,
  _lockedGenreId: string
): boolean {
  if (filters.format) return true;
  if (filters.searchQuery.trim()) return true;
  if (filters.tagChips.length > 0) return true;
  return hasNonDefaultNumericFilters(filters);
}

/** @deprecated use hasActiveExploreFilters */
export function hasActiveHomeSearchFilters(filters: HomeFeedFilters): boolean {
  return hasActiveExploreFilters(filters);
}
