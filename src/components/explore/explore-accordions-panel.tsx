'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { GenreMetadata } from '@/types';
import type { QuizFormat } from '@/lib/quiz-format';
import { getFormatLabel } from '@/lib/quiz-format-labels';
import { filterGenreSuggestions } from '@/lib/filter-genre-suggestions';
import { ExploreAccordion } from './explore-accordion';
import { GenreCarousel } from './genre-carousel';
import { FormatCarousel } from './format-carousel';
import { GenreSearchField } from './genre-search-field';
import styles from './explore-carousel.module.css';

export interface ExploreAccordionsPanelProps {
  genres: GenreMetadata[];
  genresLoading: boolean;
  genresError: string | null;
  onGenresRetry?: () => void;
  selectedGenreId: string;
  onGenreSelect: (genreId: string) => void;
  selectedFormat: QuizFormat | '';
  onFormatSelect: (format: QuizFormat | '') => void;
}

export function ExploreAccordionsPanel({
  genres,
  genresLoading,
  genresError,
  onGenresRetry,
  selectedGenreId,
  onGenreSelect,
  selectedFormat,
  onFormatSelect,
}: ExploreAccordionsPanelProps) {
  const [genreOpen, setGenreOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [genreSearchQuery, setGenreSearchQuery] = useState('');

  const filteredGenres = useMemo(() => {
    const trimmed = genreSearchQuery.trim();
    if (!trimmed) return genres;
    return filterGenreSuggestions(genres, genreSearchQuery, genres.length);
  }, [genres, genreSearchQuery]);

  const selectedGenre = useMemo(() => {
    return genres.find((g) => g.id === selectedGenreId);
  }, [genres, selectedGenreId]);

  const handleGenreSelect = useCallback(
    (genreId: string) => {
      onGenreSelect(genreId);
      setGenreSearchQuery('');
    },
    [onGenreSelect]
  );

  return (
    <div className={styles.accordionsPanel}>
      <ExploreAccordion
        testId="explore-accordion-genre"
        title={selectedGenre ? `ジャンルで絞り込む：${selectedGenre.displayName}` : 'ジャンルで絞り込む'}
        open={genreOpen}
        onToggle={() => setGenreOpen((v) => !v)}
      >
        <div className={styles.genreSearchWrap} data-testid="genre-explore-search-field">
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
            genreSearchQuery.trim()
              ? '該当するジャンルがありません。'
              : undefined
          }
        />
      </ExploreAccordion>

      <ExploreAccordion
        testId="explore-accordion-format"
        title={selectedFormat ? `出題形式で絞り込む：${getFormatLabel(selectedFormat)}` : '出題形式で絞り込む'}
        open={formatOpen}
        onToggle={() => setFormatOpen((v) => !v)}
      >
        <FormatCarousel selectedFormat={selectedFormat} onSelect={onFormatSelect} />
      </ExploreAccordion>
    </div>
  );
}
