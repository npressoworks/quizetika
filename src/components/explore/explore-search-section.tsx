'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { TuneOutlined } from '@mui/icons-material';
import { UnifiedSearchField } from '@/components/explore/unified-search-field';
import { GenreCarousel } from '@/components/explore/genre-carousel';
import { FormatCarousel } from '@/components/explore/format-carousel';
import { GenreSearchField } from '@/components/explore/genre-search-field';
import { useWeeklyTopSearch } from '@/hooks/useWeeklyTrends';
import { normalizeTag } from '@/services/quiz-validation';
import { filterGenreSuggestions } from '@/lib/filter-genre-suggestions';
import type { GenreMetadata, TagMetadata } from '@/types';
import type { HomeFeedFilters } from '@/lib/home-feed-filters';
import type { SearchPlayStatus } from '@/lib/search-url-state';
import type { QuizFormat } from '@/lib/quiz-format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { badgeVariants } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const DIFFICULTY_MIN = 1;
const DIFFICULTY_MAX = 5;
const QUESTIONS_MIN = 1;
const QUESTIONS_MAX = 50;

const PLAY_STATUS_OPTIONS: { value: SearchPlayStatus; label: string }[] = [
  { value: 'all', label: 'すべて表示' },
  { value: 'unplayed', label: '未プレイのみ' },
  { value: 'played', label: 'プレイ済みのみ' },
];

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseNumericInput(raw: string): number | null {
  if (raw.trim() === '') return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface ExploreSearchSectionProps {
  filters: HomeFeedFilters;
  onFiltersChange: (patch: Partial<HomeFeedFilters>) => void;
  onClearAll: () => void;
  lockedGenreId?: string;
  tags: TagMetadata[];
  tagsLoading: boolean;
  tagsError: string | null;
  tagLabelById: Map<string, string>;
  playStatus: 'all' | 'unplayed' | 'played';
  onPlayStatusChange: (value: 'all' | 'unplayed' | 'played') => void;
  playStatusDisabled?: boolean;
  showQuickSearch?: boolean;
  testId?: string;
  showExploreCarousels?: boolean;
  genres?: GenreMetadata[];
  genresLoading?: boolean;
  genresError?: string | null;
  onGenresRetry?: () => void;
  selectedGenreId?: string;
  onGenreSelect?: (genreId: string) => void;
  selectedFormat?: QuizFormat | '';
  onFormatSelect?: (format: QuizFormat | '') => void;
  stickySearchBarTestId?: string;
  initialOpenFilters?: boolean;
  activeFilterChipsSlot?: React.ReactNode;
}

export function ExploreSearchSection({
  filters,
  onFiltersChange,
  onClearAll,
  lockedGenreId,
  tags,
  tagsLoading,
  tagsError,
  tagLabelById,
  playStatus,
  onPlayStatusChange,
  playStatusDisabled = false,
  showQuickSearch = true,
  testId,
  showExploreCarousels = false,
  genres = [],
  genresLoading = false,
  genresError = null,
  onGenresRetry,
  selectedGenreId = '',
  onGenreSelect,
  selectedFormat = '',
  onFormatSelect,
  stickySearchBarTestId,
  initialOpenFilters = false,
  activeFilterChipsSlot,
}: ExploreSearchSectionProps) {
  const [showFilters, setShowFilters] = useState(initialOpenFilters);
  const [genreSearchQuery, setGenreSearchQuery] = useState('');
  const { tags: weeklyTags, loading: loadingWeekly, error: errorWeekly } = useWeeklyTopSearch();

  const filteredGenres = useMemo(() => {
    const trimmed = genreSearchQuery.trim();
    if (!trimmed) return genres;
    return filterGenreSuggestions(genres, genreSearchQuery, genres.length);
  }, [genres, genreSearchQuery]);

  const handleGenreSelect = useCallback(
    (genreId: string) => {
      onGenreSelect?.(genreId);
      setGenreSearchQuery('');
    },
    [onGenreSelect],
  );

  const quickTags = useMemo(
    () => weeklyTags.filter((tagId) => !filters.tagChips.includes(tagId)).slice(0, 5),
    [weeklyTags, filters.tagChips],
  );

  const handleQuickChip = (tagId: string) => {
    const normalized = normalizeTag(tagId);
    if (!normalized || filters.tagChips.includes(normalized)) return;
    onFiltersChange({ tagChips: [...filters.tagChips, normalized] });
  };

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm max-md:p-4"
      data-testid={testId ?? (lockedGenreId ? 'genre-explore-search' : undefined)}
    >
      <div
        className={cn(
          'flex gap-3 max-md:flex-col max-md:items-stretch',
          showExploreCarousels &&
            'sticky top-0 z-[80] -mx-1 bg-background/95 px-1 py-2 backdrop-blur-sm',
        )}
        data-testid={
          showExploreCarousels
            ? (stickySearchBarTestId ?? 'home-search-bar-sticky')
            : undefined
        }
      >
        <div className="relative flex flex-1 items-center">
          <UnifiedSearchField
            tagChips={filters.tagChips}
            onTagChipsChange={(tagChips) => onFiltersChange({ tagChips })}
            keyword={filters.searchQuery}
            onKeywordChange={(searchQuery) => onFiltersChange({ searchQuery })}
            onSearchStateChange={(tagChips, searchQuery) => onFiltersChange({ tagChips, searchQuery })}
            tags={tags}
            tagsLoading={tagsLoading}
            tagsError={tagsError}
            tagLabelById={tagLabelById}
            onClearAll={onClearAll}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-12 shrink-0 self-stretch max-md:justify-center"
          onClick={() => setShowFilters(!showFilters)}
        >
          <TuneOutlined sx={{ fontSize: 18 }} />
          フィルター
        </Button>
      </div>

      {activeFilterChipsSlot}

      {showQuickSearch && !errorWeekly && (loadingWeekly || quickTags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2" data-testid="quick-search-tags">
          <span className="text-xs font-semibold text-muted-foreground">クイック検索:</span>
          {loadingWeekly ? (
            <span className="text-xs text-muted-foreground">読み込み中...</span>
          ) : (
            quickTags.map((tagId) => (
              <button
                key={tagId}
                type="button"
                className={cn(
                  badgeVariants({ variant: 'secondary' }),
                  'cursor-pointer hover:bg-secondary/80',
                )}
                data-testid={`quick-search-chip-${tagId}`}
                onClick={() => handleQuickChip(tagId)}
              >
                #{tagLabelById.get(tagId) ?? tagId}
              </button>
            ))
          )}
        </div>
      )}

      {showFilters && (
        <div className="flex animate-fade-in flex-col gap-5 border-t pt-4">
          {showExploreCarousels && onGenreSelect && onFormatSelect && (
            <>
              <div className="flex flex-col gap-2" data-testid="home-genre-carousel-block">
                <div className="mb-3" data-testid="genre-explore-search-field">
                  <GenreSearchField
                    genres={genres}
                    query={genreSearchQuery}
                    onQueryChange={setGenreSearchQuery}
                    value={selectedGenreId}
                    onChange={handleGenreSelect}
                    disabled={genresLoading || !!genresError}
                  />
                </div>
                <GenreCarousel
                  genres={filteredGenres}
                  loading={genresLoading}
                  error={genresError}
                  selectedGenreId={selectedGenreId}
                  onSelect={handleGenreSelect}
                  onRetry={onGenresRetry}
                  emptyMessage={
                    genreSearchQuery.trim() ? '該当するジャンルがありません。' : undefined
                  }
                />
              </div>
              <div className="flex flex-col gap-2" data-testid="home-format-carousel-block">
                <FormatCarousel selectedFormat={selectedFormat} onSelect={onFormatSelect} />
              </div>
            </>
          )}

          <div className="flex flex-row flex-wrap items-start gap-4" data-testid="search-filter-row">
            <div className="flex min-w-[140px] flex-1 flex-col gap-2">
              <span className="text-sm font-semibold text-muted-foreground">難易度</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={DIFFICULTY_MIN}
                  max={DIFFICULTY_MAX}
                  inputMode="numeric"
                  className="w-20"
                  value={filters.difficultyMin}
                  onChange={(e) => {
                    const parsed = parseNumericInput(e.target.value);
                    if (parsed == null) return;
                    const difficultyMin = clampInt(parsed, DIFFICULTY_MIN, DIFFICULTY_MAX);
                    onFiltersChange({
                      difficultyMin,
                      difficultyMax: Math.max(difficultyMin, filters.difficultyMax),
                    });
                  }}
                  aria-label="難易度最小値"
                  data-testid="search-filter-difficulty-min"
                />
                <span className="text-sm text-muted-foreground">〜</span>
                <Input
                  type="number"
                  min={DIFFICULTY_MIN}
                  max={DIFFICULTY_MAX}
                  inputMode="numeric"
                  className="w-20"
                  value={filters.difficultyMax}
                  onChange={(e) => {
                    const parsed = parseNumericInput(e.target.value);
                    if (parsed == null) return;
                    const difficultyMax = clampInt(parsed, DIFFICULTY_MIN, DIFFICULTY_MAX);
                    onFiltersChange({
                      difficultyMax,
                      difficultyMin: Math.min(difficultyMax, filters.difficultyMin),
                    });
                  }}
                  aria-label="難易度最大値"
                  data-testid="search-filter-difficulty-max"
                />
              </div>
            </div>

            <div className="flex min-w-[140px] flex-1 flex-col gap-2">
              <span className="text-sm font-semibold text-muted-foreground">問題数</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={QUESTIONS_MIN}
                  max={QUESTIONS_MAX}
                  inputMode="numeric"
                  className="w-20"
                  value={filters.minQuestions}
                  onChange={(e) => {
                    const parsed = parseNumericInput(e.target.value);
                    if (parsed == null) return;
                    const minQuestions = clampInt(parsed, QUESTIONS_MIN, QUESTIONS_MAX);
                    onFiltersChange({
                      minQuestions,
                      maxQuestions: Math.max(minQuestions, filters.maxQuestions),
                    });
                  }}
                  aria-label="最小問題数"
                  data-testid="search-filter-min-questions"
                />
                <span className="text-sm text-muted-foreground">〜</span>
                <Input
                  type="number"
                  min={QUESTIONS_MIN}
                  max={QUESTIONS_MAX}
                  inputMode="numeric"
                  className="w-20"
                  value={filters.maxQuestions}
                  onChange={(e) => {
                    const parsed = parseNumericInput(e.target.value);
                    if (parsed == null) return;
                    const maxQuestions = clampInt(parsed, QUESTIONS_MIN, QUESTIONS_MAX);
                    onFiltersChange({
                      maxQuestions,
                      minQuestions: Math.min(maxQuestions, filters.minQuestions),
                    });
                  }}
                  aria-label="最大問題数"
                  data-testid="search-filter-max-questions"
                />
              </div>
            </div>

            <div className="flex min-w-[160px] flex-1 flex-col gap-2">
              <span className="text-sm font-semibold text-muted-foreground">プレイ状況</span>
              <Select
                value={playStatus}
                disabled={playStatusDisabled}
                onValueChange={(value) =>
                  onPlayStatusChange(value as 'all' | 'unplayed' | 'played')
                }
              >
                <SelectTrigger
                  className="w-full"
                  title={
                    playStatusDisabled ? 'ログインするとプレイ状況で絞り込めます' : undefined
                  }
                >
                  <SelectValue>
                    {PLAY_STATUS_OPTIONS.find((option) => option.value === playStatus)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PLAY_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {playStatusDisabled && (
                <p className="text-xs text-muted-foreground">
                  プレイ状況で絞り込むにはログインが必要です
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
