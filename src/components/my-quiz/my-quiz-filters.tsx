'use client';

import React, { useEffect, useState } from 'react';
import { EXPLORE_FORMAT_OPTIONS } from '@/lib/explore-formats';
import {
  DEFAULT_MY_QUIZ_FILTER,
  hasActiveMyQuizFilters,
  type MyQuizFilterState,
} from '@/lib/my-quiz-filter';
import styles from './my-quiz.module.css';

interface MyQuizFiltersProps {
  filters: MyQuizFilterState;
  onChange: (filters: MyQuizFilterState) => void;
  genreOptions: { id: string; label: string }[];
}

export function MyQuizFilters({ filters, onChange, genreOptions }: MyQuizFiltersProps) {
  const [keyword, setKeyword] = useState(filters.keyword);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ ...filters, keyword });
    }, 300);
    return () => clearTimeout(timer);
    // keyword debounce only; filters spread uses latest closure from parent re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const clearAll = () => {
    setKeyword('');
    onChange(DEFAULT_MY_QUIZ_FILTER);
  };

  return (
    <section className={styles.section} data-testid="my-quiz-filters">
      <h2 className={styles.sectionTitle}>フィルタ</h2>

      <input
        type="search"
        className={styles.filterInput}
        placeholder="キーワードで絞り込み..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        data-testid="my-quiz-filter-keyword"
      />

      <label className={styles.filterRow}>
        <span>ジャンル</span>
        <select
          className={styles.filterSelect}
          value={filters.genreId}
          onChange={(e) => onChange({ ...filters, genreId: e.target.value })}
          data-testid="my-quiz-filter-genre"
        >
          <option value="">すべて</option>
          {genreOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.filterRow}>
        <span>出題形式</span>
        <select
          className={styles.filterSelect}
          value={filters.format}
          onChange={(e) =>
            onChange({ ...filters, format: e.target.value as MyQuizFilterState['format'] })
          }
          data-testid="my-quiz-filter-format"
        >
          <option value="">すべて</option>
          {EXPLORE_FORMAT_OPTIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.filterRow}>
        <span>難易度</span>
        <div className={styles.difficultyRange}>
          <input
            type="number"
            min={1}
            max={5}
            value={filters.difficultyMin}
            onChange={(e) =>
              onChange({ ...filters, difficultyMin: Number(e.target.value) || 1 })
            }
            data-testid="my-quiz-filter-difficulty-min"
          />
          <span>〜</span>
          <input
            type="number"
            min={1}
            max={5}
            value={filters.difficultyMax}
            onChange={(e) =>
              onChange({ ...filters, difficultyMax: Number(e.target.value) || 5 })
            }
            data-testid="my-quiz-filter-difficulty-max"
          />
        </div>
      </div>

      {hasActiveMyQuizFilters(filters) && (
        <div data-testid="my-quiz-active-filters">
          <button type="button" className="btn btn-secondary" onClick={clearAll}>
            フィルタをクリア
          </button>
        </div>
      )}
    </section>
  );
}
