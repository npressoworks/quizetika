'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import styles from './page.module.css';
import { toggleBookmark, getBookmarkedQuizIds } from '@/services/bookmark';
import { SlidersHorizontal, Search, X } from 'lucide-react';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { useHomeQuizFeed } from '@/hooks/useHomeQuizFeed';
import { usePlayedQuizIds } from '@/hooks/usePlayedQuizIds';
import { GenreNav } from '@/components/explore/genre-nav';
import { GenreSearchField } from '@/components/explore/genre-search-field';
import { QuizCard } from '@/components/quiz/quiz-card';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import {
  DEFAULT_HOME_FEED_FILTERS,
  type HomeFeedFilters,
} from '@/lib/home-feed-filters';
import { applyPlayStatusFilter } from '@/lib/apply-play-status-filter';

export default function Home() {
  const router = useRouter();
  const { user, firebaseUser, loading: authLoading } = useAuth();
  const { genres, loading: genresLoading, error: genresError, refetch } =
    useActiveGenres();

  const [activeTab, setActiveTab] = useState<'latest' | 'popular' | 'trending' | 'timeline'>(
    'latest'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [filterGenreId, setFilterGenreId] = useState('');
  const [difficultyMin, setDifficultyMin] = useState(DEFAULT_HOME_FEED_FILTERS.difficultyMin);
  const [difficultyMax, setDifficultyMax] = useState(DEFAULT_HOME_FEED_FILTERS.difficultyMax);
  const [minQuestions, setMinQuestions] = useState(DEFAULT_HOME_FEED_FILTERS.minQuestions);
  const [maxQuestions, setMaxQuestions] = useState(DEFAULT_HOME_FEED_FILTERS.maxQuestions);
  const [playStatus, setPlayStatus] = useState<'all' | 'unplayed' | 'played'>('all');

  const feedFilters: HomeFeedFilters = useMemo(
    () => ({
      genreId: filterGenreId,
      searchQuery,
      difficultyMin,
      difficultyMax,
      minQuestions,
      maxQuestions,
    }),
    [
      filterGenreId,
      searchQuery,
      difficultyMin,
      difficultyMax,
      minQuestions,
      maxQuestions,
    ]
  );

  const { quizzes, loading: feedLoading, error: feedError } = useHomeQuizFeed(
    activeTab,
    user?.id,
    feedFilters
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
      <section className={styles.searchSection}>
        <div className={styles.searchBar}>
          <div className={styles.searchFieldWrapper}>
            <Search className={styles.searchIcon} size={18} />
            <input
              type="text"
              placeholder="タイトル、説明文、作成者、タグでクイズを検索..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => setSearchQuery('')}
                aria-label="クリア"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <button
            type="button"
            className={styles.filterToggleBtn}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={18} />
            フィルター
          </button>
        </div>

        <div className={styles.quickSearch}>
          <span className={styles.quickSearchLabel}>クイック検索:</span>
          {['#ウミガメのスープ', '#JavaScript', '#雑学', '#難問', '#初心者向け'].map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles.quickChip}
              onClick={() => setSearchQuery(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className={styles.filterPanel}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>ジャンル</span>
              <GenreSearchField
                genres={genres}
                value={filterGenreId}
                onChange={setFilterGenreId}
                disabled={genresLoading || !!genresError}
              />
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>難易度範囲 (1 - 10)</span>
              <div className={styles.rangeInputs}>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className={styles.filterSelect}
                  value={difficultyMin}
                  onChange={(e) => setDifficultyMin(Number(e.target.value))}
                />
                <span>〜</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className={styles.filterSelect}
                  value={difficultyMax}
                  onChange={(e) => setDifficultyMax(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>問題数</span>
              <div className={styles.rangeInputs}>
                <input
                  type="number"
                  min="1"
                  className={styles.filterSelect}
                  value={minQuestions}
                  onChange={(e) => setMinQuestions(Number(e.target.value))}
                />
                <span>〜</span>
                <input
                  type="number"
                  min="1"
                  className={styles.filterSelect}
                  value={maxQuestions}
                  onChange={(e) => setMaxQuestions(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>プレイ状況</span>
              <select
                className={styles.filterSelect}
                value={playStatus}
                disabled={!user}
                title={!user ? 'ログインするとプレイ状況で絞り込めます' : undefined}
                onChange={(e) =>
                  setPlayStatus(e.target.value as 'all' | 'unplayed' | 'played')
                }
              >
                <option value="all">すべて表示</option>
                <option value="unplayed">未プレイのみ</option>
                <option value="played">プレイ済みのみ</option>
              </select>
              {!user && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  プレイ状況で絞り込むにはログインが必要です
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className={styles.heroMini}>
        <h2>知的探求を、もっとクリエイティブに。</h2>
        <p>クイズ投稿SNS「quizeum」で、知識と水平思考のウミガメスープに挑戦しよう。</p>
      </section>

      <GenreNav
        genres={genres}
        loading={genresLoading}
        error={genresError}
        onRetry={refetch}
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
