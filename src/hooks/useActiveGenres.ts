'use client';

import { useEffect, useMemo, useState } from 'react';
import { listActiveGenres } from '@/services/quiz';
import type { GenreMetadata } from '@/types';

export interface UseActiveGenresResult {
  genres: GenreMetadata[];
  loading: boolean;
  error: string | null;
  genreLabelById: Map<string, string>;
  refetch: () => void;
}

export function useActiveGenres(initialGenres?: GenreMetadata[]): UseActiveGenresResult {
  const [genres, setGenres] = useState<GenreMetadata[]>(initialGenres || []);
  const [loading, setLoading] = useState(!initialGenres);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // 初期データが存在し、かつリフレッシュ要求(tick > 0)がない場合はフェッチをスキップ
    if (initialGenres && tick === 0) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listActiveGenres()
      .then((list) => {
        if (cancelled) return;
        const sorted = [...list].sort((a, b) =>
          a.displayName.localeCompare(b.displayName, 'ja')
        );
        setGenres(sorted);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[useActiveGenres]', e);
        setGenres([]);
        setError('ジャンル一覧の取得に失敗しました。しばらくしてから再試行してください。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick, initialGenres]);

  const genreLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of genres) {
      map.set(g.id, g.displayName);
    }
    return map;
  }, [genres]);

  return {
    genres,
    loading,
    error,
    genreLabelById,
    refetch: () => setTick((t) => t + 1),
  };
}
