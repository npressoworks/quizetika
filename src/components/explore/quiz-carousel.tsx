'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Quiz } from '@/types';
import { QuizCard } from '@/components/quiz/quiz-card';
import { useAuth } from '@/context/auth-context';
import { useAds } from '@/hooks/useAds';
import { AdsenseInlineAd } from '@/components/ads/adsense-inline-ad';
import { toggleBookmark, getBookmarkedQuizIds } from '@/services/bookmark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  HorizontalScrollCarousel,
  carouselErrorClass,
  carouselStatusClass,
  quizCarouselSlotClass,
} from './horizontal-scroll-carousel';

export interface QuizCarouselProps {
  quizzes: Quiz[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  genreLabelById?: Map<string, string>;
}

export function QuizCarousel({
  quizzes,
  loading,
  error,
  onRetry,
  emptyMessage = '表示できるクイズがありません。',
  genreLabelById,
}: QuizCarouselProps) {
  const router = useRouter();
  const { user, authUser, loading: authLoading } = useAuth();
  const { showAds } = useAds();
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    async function loadBookmarks() {
      if (authLoading) return;
      const uid = authUser?.uid;
      if (uid && user) {
        try {
          const ids = await getBookmarkedQuizIds(uid);
          setBookmarkedIds(new Set(ids));
        } catch (err) {
          console.error('[QuizCarousel] bookmark load failed:', err);
        }
      } else {
        setBookmarkedIds(new Set());
      }
    }
    loadBookmarks();
  }, [user, authUser, authLoading]);

  const handleBookmarkToggle = useCallback(
    async (quizId: string) => {
      if (!user) {
        router.push('/login');
        return;
      }
      try {
        const currentlyBookmarked = bookmarkedIds.has(quizId);
        await toggleBookmark(user.id, quizId, 'quiz');
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          if (currentlyBookmarked) next.delete(quizId);
          else next.add(quizId);
          return next;
        });
      } catch (err) {
        console.error('[QuizCarousel] bookmark toggle failed:', err);
      }
    },
    [user, bookmarkedIds, router]
  );

  const handlePlayClick = useCallback(
    (quizId: string) => {
      router.push(`/quiz/${quizId}`);
    },
    [router]
  );

  if (loading) {
    return <p className={carouselStatusClass}>クイズを読み込み中...</p>;
  }

  if (error) {
    return (
      <p className={cn(carouselStatusClass, carouselErrorClass)} role="alert">
        {error}
        {onRetry && (
          <Button type="button" variant="link" size="sm" className="ml-2 h-auto p-0" onClick={onRetry}>
            再試行
          </Button>
        )}
      </p>
    );
  }

  if (quizzes.length === 0) {
    return <p className={carouselStatusClass}>{emptyMessage}</p>;
  }

  return (
    <HorizontalScrollCarousel className="pt-3" data-testid="quiz-carousel">
      {quizzes.reduce<React.ReactNode[]>((acc, quiz, index) => {
        acc.push(
          <div key={quiz.id} className={quizCarouselSlotClass}>
            <QuizCard
              quiz={quiz}
              href={quiz.id ? `/quiz/${quiz.id}` : undefined}
              genreDisplayName={genreLabelById?.get(quiz.genre)}
              isBookmarked={bookmarkedIds.has(quiz.id ?? '')}
              onBookmarkToggle={handleBookmarkToggle}
              onPlayClick={handlePlayClick}
            />
          </div>
        );

        if (showAds && (index + 1) % 10 === 0) {
          acc.push(
            <div key={`ad-slot-${quiz.id}`} className={quizCarouselSlotClass}>
              <AdsenseInlineAd adSlot="inline-carousel-slot" />
            </div>
          );
        }
        return acc;
      }, [])}
    </HorizontalScrollCarousel>
  );
}
