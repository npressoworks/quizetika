'use client';

import { useEffect, useState } from 'react';
import {
  searchAuthorQuizzes,
  type SearchAuthorQuizzesParams,
} from '@/services/author-quiz-search';
import type { Quiz } from '@/types';

export function useAuthorQuizReferenceSearch(authorId: string | undefined) {
  const [keyword, setKeyword] = useState('');
  const [tag, setTag] = useState('');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorId) {
      setQuizzes([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: SearchAuthorQuizzesParams = {
      authorId,
      keyword: keyword.trim() || undefined,
      tag: tag.trim() || undefined,
      includeDrafts: true,
    };

    searchAuthorQuizzes(params)
      .then((result) => {
        if (!cancelled) setQuizzes(result);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '検索に失敗しました');
          setQuizzes([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authorId, keyword, tag]);

  return { keyword, setKeyword, tag, setTag, quizzes, loading, error };
}
