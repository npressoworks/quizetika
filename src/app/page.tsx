'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import styles from './page.module.css';
import { toggleBookmark, getBookmarkedQuizIds } from '@/services/bookmark';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { useActiveTags } from '@/hooks/useActiveTags';
import { useHomeQuizFeed } from '@/hooks/useHomeQuizFeed';
import { usePlayedQuizIds } from '@/hooks/usePlayedQuizIds';
import { ExploreAccordionsPanel } from '@/components/explore/explore-accordions-panel';
import { ExploreSearchSection } from '@/components/explore/explore-search-section';
import { QuizCard } from '@/components/quiz/quiz-card';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import {
  DEFAULT_HOME_FEED_FILTERS,
  type HomeFeedFilters,
} from '@/lib/home-feed-filters';
import { applyPlayStatusFilter } from '@/lib/apply-play-status-filter';
import type { QuizFormat } from '@/lib/quiz-format';

export default function Home() {
  const router = useRouter();
  const { user, firebaseUser, loading: authLoading } = useAuth();
  const { genres, loading: genresLoading, error: genresError, refetch } =
    useActiveGenres();
  const {
    tags: activeTags,
    loading: tagsLoading,
    error: tagsError,
    tagLabelById,
  } = useActiveTags();

  const [activeTab, setActiveTab] = useState<'latest' | 'popular' | 'trending' | 'timeline'>(
    'latest'
  );
  const [filters, setFilters] = useState<HomeFeedFilters>(DEFAULT_HOME_FEED_FILTERS);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [playStatus, setPlayStatus] = useState<'all' | 'unplayed' | 'played'>('all');

  const patchFilters = (patch: Partial<HomeFeedFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleSearchClearAll = () => {
    setFilters(DEFAULT_HOME_FEED_FILTERS);
  };

  const handleGenreSelect = (genreId: string) => {
    patchFilters({ genreId });
  };

  const handleFormatSelect = (format: QuizFormat | '') => {
    patchFilters({ format });
  };

  const { quizzes, loading: feedLoading, error: feedError } = useHomeQuizFeed(
    activeTab,
    user?.id,
    filters
  );
  const { playedQuizIds } = usePlayedQuizIds(user?.id);

  const displayQuizzes = useMemo(
    () => applyPlayStatusFilter(quizzes, playStatus, playedQuizIds),
    [quizzes, playStatus, playedQuizIds]
  );

  useEffect(() => {
    async function loadBookmarks() {
      if (authLoading) return;
      const uid = firebaseUser?.uid;
      if (uid && user) {
        try {
          const ids = await getBookmarkedQuizIds(uid);
          setBookmarkedIds(new Set(ids));
        } catch (e) {
          console.error('[Home] ブックマーク取得エラー:', e);
        }
      } else {
        setBookmarkedIds(new Set());
        setPlayStatus('all');
      }
    }
    loadBookmarks();
  }, [user, firebaseUser, authLoading]);

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
      console.error('[Home] ブックマーク切り替え失敗:', error);
    }
  };

  const handleCardClick = (quizId: string) => {
    router.push(`/quiz/${quizId}`);
  };

  return (
    <div className={styles.container}>
      <ExploreSearchSection
        filters={filters}
        onFiltersChange={patchFilters}
        onClearAll={handleSearchClearAll}
        tags={activeTags}
        tagsLoading={tagsLoading}
        tagsError={tagsError}
        tagLabelById={tagLabelById}
        playStatus={playStatus}
        onPlayStatusChange={setPlayStatus}
        playStatusDisabled={!user}
        showQuickSearch
      />

      <ExploreAccordionsPanel
        genres={genres}
        genresLoading={genresLoading}
        genresError={genresError}
        onGenresRetry={refetch}
        selectedGenreId={filters.genreId}
        onGenreSelect={handleGenreSelect}
        selectedFormat={filters.format}
        onFormatSelect={handleFormatSelect}
      />

      <section className={styles.mainContent}>
        <div className={styles.tabBar}>
          <div
            className={`${styles.tab} ${activeTab === 'latest' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('latest')}
          >
            新着順
          </div>
          <div
            className={`${styles.tab} ${activeTab === 'popular' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('popular')}
          >
            人気順
          </div>
          <div
            className={`${styles.tab} ${activeTab === 'trending' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('trending')}
          >
            トレンド
          </div>
          {user && (
            <div
              className={`${styles.tab} ${activeTab === 'timeline' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              フォローTL
            </div>
          )}
        </div>

        {feedError && (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--color-danger, #c62828)' }}>
            {feedError}
          </div>
        )}

        {feedLoading ? (
          <div className={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : displayQuizzes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            該当するクイズが見つかりませんでした。
          </div>
        ) : (
          <div className={styles.grid}>
            {displayQuizzes.map((quiz) => (
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
