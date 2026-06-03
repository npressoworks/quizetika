'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import styles from './page.module.css';
import { toggleBookmark, getBookmarkedQuizzes } from '@/services/bookmark';
import { Quiz } from '@/types';
import { SlidersHorizontal, Star } from 'lucide-react';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { useHomeQuizFeed } from '@/hooks/useHomeQuizFeed';
import { usePlayedQuizIds } from '@/hooks/usePlayedQuizIds';
import { GenreNav } from '@/components/explore/genre-nav';
import { GenreSearchField } from '@/components/explore/genre-search-field';
import {
  DEFAULT_HOME_FEED_FILTERS,
  type HomeFeedFilters,
} from '@/lib/home-feed-filters';
import { applyPlayStatusFilter } from '@/lib/apply-play-status-filter';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { genres, loading: genresLoading, error: genresError, genreLabelById, refetch } =
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

  const resolveGenreLabel = (quiz: Quiz) => {
    const key = quiz.canonicalGenreId ?? quiz.genre;
    return genreLabelById.get(key) ?? quiz.genre;
  };

  useEffect(() => {
    async function loadBookmarks() {
      if (user) {
        try {
          const list = await getBookmarkedQuizzes(user.id);
          setBookmarkedIds(new Set(list.map((q) => q.id)));
        } catch (e) {
          console.error('[Home] ブックマーク取得エラー:', e);
        }
      } else {
        setBookmarkedIds(new Set());
        setPlayStatus('all');
      }
    }
    loadBookmarks();
  }, [user]);

  const handleBookmarkClick = async (e: React.MouseEvent, quizId: string) => {
    e.stopPropagation();
    e.preventDefault();

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

  const loading = feedLoading;

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <h1>知的探求を、もっとクリエイティブに。</h1>
        <p>
          「quizeum」は、知識の共有と水平思考を楽しむクイズ投稿SNSです。
          AIが真相を判定する『ウミガメのスープ』や各種クイズを今すぐプレイ！
        </p>
      </section>

      <GenreNav
        genres={genres}
        loading={genresLoading}
        error={genresError}
        onRetry={refetch}
      />

      <section className={styles.searchSection}>
        <div className={styles.searchBar}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="タイトル、説明文、作成者、タグでクイズを検索..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            クイズを読み込み中...
          </div>
        ) : displayQuizzes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            該当するクイズが見つかりませんでした。
          </div>
        ) : (
          <div className={styles.grid}>
            {displayQuizzes.map((quiz) => (
              <article
                key={quiz.id}
                data-testid="quiz-card"
                className={styles.card}
                onClick={() => handleCardClick(quiz.id)}
                style={{ cursor: 'pointer' }}
              >
                {quiz.reviewBadge && !quiz.isReviewMasked && (
                  <div className={styles.badgeContainer}>
                    <span className={styles.badge}>🏅 {quiz.reviewBadge}</span>
                  </div>
                )}

                <div className={styles.cardThumbnail}>
                  {quiz.thumbnailUrl ? (
                    <Image
                      src={quiz.thumbnailUrl}
                      alt={quiz.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 300px"
                    />
                  ) : (
                    <span className={styles.thumbnailFallback}>💡</span>
                  )}
                </div>

                <div className={styles.cardContent}>
                  <div className={styles.cardGenre}>{resolveGenreLabel(quiz)}</div>
                  <h3 className={styles.cardTitle}>{quiz.title}</h3>

                  <div className={styles.cardDifficulty}>
                    <span>難易度 {quiz.difficulty}</span>
                    <div className={styles.difficultyBar}>
                      <div
                        className={styles.difficultyFill}
                        style={{ width: `${quiz.difficulty * 10}%` }}
                      />
                    </div>
                  </div>

                  <div className={styles.cardStats}>
                    <div className={styles.statsLeft}>
                      <span>⏱️ {quiz.questionCount} 問</span>
                      <span>👤 {quiz.authorName}</span>
                    </div>
                    <button
                      type="button"
                      className={`${styles.bookmarkBtn} ${bookmarkedIds.has(quiz.id) ? styles.bookmarked : ''}`}
                      onClick={(e) => handleBookmarkClick(e, quiz.id)}
                      title="ブックマーク"
                    >
                      <Star
                        size={18}
                        color={bookmarkedIds.has(quiz.id) ? '#ff007f' : 'var(--text-muted)'}
                        fill={bookmarkedIds.has(quiz.id) ? '#ff007f' : 'none'}
                      />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
