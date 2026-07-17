'use client';

import React from 'react';
import { CloseOutlined } from '@mui/icons-material';
import {
  DEFAULT_HOME_FEED_FILTERS,
  type HomeFeedFilters,
} from '@/lib/home-feed-filters';
import { EXPLORE_FORMAT_OPTIONS } from '@/lib/explore-formats';
import { hasActiveExploreFilters } from '@/lib/explore-filter-active';
import type { SearchPlayStatus } from '@/lib/search-url-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type FilterChipKey =
  | 'genre'
  | 'format'
  | 'difficulty'
  | 'questionCount'
  | 'keyword'
  | 'tag'
  | 'playStatus';

export interface ActiveFilterChipsProps {
  filters: HomeFeedFilters;
  playStatus: SearchPlayStatus;
  tagLabelById: Map<string, string>;
  genreLabelById: Map<string, string>;
  onRemove: (key: FilterChipKey, value?: string) => void;
  onClearAll: () => void;
}

const PLAY_STATUS_LABELS: Record<Exclude<SearchPlayStatus, 'all'>, string> = {
  unplayed: '未プレイ',
  played: 'プレイ済み',
};

function isNonDefaultDifficulty(filters: HomeFeedFilters): boolean {
  return (
    filters.difficultyMin !== DEFAULT_HOME_FEED_FILTERS.difficultyMin ||
    filters.difficultyMax !== DEFAULT_HOME_FEED_FILTERS.difficultyMax
  );
}

function isNonDefaultQuestionCount(filters: HomeFeedFilters): boolean {
  return (
    filters.minQuestions !== DEFAULT_HOME_FEED_FILTERS.minQuestions ||
    filters.maxQuestions !== DEFAULT_HOME_FEED_FILTERS.maxQuestions
  );
}

interface ChipItem {
  key: FilterChipKey;
  value?: string;
  label: string;
}

function buildChipItems(
  filters: HomeFeedFilters,
  playStatus: SearchPlayStatus,
  tagLabelById: Map<string, string>,
  genreLabelById: Map<string, string>
): ChipItem[] {
  const items: ChipItem[] = [];

  if (filters.genreId.trim()) {
    items.push({
      key: 'genre',
      label: `ジャンル: ${genreLabelById.get(filters.genreId) ?? filters.genreId}`,
    });
  }

  if (filters.format) {
    const formatLabel =
      EXPLORE_FORMAT_OPTIONS.find((option) => option.id === filters.format)?.label ??
      filters.format;
    items.push({
      key: 'format',
      label: `形式: ${formatLabel}`,
    });
  }

  if (isNonDefaultDifficulty(filters)) {
    items.push({
      key: 'difficulty',
      label: `難易度: ${filters.difficultyMin}〜${filters.difficultyMax}`,
    });
  }

  if (isNonDefaultQuestionCount(filters)) {
    items.push({
      key: 'questionCount',
      label: `問題数: ${filters.minQuestions}〜${filters.maxQuestions}問`,
    });
  }

  filters.tagChips.forEach((tag) => {
    items.push({
      key: 'tag',
      value: tag,
      label: `#${tagLabelById.get(tag) ?? tag}`,
    });
  });

  if (filters.searchQuery.trim()) {
    items.push({
      key: 'keyword',
      label: `キーワード: ${filters.searchQuery.trim()}`,
    });
  }

  if (playStatus !== 'all') {
    items.push({
      key: 'playStatus',
      label: PLAY_STATUS_LABELS[playStatus],
    });
  }

  return items;
}

export function ActiveFilterChips({
  filters,
  playStatus,
  tagLabelById,
  genreLabelById,
  onRemove,
  onClearAll,
}: ActiveFilterChipsProps) {
  const chips = buildChipItems(filters, playStatus, tagLabelById, genreLabelById);
  const visible = hasActiveExploreFilters(filters) || playStatus !== 'all';

  if (!visible || chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-0 py-2" data-testid="search-active-filters">
      <div className="flex flex-1 flex-wrap gap-2">
        {chips.map((chip) => (
          <Badge
            key={`${chip.key}-${chip.value ?? chip.label}`}
            variant="secondary"
            className="gap-1.5 py-1 pr-1 pl-3 text-xs"
            data-testid={chip.key === 'tag' ? 'search-tag-chip' : `search-active-filter-${chip.key}${chip.value ? `-${chip.value}` : ''}`}
          >
            <span>{chip.label}</span>
            <button
              type="button"
              className="inline-flex rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`${chip.label} を解除`}
              onClick={() => onRemove(chip.key, chip.value)}
            >
              <CloseOutlined sx={{ fontSize: 14 }} aria-hidden />
            </button>
          </Badge>
        ))}
      </div>
      <Button type="button" variant="link" size="sm" className="h-auto shrink-0 p-0" onClick={onClearAll}>
        すべてクリア
      </Button>
    </div>
  );
}
