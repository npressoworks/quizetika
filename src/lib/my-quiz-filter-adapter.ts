import type { FilterChipKey } from '@/components/explore/active-filter-chips';
import {
  DEFAULT_HOME_FEED_FILTERS,
  type HomeFeedFilters,
} from '@/lib/home-feed-filters';
import {
  DEFAULT_MY_QUIZ_FILTER,
  type MyQuizFilterState,
} from '@/lib/my-quiz-filter';

/** ActiveFilterChips 表示用に HomeFeedFilters 形式へ変換 */
export function myQuizFiltersToChipView(filters: MyQuizFilterState): HomeFeedFilters {
  return {
    ...DEFAULT_HOME_FEED_FILTERS,
    genreId: filters.genreId,
    format: filters.format,
    searchQuery: filters.keyword,
    tagChips: filters.tagChips,
    difficultyMin: filters.difficultyMin,
    difficultyMax: filters.difficultyMax,
  };
}

export function myQuizFilterPatchFromChipRemove(
  key: FilterChipKey,
  value: string | undefined,
  current: MyQuizFilterState
): Partial<MyQuizFilterState> {
  switch (key) {
    case 'genre':
      return { genreId: '' };
    case 'format':
      return { format: '' };
    case 'difficulty':
      return {
        difficultyMin: DEFAULT_MY_QUIZ_FILTER.difficultyMin,
        difficultyMax: DEFAULT_MY_QUIZ_FILTER.difficultyMax,
      };
    case 'keyword':
      return { keyword: '' };
    case 'tag':
      return { tagChips: current.tagChips.filter((chip) => chip !== value) };
    default:
      return {};
  }
}

export function myQuizFilterPatchFromHomeFeed(
  patch: Partial<HomeFeedFilters>,
  current: MyQuizFilterState
): MyQuizFilterState {
  return {
    ...current,
    ...(patch.searchQuery !== undefined ? { keyword: patch.searchQuery } : {}),
    ...(patch.tagChips !== undefined ? { tagChips: patch.tagChips } : {}),
    ...(patch.genreId !== undefined ? { genreId: patch.genreId } : {}),
    ...(patch.format !== undefined ? { format: patch.format } : {}),
    ...(patch.difficultyMin !== undefined ? { difficultyMin: patch.difficultyMin } : {}),
    ...(patch.difficultyMax !== undefined ? { difficultyMax: patch.difficultyMax } : {}),
  };
}
