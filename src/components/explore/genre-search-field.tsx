'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { filterGenreSuggestions } from '@/lib/filter-genre-suggestions';
import type { GenreMetadata } from '@/types';
import styles from './genre-search-field.module.css';

export interface GenreSearchFieldProps {
  genres: GenreMetadata[];
  value: string;
  onChange: (genreId: string) => void;
  disabled?: boolean;
}

export function GenreSearchField({
  genres,
  value,
  onChange,
  disabled = false,
}: GenreSearchFieldProps) {
  const listId = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => genres.find((g) => g.id === value) ?? null,
    [genres, value]
  );

  useEffect(() => {
    if (selected) {
      setText(selected.displayName);
    } else if (!value) {
      setText('');
    }
  }, [selected, value]);

  const suggestions = useMemo(
    () => filterGenreSuggestions(genres, text),
    [genres, text]
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (genre: Pick<GenreMetadata, 'id' | 'displayName'>) => {
    onChange(genre.id);
    setText(genre.displayName);
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setText('');
    setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef} data-testid="genre-search-field">
      <label htmlFor={listId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        ジャンルで絞り込み
      </label>
      <input
        id={listId}
        type="text"
        className={styles.input}
        placeholder="ジャンル名で検索..."
        value={text}
        disabled={disabled || genres.length === 0}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setHighlight(0);
          setOpen(true);
          if (!e.target.value.trim()) {
            onChange('');
          }
        }}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(suggestions[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className={styles.list} role="listbox">
          {suggestions.map((g, i) => (
            <li
              key={g.id}
              role="option"
              aria-selected={i === highlight}
              className={`${styles.option} ${i === highlight ? styles.optionActive : ''}`}
              data-testid={`genre-suggest-${g.id}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(g);
              }}
            >
              {g.displayName}
            </li>
          ))}
        </ul>
      )}
      {value && (
        <button type="button" className={styles.clearBtn} onClick={clear}>
          ジャンル条件をクリア
        </button>
      )}
      <p className={styles.hint}>一覧が多い場合は名前の一部を入力して候補から選べます</p>
    </div>
  );
}
