'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowBackOutlined } from '@mui/icons-material';
import { toggleBookmark, isBookmarked } from '@/services/bookmark';
import { type QuizListSort } from '@/services/quiz';
import { useAuth } from '@/context/auth-context';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { useActiveTags } from '@/hooks/useActiveTags';
import { useExploreQuizFeed } from '@/hooks/useExploreQuizFeed';
import { usePlayedQuizIds } from '@/hooks/usePlayedQuizIds';
import { ExploreSortTabs } from '@/components/explore/explore-sort-tabs';
import { ExploreSearchSection } from '@/components/explore/explore-search-section';
import { QuizCard } from '@/components/quiz/quiz-card';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import {
  DEFAULT_HOME_FEED_FILTERS,
  type HomeFeedFilters,
} from '@/lib/home-feed-filters';
import { applyPlayStatusFilter } from '@/lib/apply-play-status-filter';
import {
  discoveryGridClass,
  discoveryPageContainerClass,
  exploreBackLinkClass,
  explorePageHeaderClass,
} from '@/lib/discovery-layout';
import type { GenreMetadata, TagMetadata, Quiz } from '@/types';

interface GenreExploreClientProps {
  genreId: string;
  initialGenres: GenreMetadata[];
  initialTags: TagMetadata[];
  initialQuizzes: Quiz[];
}

export function GenreExploreClient({
  genreId,
  initialGenres,
  initialTags,
  initialQuizzes,
}: GenreExploreClientProps) {
  const router = useRouter();
  const { user } = useAuth();

  const { genres, genreLabelById, loading: genresMetaLoading } = useActiveGenres(initialGenres);
  const {
    tags: activeTags,
    loading: tagsLoading,
    error: tagsError,
    tagLabelById,
  } = useActiveTags(initialTags);

  const [activeSort, setActiveSort] = useState<QuizListSort>('latest');
  const [filters, setFilters] = useState<HomeFeedFilters>(() => ({
    ...DEFAULT_HOME_FEED_FILTERS,
    genreId,
  }));
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [playStatus, setPlayStatus] = useState<'all' | 'unplayed' | 'played'>('all');

  useEffect(() => {
    setFilters((prev) => ({ ...prev, genreId }));
  }, [genreId]);

  const meta = useMemo(
    () => genres.find((g) => g.id === genreId) ?? null,
    [genres, genreId]
  );

  const headerTitle = meta?.displayName ?? genreId;

  const feedFilters = useMemo(
    () => ({ ...filters, genreId }),
    [filters, genreId]
  );

  const { quizzes, loading, error: feedError } = useExploreQuizFeed({
    mode: 'scoped',
    filters: feedFilters,
    lockedGenreId: genreId,
    activeSort,
    limit: 20,
    initialQuizzes,
  });
  const { playedQuizIds } = usePlayedQuizIds(user?.id);

  const displayQuizzes = useMemo(
    () => applyPlayStatusFilter(quizzes, playStatus, playedQuizIds),
    [quizzes, playStatus, playedQuizIds]
  );

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
      console.error('[GenreExplore] ブックマークエラー:', err);
    }
  };

  const patchFilters = (patch: Partial<HomeFeedFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch, genreId }));
  };

  const handleClearAll = () => {
    setFilters({ ...DEFAULT_HOME_FEED_FILTERS, genreId });
  };

  return (
    <div className={discoveryPageContainerClass} data-testid="genre-explore-page">
      <Link href="/" className={exploreBackLinkClass}>
        <ArrowBackOutlined sx={{ fontSize: 16 }} /> 戻る
      </Link>

      <div className={explorePageHeaderClass}>
        <h1
          className="flex items-center gap-3 text-3xl font-extrabold text-foreground"
          data-testid="genre-explore-title"
        >
          {meta?.iconImageUrl ? (
            <Image
              src={meta.iconImageUrl}
              alt=""
              width={36}
              height={36}
              unoptimized
            />
          ) : (
            <span aria-hidden>📚</span>
          )}
          {headerTitle}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {genresMetaLoading
            ? 'ジャンル情報を読み込み中...'
            : `ジャンル「${headerTitle}」の公開クイズ一覧`}
        </p>
      </div>

      <ExploreSearchSection
        filters={feedFilters}
        onFiltersChange={patchFilters}
        onClearAll={handleClearAll}
        lockedGenreId={genreId}
        tags={activeTags}
        tagsLoading={tagsLoading}
        tagsError={tagsError}
        tagLabelById={tagLabelById}
        playStatus={playStatus}
        onPlayStatusChange={setPlayStatus}
        playStatusDisabled={!user}
        showQuickSearch={false}
        testId="genre-explore-search"
      />

      <ExploreSortTabs activeSort={activeSort} onSortChange={setActiveSort} />

      {feedError && (
        <div className="py-4 text-center text-destructive">{feedError}</div>
      )}

      {loading ? (
        <div className={discoveryGridClass}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : displayQuizzes.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          該当するクイズがありませんでした。
        </div>
      ) : (
        <div className={discoveryGridClass}>
          {displayQuizzes.map((quiz) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
