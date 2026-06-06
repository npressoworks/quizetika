import { useState, useEffect } from 'react';

export interface GenreWeeklyEntry {
  genreId: string;
  playCount: number;
}

export interface UseWeeklyTopGenresResult {
  genres: GenreWeeklyEntry[];
  loading: boolean;
  error: boolean;
}

export interface UseWeeklyTopSearchResult {
  keywords: string[];
  tags: string[];
  loading: boolean;
  error: boolean;
}

/**
 * 週間人気ジャンルTop5データを取得するカスタムフック
 */
export function useWeeklyTopGenres(): UseWeeklyTopGenresResult {
  const [genres, setGenres] = useState<GenreWeeklyEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    async function fetchWeeklyGenres() {
      try {
        setLoading(true);
        setError(false);

        const res = await fetch('/api/genres/weekly-top');
        if (!res.ok) {
          throw new Error(`API response status: ${res.status}`);
        }

        const data = await res.json();
        if (active) {
          setGenres(data.genres || []);
        }
      } catch (err) {
        console.error('Failed to fetch weekly top genres:', err);
        if (active) {
          setError(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchWeeklyGenres();

    return () => {
      active = false;
    };
  }, []);

  return { genres, loading, error };
}

/**
 * 週間人気検索ワード・タグTop5データを取得するカスタムフック
 */
export function useWeeklyTopSearch(): UseWeeklyTopSearchResult {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    async function fetchWeeklySearch() {
      try {
        setLoading(true);
        setError(false);

        const res = await fetch('/api/search/weekly-top');
        if (!res.ok) {
          throw new Error(`API response status: ${res.status}`);
        }

        const data = await res.json();
        if (active) {
          setKeywords(data.keywords || []);
          setTags(data.tags || []);
        }
      } catch (err) {
        console.error('Failed to fetch weekly top search:', err);
        if (active) {
          setError(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchWeeklySearch();

    return () => {
      active = false;
    };
  }, []);

  return { keywords, tags, loading, error };
}
