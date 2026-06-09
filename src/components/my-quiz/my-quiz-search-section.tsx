'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { UnifiedSearchField } from '@/components/explore/unified-search-field';
import { GenreCarousel } from '@/components/explore/genre-carousel';
import { FormatCarousel } from '@/components/explore/format-carousel';
import { GenreSearchField } from '@/components/explore/genre-search-field';
import {
  ActiveFilterChips,
  type FilterChipKey,
} from '@/components/explore/active-filter-chips';
import { useWeeklyTopSearch } from '@/hooks/useWeeklyTrends';
import { normalizeTag } from '@/services/quiz-validation';
import { filterGenreSuggestions } from '@/lib/filter-genre-suggestions';
import {
  DEFAULT_MY_QUIZ_FILTER,
  type MyQuizFilterState,
} from '@/lib/my-quiz-filter';
import {
  myQuizFilterPatchFromChipRemove,
  myQuizFilterPatchFromHomeFeed,
  myQuizFiltersToChipView,
} from '@/lib/my-quiz-filter-adapter';
import type { HomeFeedFilters } from '@/lib/home-feed-filters';
import type { QuizFormat } from '@/lib/quiz-format';
import type { GenreMetadata, TagMetadata } from '@/types';
import styles from '@/app/page.module.css';
import carouselStyles from '@/components/explore/explore-carousel.module.css';

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'かんたん',
  2: 'やや易しい',
  3: '普通',
  4: 'やや難しい',
  5: 'むずかしい',
};

export interface MyQuizSearchSectionProps {
  filters: MyQuizFilterState;
  onChange: (filters: MyQuizFilterState) => void;
  genres: GenreMetadata[];
  genresLoading: boolean;
  genresError: string | null;
  onGenresRetry?: () => void;
  genreLabelById: Map<string, string>;
  tags: TagMetadata[];
  tagsLoading: boolean;
  tagsError: string | null;
  tagLabelById: Map<string, string>;
}

