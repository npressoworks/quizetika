'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { TuneOutlined } from '@mui/icons-material';
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
import { Button } from '@/components/ui/button';

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'かんたん',
  2: 'やや易しい',
  3: '普通',
  4: 'やや難しい',
  5: 'むずかしい',
};

export interface BookmarkSearchSectionProps {
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

export function BookmarkSearchSection({
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
}: BookmarkSearchSectionProps) {
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
    <section
      className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm max-md:p-4 mb-4"
      data-testid="bookmarks-filters"
    >
      <div className="flex gap-3 max-md:flex-col max-md:items-stretch">
        <div className="relative flex flex-1 items-center">
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
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-12 shrink-0 self-stretch max-md:justify-center"
          onClick={() => setShowFilters(!showFilters)}
          data-testid="bookmarks-filter-toggle"
        >
          <TuneOutlined sx={{ fontSize: 18 }} />
          フィルター
        </Button>
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
        <div className="flex flex-wrap items-center gap-2" data-testid="bookmarks-quick-search-tags">
          <span className="text-xs font-semibold text-muted-foreground">クイック検索:</span>
          {loadingWeekly ? (
            <span className="text-xs text-muted-foreground">読み込み中...</span>
          ) : (
            quickTags.map((tagId) => (
              <Button
                key={tagId}
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                data-testid={`bookmarks-quick-chip-${tagId}`}
                onClick={() => handleQuickChip(tagId)}
              >
                #{tagLabelById.get(tagId) ?? tagId}
              </Button>
            ))
          )}
        </div>
      )}

      {showFilters && (
        <div className="flex animate-fade-in flex-col gap-5 border-t pt-4">
          <div className="flex flex-col gap-2" data-testid="bookmarks-genre-carousel-block">
            <div className="mb-3" data-testid="bookmarks-genre-search-field">
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

          <div className="flex flex-col gap-2" data-testid="bookmarks-format-carousel-block">
            <FormatCarousel selectedFormat={filters.format} onSelect={handleFormatSelect} />
          </div>

          <div className="flex w-full flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-muted-foreground">難易度</span>
              <span className="text-sm font-bold text-primary">
                {filters.difficultyMin === filters.difficultyMax
                  ? `🔥${filters.difficultyMin}（${DIFFICULTY_LABELS[filters.difficultyMin]}）`
                  : `🔥${filters.difficultyMin} 〜 🔥${filters.difficultyMax}`}
              </span>
            </div>

            <div className="explore-dual-slider">
              <div
                className="explore-slider-highlight"
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
                className="explore-range-input"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  patchFilters({
                    difficultyMin: v,
                    difficultyMax: Math.max(v, filters.difficultyMax),
                  });
                }}
                aria-label="難易度最小値"
                data-testid="bookmarks-filter-difficulty-min"
              />
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={filters.difficultyMax}
                className="explore-range-input"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  patchFilters({
                    difficultyMax: v,
                    difficultyMin: Math.min(v, filters.difficultyMin),
                  });
                }}
                aria-label="難易度最大値"
                data-testid="bookmarks-filter-difficulty-max"
              />
            </div>

            <div className="flex justify-between px-0.5">
              {[1, 2, 3, 4, 5].map((lv) => (
                <span key={lv} className="select-none text-xs font-semibold text-muted-foreground">
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
