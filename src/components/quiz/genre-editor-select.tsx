'use client';

import React, { useMemo } from 'react';
import type { GenreMetadata } from '@/types';

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
  const hasOrphanValue = useMemo(() => {
    if (!value.trim()) return false;
    return !genres.some((g) => g.id === value);
  }, [genres, value]);

  const orphanLabel = value;

  const selectDisabled = loading || !!error || (genres.length === 0 && !error && !loading);

  return (
    <div data-testid="genre-editor-select-wrap">
      {error && (
        <p
          className="genre-editor-select-error"
          role="alert"
          style={{ color: 'var(--color-danger, #c62828)', fontSize: '0.85rem', marginBottom: 8 }}
        >
          {error}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                marginLeft: 8,
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-light)',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              再試行
            </button>
          )}
        </p>
      )}

      {!error && !loading && genres.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 8 }}>
          選択可能なジャンルがありません。新しいジャンルを申請してください。
        </p>
      )}

      <select
        data-testid="genre-editor-select"
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={selectDisabled}
        required
        aria-busy={loading}
      >
        <option value="" disabled>
          {loading ? 'ジャンルを読み込み中...' : 'ジャンルを選択してください'}
        </option>
        {hasOrphanValue && (
          <option value={value}>{orphanLabel}（マスタ未登録・要確認）</option>
        )}
        {genres.map((g) => (
          <option key={g.id} value={g.id}>
            {g.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
