export interface HomeFeedFilters {
  genreId: string;
  searchQuery: string;
  difficultyMin: number;
  difficultyMax: number;
  minQuestions: number;
  maxQuestions: number;
}

export const DEFAULT_HOME_FEED_FILTERS: HomeFeedFilters = {
  genreId: '',
  searchQuery: '',
  difficultyMin: 1,
  difficultyMax: 10,
  minQuestions: 1,
  maxQuestions: 50,
};

/** タブ別取得のままか、searchQuizzes に切り替えるか */
export function hasActiveHomeSearchFilters(filters: HomeFeedFilters): boolean {
  if (filters.genreId.trim()) return true;
  if (filters.searchQuery.trim()) return true;
  if (filters.difficultyMin !== DEFAULT_HOME_FEED_FILTERS.difficultyMin) return true;
  if (filters.difficultyMax !== DEFAULT_HOME_FEED_FILTERS.difficultyMax) return true;
  if (filters.minQuestions !== DEFAULT_HOME_FEED_FILTERS.minQuestions) return true;
  if (filters.maxQuestions !== DEFAULT_HOME_FEED_FILTERS.maxQuestions) return true;
  return false;
}
