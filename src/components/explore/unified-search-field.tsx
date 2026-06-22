'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { SearchOutlined, CloseOutlined } from '@mui/icons-material';
import { filterTagSuggestions } from '@/lib/filter-tag-suggestions';
import { normalizeTag } from '@/services/quiz-validation';
import type { TagMetadata } from '@/types';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useWeeklyTopSearch } from '@/hooks/useWeeklyTrends';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

const suggestPanelClass =
  'absolute z-30 top-[calc(100%+4px)] left-0 right-0 max-h-60 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md';

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
  const { keywords: weeklyKeywords, loading: loadingWeekly, error: errorWeekly } = useWeeklyTopSearch();

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
    addRecentKeyword(normalized);
    onTagChipsChange([...tagChips, normalized]);
    return true;
  };

  const removeChip = (chip: string) => {
    onTagChipsChange(tagChips.filter((c) => c !== chip));
  };

  const pickTag = (tagId: string) => {
    addRecentKeyword(tagId);
    if (!tagChips.includes(tagId)) {
      onTagChipsChange([...tagChips, tagId]);
    }
    onKeywordChange('');
    setOpen(false);
  };

  const suggestDisabled = disabled || tagsLoading;

  return (
    <div className="relative flex flex-1 items-stretch" ref={wrapRef} data-testid="unified-search-field">
      <SearchOutlined className="pointer-events-none absolute left-4 top-1/2 z-10 size-[18px] -translate-y-1/2 text-muted-foreground" />
      <div className="flex min-h-12 w-full items-center rounded-lg border border-input bg-background py-1.5 pr-12 pl-11 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <div className="flex flex-wrap gap-1.5" data-testid="search-tag-chips">
            {tagChips.map((chip) => (
              <Badge key={chip} variant="secondary" className="gap-1 py-0.5 pr-1 pl-2 text-xs" data-testid="search-tag-chip">
                {tagLabelById.get(chip) ?? chip}
                <button
                  type="button"
                  className="inline-flex rounded-full p-0.5 hover:bg-muted"
                  aria-label={`タグ ${tagLabelById.get(chip) ?? chip} を削除`}
                  onClick={() => removeChip(chip)}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <Input
            id={inputId}
            type="text"
            className="h-8 min-w-[120px] flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
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
                  addRecentKeyword(trimmed);
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
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
          onClick={onClearAll}
          aria-label="クリア"
          data-testid="search-clear-btn"
        >
          <CloseOutlined sx={{ fontSize: 18 }} />
        </Button>
      )}

      {open && !keyword.trim() && tagChips.length === 0 && (
        <div className={cn(suggestPanelClass, 'max-h-80')} data-testid="search-smart-suggest" role="listbox">
          {recentKeywords.length > 0 && (
            <div data-testid="recent-keywords-section" className="py-1 not-last:border-b not-last:border-border">
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">最近の検索</div>
              <ul className="m-0 list-none p-0">
                {recentKeywords.map((word) => (
                  <li
                    key={word}
                    role="option"
                    className="cursor-pointer px-3 py-2.5 text-sm hover:bg-muted"
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
            <div data-testid="weekly-top-keywords-section" className="py-1">
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">今週の人気キーワード</div>
              {loadingWeekly ? (
                <div className="px-3 py-2.5 text-sm text-muted-foreground">読み込み中...</div>
              ) : (
                <ul className="m-0 list-none p-0">
                  {weeklyKeywords.map((word) => (
                    <li
                      key={word}
                      role="option"
                      className="cursor-pointer px-3 py-2.5 text-sm hover:bg-muted"
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
          )}
        </div>
      )}

      {open && keyword.trim().length > 0 && !suggestDisabled && suggestions.length > 0 && (
        <ul className={suggestPanelClass} role="listbox">
          {suggestions.map((item, i) => (
            <li
              key={item.id}
              role="option"
              aria-selected={i === highlight}
              className={cn(
                'cursor-pointer px-3 py-2.5 text-sm',
                i === highlight && 'bg-muted'
              )}
              data-testid={`search-suggest-tag-${item.id}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pickTag(item.id);
              }}
            >
              <span className="mr-1.5 text-xs text-muted-foreground">タグ</span>
              {item.tagName ?? item.id}
            </li>
          ))}
        </ul>
      )}
      {open && keyword.trim().length > 0 && tagsError && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {tagsError}
        </p>
      )}
    </div>
  );
}
