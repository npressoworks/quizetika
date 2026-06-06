'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { filterTagSuggestions } from '@/lib/filter-tag-suggestions';
import { normalizeTag } from '@/services/quiz-validation';
import type { TagMetadata } from '@/types';
import styles from './unified-search-field.module.css';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useWeeklyTopSearch } from '@/hooks/useWeeklyTrends';

export interface UnifiedSearchFieldProps {
  tagChips: string[];
  onTagChipsChange: (chips: string[]) => void;
  keyword: string;
  onKeywordChange: (value: string) => void;
  tags: TagMetadata[];
  tagsLoading: boolean;
  tagsError: string | null;
  tagLabelById: Map<string, string>;
  onClearAll: () => void;
  disabled?: boolean;
}

export function UnifiedSearchField({
  tagChips,
  onTagChipsChange,
  keyword,
  onKeywordChange,
  tags,
  tagsLoading,
  tagsError,
  tagLabelById,
  onClearAll,
  disabled = false,
}: UnifiedSearchFieldProps) {
  const inputId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const { recentKeywords, addRecentKeyword } = useSearchHistory();
  const { keywords: weeklyKeywords, tags: weeklyTags, loading: loadingWeekly, error: errorWeekly } = useWeeklyTopSearch();

  const suggestions = useMemo(
    () => filterTagSuggestions(tags, keyword),
    [tags, keyword]
  );

  const showClear = keyword.trim().length > 0 || tagChips.length > 0;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [keyword, suggestions.length]);

  const tryAddChip = (raw: string): boolean => {
    let token = raw.trim();
    if (token.startsWith('#')) token = token.slice(1);
    const normalized = normalizeTag(token);
    if (!normalized || tagChips.includes(normalized)) return false;
    addRecentKeyword(normalized); // 履歴に追加
    onTagChipsChange([...tagChips, normalized]);
    return true;
  };

  const removeChip = (chip: string) => {
    onTagChipsChange(tagChips.filter((c) => c !== chip));
  };

  const pickTag = (tagId: string) => {
    addRecentKeyword(tagId); // 履歴に追加
    if (!tagChips.includes(tagId)) {
      onTagChipsChange([...tagChips, tagId]);
    }
    onKeywordChange('');
    setOpen(false);
  };

  const suggestDisabled = disabled || tagsLoading;

  return (
    <div className={styles.wrap} ref={wrapRef} data-testid="unified-search-field">
      <Search className={styles.searchIcon} size={18} />
      <div className={styles.fieldRow}>
        <div className={styles.inputArea}>
          <div className={styles.chipRow} data-testid="search-tag-chips">
            {tagChips.map((chip) => (
              <span key={chip} className={styles.chip} data-testid="search-tag-chip">
                {tagLabelById.get(chip) ?? chip}
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={`タグ ${tagLabelById.get(chip) ?? chip} を削除`}
                  onClick={() => removeChip(chip)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            id={inputId}
            type="text"
            className={styles.input}
            placeholder="タイトル、説明文、作成者、タグでクイズを検索..."
            value={keyword}
            disabled={disabled}
            autoComplete="off"
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              onKeywordChange(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && open && suggestions.length > 0) {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
                return;
              }
              if (e.key === 'ArrowUp' && open && suggestions.length > 0) {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                const trimmed = keyword.trim();
                if (open && suggestions.length > 0) {
                  pickTag(suggestions[highlight].id);
                } else if (tryAddChip(keyword)) {
                  onKeywordChange('');
                } else if (trimmed) {
                  addRecentKeyword(trimmed); // キーワードを履歴に追加
                  setOpen(false);
                }
                return;
              }
              if (e.key === ' ') {
                if (tryAddChip(keyword)) {
                  e.preventDefault();
                  onKeywordChange('');
                }
              }
              if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
        </div>
      </div>
      {showClear && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={onClearAll}
          aria-label="クリア"
          data-testid="search-clear-btn"
        >
          <X size={18} />
        </button>
      )}

      {open && !keyword.trim() && tagChips.length === 0 && (
        <div className={styles.smartSuggest} data-testid="search-smart-suggest" role="listbox">
          {recentKeywords.length > 0 && (
            <div data-testid="recent-keywords-section" className={styles.section}>
              <div className={styles.sectionTitle}>最近の検索</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {recentKeywords.map((word) => (
                  <li
                    key={word}
                    role="option"
                    className={styles.option}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addRecentKeyword(word);
                      const isTag = tagLabelById.has(word) || tags.some((t) => t.id === word);
                      if (isTag) {
                        pickTag(word);
                      } else {
                        onKeywordChange(word);
                        setOpen(false);
                      }
                    }}
                  >
                    {tagLabelById.get(word) ?? word}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!errorWeekly && (
            <>
              <div data-testid="weekly-top-tags-section" className={styles.section}>
                <div className={styles.sectionTitle}>今週の人気タグ</div>
                {loadingWeekly ? (
                  <div className={styles.loading}>読み込み中...</div>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {weeklyTags.map((tagId) => (
                      <li
                        key={tagId}
                        role="option"
                        className={styles.option}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addRecentKeyword(tagId);
                          pickTag(tagId);
                        }}
                      >
                        <span className={styles.optionKind}>タグ</span>
                        {tagLabelById.get(tagId) ?? tagId}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div data-testid="weekly-top-keywords-section" className={styles.section}>
                <div className={styles.sectionTitle}>今週の人気キーワード</div>
                {loadingWeekly ? (
                  <div className={styles.loading}>読み込み中...</div>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {weeklyKeywords.map((word) => (
                      <li
                        key={word}
                        role="option"
                        className={styles.option}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addRecentKeyword(word);
                          onKeywordChange(word);
                          setOpen(false);
                        }}
                      >
                        {word}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {open && keyword.trim().length > 0 && !suggestDisabled && suggestions.length > 0 && (
        <ul className={styles.list} role="listbox">
          {suggestions.map((item, i) => (
            <li
              key={item.id}
              role="option"
              aria-selected={i === highlight}
              className={`${styles.option} ${i === highlight ? styles.optionActive : ''}`}
              data-testid={`search-suggest-tag-${item.id}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pickTag(item.id);
              }}
            >
              <span className={styles.optionKind}>タグ</span>
              {item.tagName ?? item.id}
            </li>
          ))}
        </ul>
      )}
      {open && keyword.trim().length > 0 && tagsError && (
        <p className={styles.errorHint} role="alert">
          {tagsError}
        </p>
      )}
    </div>
  );
}
