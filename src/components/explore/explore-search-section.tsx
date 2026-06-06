'use client';

import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { UnifiedSearchField } from '@/components/explore/unified-search-field';
import { normalizeTag } from '@/services/quiz-validation';
import type { TagMetadata } from '@/types';
import type { HomeFeedFilters } from '@/lib/home-feed-filters';
import styles from '@/app/page.module.css';

const QUICK_CHIPS = ['#ウミガメのスープ', '#JavaScript', '#雑学', '#難問', '#初心者向け'];

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
}: ExploreSearchSectionProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handleQuickChip = (label: string) => {
    const normalized = normalizeTag(label.replace(/^#/, ''));
    if (!normalized || filters.tagChips.includes(normalized)) return;
    onFiltersChange({ tagChips: [...filters.tagChips, normalized] });
  };

  return (
    <section
      className={styles.searchSection}
      data-testid={testId ?? (lockedGenreId ? 'genre-explore-search' : undefined)}
    >
      <div className={styles.searchBar}>
        <div className={styles.searchFieldWrapper}>
          <UnifiedSearchField
            tagChips={filters.tagChips}
            onTagChipsChange={(tagChips) => onFiltersChange({ tagChips })}
            keyword={filters.searchQuery}
            onKeywordChange={(searchQuery) => onFiltersChange({ searchQuery })}
            tags={tags}
            tagsLoading={tagsLoading}
            tagsError={tagsError}
            tagLabelById={tagLabelById}
            onClearAll={onClearAll}
          />
        </div>
        <button
          type="button"
          className={styles.filterToggleBtn}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={18} />
          フィルター
        </button>
      </div>

      {showQuickSearch && (
        <div className={styles.quickSearch}>
          <span className={styles.quickSearchLabel}>クイック検索:</span>
          {QUICK_CHIPS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles.quickChip}
              onClick={() => handleQuickChip(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {showFilters && (
        <div className={styles.filterPanel}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>難易度範囲 (1 - 10)</span>
            <div className={styles.rangeInputs}>
              <input
                type="number"
                min="1"
                max="10"
                className={styles.filterSelect}
                value={filters.difficultyMin}
                onChange={(e) =>
                  onFiltersChange({ difficultyMin: Number(e.target.value) })
                }
              />
              <span>〜</span>
              <input
                type="number"
                min="1"
                max="10"
                className={styles.filterSelect}
                value={filters.difficultyMax}
                onChange={(e) =>
                  onFiltersChange({ difficultyMax: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>問題数</span>
            <div className={styles.rangeInputs}>
              <input
                type="number"
                min="1"
                className={styles.filterSelect}
                value={filters.minQuestions}
                onChange={(e) =>
                  onFiltersChange({ minQuestions: Number(e.target.value) })
                }
              />
              <span>〜</span>
              <input
                type="number"
                min="1"
                className={styles.filterSelect}
                value={filters.maxQuestions}
                onChange={(e) =>
                  onFiltersChange({ maxQuestions: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>プレイ状況</span>
            <select
              className={styles.filterSelect}
              value={playStatus}
              disabled={playStatusDisabled}
              title={
                playStatusDisabled ? 'ログインするとプレイ状況で絞り込めます' : undefined
              }
              onChange={(e) =>
                onPlayStatusChange(e.target.value as 'all' | 'unplayed' | 'played')
              }
            >
              <option value="all">すべて表示</option>
              <option value="unplayed">未プレイのみ</option>
              <option value="played">プレイ済みのみ</option>
            </select>
            {playStatusDisabled && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                プレイ状況で絞り込むにはログインが必要です
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
