'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { toggleBookmark, getBookmarkedQuizIds } from '@/services/bookmark';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { useActiveTags } from '@/hooks/useActiveTags';
import { useExploreQuizFeed } from '@/hooks/useExploreQuizFeed';
import { InfiniteScrollLoader } from '@/components/ui/infinite-scroll-loader';
import { usePlayedQuizIds } from '@/hooks/usePlayedQuizIds';
import { useSearchUrlState } from '@/hooks/useSearchUrlState';
import { ExploreSearchSection } from '@/components/explore/explore-search-section';
import {
  ActiveFilterChips,
  type FilterChipKey,
} from '@/components/explore/active-filter-chips';
import { QuizCard } from '@/components/quiz/quiz-card';
import { useAds } from '@/hooks/useAds';
import { AdsenseInlineAd } from '@/components/ads/adsense-inline-ad';
import { GridSkeleton } from '@/components/ui/grid-skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_HOME_FEED_FILTERS } from '@/lib/home-feed-filters';
import { applyPlayStatusFilter } from '@/lib/apply-play-status-filter';
import { MIN_VISIBLE_AFTER_PLAY_FILTER } from '@/lib/feed-visible-threshold';
import type { QuizFormat } from '@/lib/quiz-format';
import type { GenreMetadata, TagMetadata, Quiz } from '@/types';

export interface SearchClientProps {
  initialGenres?: GenreMetadata[];
  initialTags?: TagMetadata[];
  initialQuizzes?: Quiz[];
}