export function MyQuizSearchSection({
  filters,
  onChange,
  genres,
  genresLoading,
  genresError,
  onGenresRetry,
  genreLabelById,
  tags,
  tagsLoading,
  tagsError,
  tagLabelById,
}: MyQuizSearchSectionProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [genreSearchQuery, setGenreSearchQuery] = useState('');
  const { tags: weeklyTags, loading: loadingWeekly, error: errorWeekly } = useWeeklyTopSearch();

  const chipViewFilters = useMemo(() => myQuizFiltersToChipView(filters), [filters]);

  const patchFilters = useCallback(
    (patch: Partial<HomeFeedFilters>) => {
      onChange(myQuizFilterPatchFromHomeFeed(patch, filters));
    },
    [filters, onChange]
  );

  const clearAll = useCallback(() => {
    onChange(DEFAULT_MY_QUIZ_FILTER);
  }, [onChange]);

  const filteredGenres = useMemo(() => {
    const trimmed = genreSearchQuery.trim();
    if (!trimmed) return genres;
    return filterGenreSuggestions(genres, genreSearchQuery, genres.length);
  }, [genres, genreSearchQuery]);

  const handleGenreSelect = useCallback(
    (genreId: string) => {
      patchFilters({ genreId });
      setGenreSearchQuery('');
    },
    [patchFilters]
  );

  const handleFormatSelect = useCallback(
    (format: QuizFormat | '') => {
      patchFilters({ format });
    },
    [patchFilters]
  );

  const quickTags = useMemo(
    () => weeklyTags.filter((tagId) => !filters.tagChips.includes(tagId)).slice(0, 5),
    [weeklyTags, filters.tagChips]
  );

  const handleQuickChip = (tagId: string) => {
    const normalized = normalizeTag(tagId);
    if (!normalized || filters.tagChips.includes(normalized)) return;
    patchFilters({ tagChips: [...filters.tagChips, normalized] });
  };

  const handleFilterChipRemove = (key: FilterChipKey, value?: string) => {
    const patch = myQuizFilterPatchFromChipRemove(key, value, filters);
    onChange({ ...filters, ...patch });
  };

  return (
    <section className={styles.searchSection} data-testid="my-quiz-filters">
      <div className={styles.searchBar}>
        <div className={styles.searchFieldWrapper}>
          <UnifiedSearchField
            tagChips={filters.tagChips}
            onTagChipsChange={(tagChips) => patchFilters({ tagChips })}
            keyword={filters.keyword}
            onKeywordChange={(keyword) => patchFilters({ searchQuery: keyword })}
            tags={tags}
            tagsLoading={tagsLoading}
            tagsError={tagsError}
            tagLabelById={tagLabelById}
            onClearAll={clearAll}
          />
        </div>
        <button
          type="button"
          className={styles.filterToggleBtn}
          onClick={() => setShowFilters(!showFilters)}
          data-testid="my-quiz-filter-toggle"
        >
          <SlidersHorizontal size={18} />
          フィルター
        </button>
      </div>

      <ActiveFilterChips
        filters={chipViewFilters}
        playStatus="all"
        tagLabelById={tagLabelById}
        genreLabelById={genreLabelById}
        onRemove={handleFilterChipRemove}
        onClearAll={clearAll}
      />

      {!errorWeekly && (loadingWeekly || quickTags.length > 0) && (
        <div className={styles.quickSearch} data-testid="my-quiz-quick-search-tags">
          <span className={styles.quickSearchLabel}>クイック検索:</span>
          {loadingWeekly ? (
            <span className={styles.quickSearchLoading}>読み込み中...</span>
          ) : (
            quickTags.map((tagId) => (
              <button
                key={tagId}
                type="button"
                className={styles.quickChip}
                data-testid={`my-quiz-quick-chip-${tagId}`}
                onClick={() => handleQuickChip(tagId)}
              >
                #{tagLabelById.get(tagId) ?? tagId}
              </button>
            ))
          )}
        </div>
      )}

      {showFilters && (
        <div className={styles.filterPanel}>
          <div className={styles.exploreCarouselBlock} data-testid="my-quiz-genre-carousel-block">
            <div
              className={carouselStyles.genreSearchWrap}
              data-testid="my-quiz-genre-search-field"
            >
              <GenreSearchField
                genres={genres}
                query={genreSearchQuery}
                onQueryChange={setGenreSearchQuery}
                value={filters.genreId}
                onChange={handleGenreSelect}
                disabled={genresLoading || !!genresError}
              />
            </div>
            <GenreCarousel
              genres={filteredGenres}
              loading={genresLoading}
              error={genresError}
              selectedGenreId={filters.genreId}
              onSelect={handleGenreSelect}
              onRetry={onGenresRetry}
              emptyMessage={
                genreSearchQuery.trim() ? '該当するジャンルがありません。' : undefined
              }
            />
          </div>

          <div className={styles.exploreCarouselBlock} data-testid="my-quiz-format-carousel-block">
            <FormatCarousel selectedFormat={filters.format} onSelect={handleFormatSelect} />
          </div>

          <div className={styles.filterGroupFull}>
            <div className={styles.filterLabelRow}>
              <span className={styles.filterLabel}>難易度</span>
              <span className={styles.filterValue}>
                {filters.difficultyMin === filters.difficultyMax
                  ? `Lv.${filters.difficultyMin}（${DIFFICULTY_LABELS[filters.difficultyMin]}）`
                  : `Lv.${filters.difficultyMin} 〜 Lv.${filters.difficultyMax}`}
              </span>
            </div>

            <div className={styles.dualSliderWrapper}>
              <div
                className={styles.sliderTrackHighlight}
                style={{
                  left: `${((filters.difficultyMin - 1) / 4) * 100}%`,
                  right: `${((5 - filters.difficultyMax) / 4) * 100}%`,
                }}
              />

              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={filters.difficultyMin}
                className={styles.rangeSlider}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  patchFilters({
                    difficultyMin: v,
                    difficultyMax: Math.max(v, filters.difficultyMax),
                  });
                }}
                aria-label="難易度最小値"
                data-testid="my-quiz-filter-difficulty-min"
              />

              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={filters.difficultyMax}
                className={styles.rangeSlider}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  patchFilters({
                    difficultyMax: v,
                    difficultyMin: Math.min(v, filters.difficultyMin),
                  });
                }}
                aria-label="難易度最大値"
                data-testid="my-quiz-filter-difficulty-max"
              />
            </div>

            <div className={styles.sliderTicks}>
              {[1, 2, 3, 4, 5].map((lv) => (
                <span key={lv} className={styles.sliderTick}>
                  {lv}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
