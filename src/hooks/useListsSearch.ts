'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  searchLists,
  DEFAULT_LIST_SEARCH_LIMIT,
  type ListSearchVisibility,
} from '@/services/quiz-list';
import type { QuizList } from '@/types';

export type ListsVisibility = ListSearchVisibility;

const KEYWORD_DEBOUNCE_MS = 300;

export function useListsSearch(userId: string | undefined, visibility: ListsVisibility) {
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [lists, setLists] = useState<QuizList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), KEYWORD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keyword]);

  const fetchLists = useCallback(async () => {
    if (visibility === 'private' && !userId) {
      setLists([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await searchLists({
        visibility,
        keyword: debouncedKeyword,
        authorId: visibility === 'private' ? userId : undefined,
        limit: DEFAULT_LIST_SEARCH_LIMIT,
      });
      setLists(result);
    } catch (e) {
      console.error('[useListsSearch]', e);
      setError(e instanceof Error ? e.message : 'リストの取得に失敗しました');
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [visibility, userId, debouncedKeyword]);

  useEffect(() => {
    void fetchLists();
  }, [fetchLists]);

  return {
    keyword,
    setKeyword,
    lists,
    loading,
    error,
    retry: fetchLists,
  };
}