export function SearchClient({
  initialGenres,
  initialTags,
  initialQuizzes,
}: SearchClientProps = {}) {
  const router = useRouter();
  const { user, authUser, loading: authLoading } = useAuth();
  const { showAds } = useAds();

  const {
    tab: activeTab,
    filters,
    playStatus,
    openFilters,
    setTab,
    patchFilters,
    setPlayStatus,
    clearAll,
  } = useSearchUrlState();


  const { genres, loading: genresLoading, error: genresError, refetch, genreLabelById } =
    useActiveGenres(initialGenres);

  const {
    tags: activeTags,
    loading: tagsLoading,
    error: tagsError,
    tagLabelById,
  } = useActiveTags(initialTags);

  const [bookmarkedIds, setBookmarkedIds] = React.useState<Set<string>>(new Set());

  const handleGenreSelect = (genreId: string) => {
    patchFilters({ genreId });
  };

  const handleFormatSelect = (format: QuizFormat | '') => {
    patchFilters({ format });
  };

  const handleFilterChipRemove = (key: FilterChipKey, value?: string) => {
    switch (key) {
      case 'genre':
        patchFilters({ genreId: '' });
        break;
      case 'format':
        patchFilters({ format: '' });
        break;
      case 'difficulty':
        patchFilters({
          difficultyMin: DEFAULT_HOME_FEED_FILTERS.difficultyMin,
          difficultyMax: DEFAULT_HOME_FEED_FILTERS.difficultyMax,
        });
        break;
      case 'questionCount':
        patchFilters({
          minQuestions: DEFAULT_HOME_FEED_FILTERS.minQuestions,
          maxQuestions: DEFAULT_HOME_FEED_FILTERS.maxQuestions,
        });
        break;
      case 'keyword':
        patchFilters({ searchQuery: '' });
        break;
      case 'tag':
        patchFilters({
          tagChips: filters.tagChips.filter((chip) => chip !== value),
        });
        break;
      case 'playStatus':
        setPlayStatus('all');
        break;
      default:
        break;
    }
  };

  const {
    quizzes,
    loading: feedLoading,
    loadingMore,
    error: feedError,
    hasMore,
    loadMore,
  } = useExploreQuizFeed({
    mode: 'home',
    activeTab,
    userId: user?.id,
    filters,
    initialQuizzes,
  });

  const { playedQuizIds } = usePlayedQuizIds(user?.id);

  const displayQuizzes = useMemo(
    () => applyPlayStatusFilter(quizzes, playStatus, playedQuizIds),
    [quizzes, playStatus, playedQuizIds]
  );


  const autoLoadGuardRef = useRef<string | null>(null);

  useEffect(() => {
    const guardKey = `${playStatus}:${quizzes.length}:${hasMore}`;
    if (
      playStatus !== 'all' &&
      displayQuizzes.length < MIN_VISIBLE_AFTER_PLAY_FILTER &&
      hasMore &&
      !feedLoading &&
      !loadingMore &&
      autoLoadGuardRef.current !== guardKey
    ) {
      autoLoadGuardRef.current = guardKey;
      loadMore();
    }
  }, [
    displayQuizzes.length,
    feedLoading,
    hasMore,
    loadMore,
    loadingMore,
    playStatus,
    quizzes.length,
  ]);

  useEffect(() => {
    async function loadBookmarks() {
      if (authLoading) return;
      const uid = authUser?.uid;
      if (uid && user) {
        try {
          const ids = await getBookmarkedQuizIds(uid);
          setBookmarkedIds(new Set(ids));
        } catch (e) {
          console.error('[SearchClient] ブックマーク取得エラー:', e);
        }
      } else {
        setBookmarkedIds(new Set());
        if (playStatus !== 'all') {
          setPlayStatus('all');
        }
      }
    }
    loadBookmarks();
  }, [user, authUser, authLoading, playStatus, setPlayStatus]);

  const handleBookmarkToggle = async (quizId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }

    try {
      const isAdded = await toggleBookmark(user.id, quizId, 'quiz');
      const nextBookmarks = new Set(bookmarkedIds);
      if (isAdded) {
        nextBookmarks.add(quizId);
      } else {
        nextBookmarks.delete(quizId);
      }
      setBookmarkedIds(nextBookmarks);
    } catch (error) {
      console.error('[SearchClient] ブックマーク切り替え失敗:', error);
    }
  };

  const handleCardClick = (quizId: string) => {
    router.push(`/quiz/${quizId}`);
  };

  return (
    <div data-testid="search-page">
      <ExploreSearchSection
        filters={filters}
        onFiltersChange={patchFilters}
        onClearAll={clearAll}
        tags={activeTags}
        tagsLoading={tagsLoading}
        tagsError={tagsError}
        tagLabelById={tagLabelById}
        playStatus={playStatus}
        onPlayStatusChange={setPlayStatus}
        playStatusDisabled={!user}
        showQuickSearch
        showExploreCarousels
        stickySearchBarTestId="search-search-bar-sticky"
        initialOpenFilters={openFilters}
        genres={genres}
        genresLoading={genresLoading}
        genresError={genresError}
        onGenresRetry={refetch}
        selectedGenreId={filters.genreId}
        onGenreSelect={handleGenreSelect}
        selectedFormat={filters.format}
        onFormatSelect={handleFormatSelect}
        activeFilterChipsSlot={
          <ActiveFilterChips
            filters={filters}
            playStatus={playStatus}
            tagLabelById={tagLabelById}
            genreLabelById={genreLabelById}
            onRemove={handleFilterChipRemove}
            onClearAll={clearAll}
          />
        }
      />

      <section className="mt-6 flex flex-col gap-6">
        <Tabs value={activeTab} onValueChange={(value) => setTab(value as typeof activeTab)}>
          <TabsList variant="line" className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="latest" className="rounded-none px-2 py-3 data-active:bg-transparent">
              新着順
            </TabsTrigger>
            <TabsTrigger value="popular" className="rounded-none px-2 py-3 data-active:bg-transparent">
              人気順
            </TabsTrigger>
            <TabsTrigger value="trending" className="rounded-none px-2 py-3 data-active:bg-transparent">
              トレンド
            </TabsTrigger>
            {user && (
              <TabsTrigger value="timeline" className="rounded-none px-2 py-3 data-active:bg-transparent">
                フォローTL
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {feedError && (
          <div className="py-4 text-center text-destructive">{feedError}</div>
        )}

        {feedLoading ? (
          <GridSkeleton data-testid="search-feed-skeleton" />
        ) : displayQuizzes.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            該当するクイズが見つかりませんでした。
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
              {displayQuizzes.reduce<React.ReactNode[]>((acc, quiz, index) => {
                acc.push(
                  <QuizCard
                    key={quiz.id}
                    quiz={quiz}
                    genreDisplayName={
                      genres.find((g) => g.id === quiz.genre || g.id === quiz.canonicalGenreId)
                        ?.displayName
                    }
                    isBookmarked={bookmarkedIds.has(quiz.id)}
                    onBookmarkToggle={handleBookmarkToggle}
                    onPlayClick={handleCardClick}
                  />
                );

                if (showAds && (index + 1) % 10 === 0) {
                  acc.push(
                    <AdsenseInlineAd
                      key={`ad-${quiz.id}`}
                      adSlot="inline-search-slot"
                    />
                  );
                }
                return acc;
              }, [])}
            </div>
            <InfiniteScrollLoader
              hasMore={hasMore}
              loading={loadingMore}
              onLoadMore={loadMore}
              testIdPrefix="search-feed"
            />
          </>
        )}
      </section>
    </div>
  );
}
