'use client';

import { useEffect, useState } from 'react';
import { fetchPlayedQuizIds } from '@/lib/played-quiz-ids-client';

export function usePlayedQuizIds(userId: string | undefined) {
  const [playedQuizIds, setPlayedQuizIds] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setPlayedQuizIds(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchPlayedQuizIds()
      .then((ids) => {
        if (!cancelled) setPlayedQuizIds(new Set(ids));
      })
      .catch((e) => {
        console.error('[usePlayedQuizIds]', e);
        if (!cancelled) setPlayedQuizIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { playedQuizIds, loading };
}
