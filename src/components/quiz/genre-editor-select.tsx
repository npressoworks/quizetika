'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { GenreMetadata } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ErrorOutlined } from '@mui/icons-material';

export interface GenreEditorSelectProps {
  value: string;
  onChange: (genreId: string) => void;
  genres: GenreMetadata[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  selectClassName?: string;
}

export function GenreEditorSelect({
  value,
  onChange,
  genres,
  loading,
  error,
  onRetry,
  selectClassName = '',
}: GenreEditorSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedGenre = useMemo(() => genres.find((g) => g.id === value), [genres, value]);

  const hasOrphanValue = useMemo(() => {
    if (!value.trim()) return false;
    return !genres.some((g) => g.id === value);
  }, [genres, value]);

  // value が外部から変わったら検索クエリを同期する
  useEffect(() => {
    if (selectedGenre) {
      setSearchQuery(selectedGenre.displayName);
    } else {
      setSearchQuery(value || '');
    }
  }, [value, selectedGenre]);

  // クリックアウトサイドでドロップダウンを閉じ、入力を復元する
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (selectedGenre) {
          setSearchQuery(selectedGenre.displayName);
        } else {
          setSearchQuery(value || '');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedGenre, value]);

  // フィルタリングされたジャンル候補
  const filteredGenres = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return genres;
    return genres.filter(
      (g) =>
        g.displayName.toLowerCase().includes(query) ||
        g.id.toLowerCase().includes(query)
    );
  }, [genres, searchQuery]);

  const handleSelect = (genreId: string) => {
    onChange(genreId);
    setIsOpen(false);
  };

  const selectDisabled = loading || !!error || (genres.length === 0 && !error && !loading);

  return (
    <div ref={containerRef} className="relative w-full" data-testid="genre-editor-select-wrap">
      {error && (
        <p
          className="genre-editor-select-error mb-2 text-sm text-destructive"
          role="alert"
        >
          {error}
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="ml-2 h-7 text-xs"
            >
              再試行
            </Button>
          )}
        </p>
      )}

      {!error && !loading && genres.length === 0 && (
        <p className="mb-2 text-sm text-muted-foreground">
          選択可能なジャンルがありません。新しいジャンルを申請してください。
        </p>
      )}

      <div className="relative">
        <input
          type="text"
          data-testid="genre-editor-search-input"
          className={cn(
            'w-full rounded-md border border-input bg-background px-4 py-3.5 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
            selectClassName
          )}
          placeholder={loading ? 'ジャンルを読み込み中...' : 'ジャンルを入力・検索...'}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (!selectDisabled) {
              setIsOpen(true);
            }
          }}
          disabled={selectDisabled}
          required
        />
        {hasOrphanValue && (
          <div className="mt-1 flex items-center gap-1.5 text-sm text-amber-500">
            <ErrorOutlined sx={{ fontSize: 16 }} />
            <span>{value}（マスタ未登録・要確認）</span>
          </div>
        )}
      </div>

      {isOpen && !selectDisabled && (
        <div
          data-testid="genre-editor-search-dropdown"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-input bg-background p-1 shadow-md"
        >
          {filteredGenres.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              一致するジャンルがありません
            </div>
          ) : (
            filteredGenres.map((g) => (
              <div
                key={g.id}
                data-testid={`genre-editor-search-option-${g.id}`}
                className={cn(
                  'cursor-pointer rounded-sm px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  value === g.id && 'bg-accent/50 font-medium'
                )}
                onMouseDown={(e) => {
                  // input の blur が先に動くのを防ぐ
                  e.preventDefault();
                }}
                onClick={() => handleSelect(g.id)}
              >
                {g.displayName}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
