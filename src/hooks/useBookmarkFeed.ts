'use client';

import { useCallback, useEffect, useState } from 'react';
import { getBookmarkFeed, toggleBookmark } from '@/services/bookmark';
import { BookmarkFeed } from '@/types';

export type BookmarkTab = 'quiz' | 'list' | 'question';

export function useBookmarkFeed(userId: string | undefined) {
  const [feed, setFeed] = useState<BookmarkFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<BookmarkTab>('quiz');

  useEffect(() => {
    if (!userId) {
      setFeed(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getBookmarkFeed(userId)
      .then((data) => {
        if (!cancelled) setFeed(data);
      })
      .catch((e) => {
        console.error('[useBookmarkFeed]', e);
        if (!cancelled) setFeed({ quizzes: [], lists: [], questions: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const removeBookmark = useCallback(
    async (targetType: 'quiz' | 'list' | 'question', targetId: string) => {
      if (!userId || !feed) return;
      await toggleBookmark(userId, targetId, targetType);
      setFeed((prev) => {
        if (!prev) return prev;
        if (targetType === 'quiz') {
          return { ...prev, quizzes: prev.quizzes.filter((q) => q.id !== targetId) };
        }
        if (targetType === 'list') {
          return { ...prev, lists: prev.lists.filter((l) => l.id !== targetId) };
        }
        return {
          ...prev,
          questions: prev.questions.filter((e) => e.question.id !== targetId),
        };
      });
    },
    [userId, feed]
  );

  return { feed, loading, activeTab, setActiveTab, removeBookmark };
}
