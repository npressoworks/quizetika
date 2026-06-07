'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Tag } from 'lucide-react';
import { getQuizzesByTag, type QuizListSort } from '@/services/quiz';
import { toggleBookmark, isBookmarked } from '@/services/bookmark';
import { useAuth } from '@/context/auth-context';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { ExploreSortTabs } from '@/components/explore/explore-sort-tabs';
import { QuizCard } from '@/components/quiz/quiz-card';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Quiz, GenreMetadata } from '@/types';
import styles from '../../page.module.css';

interface TagExploreClientProps {
  tagName: string;
  initialQuizzes: Quiz[];
  initialGenres: GenreMetadata[];
}

export function TagExploreClient({ tagName, initialQuizzes, initialGenres }: TagExploreClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  
  // 初期データを hook に渡す
  const { genreLabelById } = useActiveGenres(initialGenres);

  const [activeSort, setActiveSort] = useState<QuizListSort>('latest');
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [loading, setLoading] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [isFirstRender, setIsFirstRender] = useState(true);

  // ソート切り替え時のフェッチ
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

  // ブックマーク情報の非同期読み込み
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
    <div className={styles.container} data-testid="tag-explore-page">
      <Link
        href="/"
        className={styles.backBtn}
        style={{
          alignSelf: 'flex-start',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-muted)',
        }}
      >
        <ArrowLeft size={16} /> 戻る
      </Link>

      <div
        style={{
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '20px',
          marginBottom: '10px',
        }}
      >
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Tag size={28} style={{ color: 'var(--color-primary)' }} />
          #{tagName} のクイズ一覧
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          タグ「{tagName}」に関連する公開クイズを表示しています。
        </p>
      </div>

      <ExploreSortTabs activeSort={activeSort} onSortChange={setActiveSort} />

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          該当するクイズがありませんでした。
        </div>
      ) : (
        <div className={styles.grid}>
          {quizzes.map((quiz) => (
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
