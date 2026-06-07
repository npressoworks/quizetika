'use client';

import { useEffect, useMemo, useState } from 'react';
import { listActiveTags } from '@/services/quiz';
import type { TagMetadata } from '@/types';

export interface UseActiveTagsResult {
  tags: TagMetadata[];
  loading: boolean;
  error: string | null;
  tagLabelById: Map<string, string>;
  refetch: () => void;
}

export function useActiveTags(initialTags?: TagMetadata[]): UseActiveTagsResult {
  const [tags, setTags] = useState<TagMetadata[]>(initialTags || []);
  const [loading, setLoading] = useState(!initialTags);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // 初期データが存在し、かつリフレッシュ要求(tick > 0)がない場合はフェッチをスキップ
    if (initialTags && tick === 0) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listActiveTags()
      .then((list) => {
        if (cancelled) return;
        setTags(list);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[useActiveTags]', e);
        setTags([]);
        setError('タグ一覧の取得に失敗しました。しばらくしてから再試行してください。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick, initialTags]);

  const tagLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tags) {
      map.set(t.id, t.tagName ?? t.id);
    }
    return map;
  }, [tags]);

  return {
    tags,
    loading,
    error,
    tagLabelById,
    refetch: () => setTick((t) => t + 1),
  };
}
