'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QuizCard } from '@/components/quiz/quiz-card';
import { toggleBookmark, isBookmarked } from '@/services/bookmark';
import { useAuth } from '@/context/auth-context';
import { Quiz } from '@/types';
import styles from './result.module.css';

interface RecommendListClientProps {
  recommendQuizzes: Quiz[];
}

export function RecommendListClient({ recommendQuizzes }: RecommendListClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [bookmarkedQuizIds, setBookmarkedQuizIds] = useState<Set<string>>(new Set());

  // 初期ロード時におすすめクイズのブックマーク状態を確認
  useEffect(() => {
    if (!user || recommendQuizzes.length === 0) return;

    async function loadBookmarks() {
      const bookmarkedIds: string[] = [];
      await Promise.all(
        recommendQuizzes.map(async (q) => {
          try {
            const bookmarked = await isBookmarked(user!.id, q.id);
            if (bookmarked) {
              bookmarkedIds.push(q.id);
            }
          } catch (err) {
            console.error(`Failed to load bookmark for recommend ${q.id}:`, err);
          }
        })
      );
      setBookmarkedQuizIds(new Set(bookmarkedIds));
    }
    loadBookmarks();
  }, [user, recommendQuizzes]);

  const handleRecommendBookmarkToggle = async (targetQuizId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      const isCurrentlyBookmarked = bookmarkedQuizIds.has(targetQuizId);
      await toggleBookmark(user.id, targetQuizId, 'quiz');
      setBookmarkedQuizIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyBookmarked) {
          next.delete(targetQuizId);
        } else {
          next.add(targetQuizId);
        }
        return next;
      });
    } catch (e) {
      console.error('[RecommendListClient] ブックマークトグル失敗:', e);
    }
  };

  const handleRecommendPlayClick = (targetQuizId: string) => {
    router.push(`/quiz/${targetQuizId}`);
  };

  return (
    <div className={styles.recommendGrid}>
      {recommendQuizzes.map((q) => (
        <QuizCard
          key={q.id}
          quiz={q}
          href={`/quiz/${q.id}`}
          isBookmarked={bookmarkedQuizIds.has(q.id)}
          onBookmarkToggle={handleRecommendBookmarkToggle}
          onPlayClick={handleRecommendPlayClick}
        />
      ))}
    </div>
  );
}
