'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowBackOutlined, LocalOfferOutlined } from '@mui/icons-material';
import { getQuizzesByTag, type QuizListSort } from '@/services/quiz';
import { toggleBookmark, isBookmarked } from '@/services/bookmark';
import { useAuth } from '@/context/auth-context';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { ExploreSortTabs } from '@/components/explore/explore-sort-tabs';
import { QuizCard } from '@/components/quiz/quiz-card';
import { useAds } from '@/hooks/useAds';
import { AdsenseInlineAd } from '@/components/ads/adsense-inline-ad';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import {
  discoveryGridClass,
  discoveryPageContainerClass,
  exploreBackLinkClass,
  explorePageHeaderClass,
} from '@/lib/discovery-layout';
import { Quiz, GenreMetadata } from '@/types';

interface TagExploreClientProps {
  tagName: string;
  initialQuizzes: Quiz[];
  initialGenres: GenreMetadata[];
}

export function TagExploreClient({ tagName, initialQuizzes, initialGenres }: TagExploreClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showAds } = useAds();

  const { genreLabelById } = useActiveGenres(initialGenres);

  const [activeSort, setActiveSort] = useState<QuizListSort>('latest');
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [loading, setLoading] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [isFirstRender, setIsFirstRender] = useState(true);

  useEffect(() => {
    if (isFirstRender) {
      setIsFirstRender(false);
      return;
    }

    let cancelled = false;

    async function loadQuizzes() {
      setLoading(true);
      try {
        const fetched = await getQuizzesByTag(tagName, 20, activeSort);
        if (cancelled) return;
        setQuizzes(fetched);
      } catch (e) {
        console.error('[TagExploreClient] 読み込み失敗:', e);
        if (!cancelled) setQuizzes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadQuizzes();
    return () => {
      cancelled = true;
    };
  }, [tagName, activeSort]);

  useEffect(() => {
    let cancelled = false;

    async function loadBookmarks() {
      if (user && quizzes.length > 0) {
        const ids = new Set<string>();
        for (const q of quizzes) {
          const isB = await isBookmarked(user.id, q.id);
          if (isB) ids.add(q.id);
        }
        if (!cancelled) setBookmarkedIds(ids);
      } else if (!cancelled) {
        setBookmarkedIds(new Set());
      }
    }

    loadBookmarks();
    return () => {
      cancelled = true;
    };
  }, [user, quizzes]);

  const handleBookmarkToggle = async (quizId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      const isAdded = await toggleBookmark(user.id, quizId, 'quiz');
      const next = new Set(bookmarkedIds);
      if (isAdded) next.add(quizId);
      else next.delete(quizId);
      setBookmarkedIds(next);
    } catch (err) {
      console.error('[TagExplore] ブックマークエラー:', err);
    }
  };

  return (
    <div className={discoveryPageContainerClass} data-testid="tag-explore-page">
      <Link href="/" className={exploreBackLinkClass}>
        <ArrowBackOutlined sx={{ fontSize: 16 }} /> 戻る
      </Link>

      <div className={explorePageHeaderClass}>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold text-foreground">
          <LocalOfferOutlined sx={{ fontSize: 28 }} className="text-primary" />
          #{tagName} のクイズ一覧
        </h1>
        <p className="mt-2 text-muted-foreground">
          タグ「{tagName}」に関連する公開クイズを表示しています。
        </p>
      </div>

      <ExploreSortTabs activeSort={activeSort} onSortChange={setActiveSort} />

      {loading ? (
        <div className={discoveryGridClass}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          該当するクイズがありませんでした。
        </div>
      ) : (
        <div className={discoveryGridClass}>
          {quizzes.reduce<React.ReactNode[]>((acc, quiz, index) => {
            acc.push(
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                href={`/quiz/${quiz.id}`}
                genreDisplayName={
                  genreLabelById.get(quiz.canonicalGenreId ?? quiz.genre) ?? quiz.genre
                }
                isBookmarked={bookmarkedIds.has(quiz.id)}
                onBookmarkToggle={handleBookmarkToggle}
                onPlayClick={(id) => router.push(`/quiz/${id}`)}
              />
            );

            if (showAds && (index + 1) % 10 === 0) {
              acc.push(
                <AdsenseInlineAd
                  key={`ad-${quiz.id}`}
                  adSlot="inline-tag-slot"
                />
              );
            }
            return acc;
          }, [])}
        </div>
      )}
    </div>
  );
}
