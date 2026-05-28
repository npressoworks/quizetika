'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Star, Grid } from 'lucide-react';
import { getQuizzesByGenre } from '@/services/quiz';
import { toggleBookmark, isBookmarked } from '@/services/bookmark';
import { useAuth } from '@/context/auth-context';
import { Quiz } from '@/types';
import styles from '../../page.module.css';
import { Header } from '@/components/layout/header';

interface PageProps {
  params: Promise<{ genreName: string }>;
}

export default function GenreExplorePage({ params }: PageProps) {
  const { user } = useAuth();
  
  const resolvedParams = use(params);
  const genreName = decodeURIComponent(resolvedParams.genreName);

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadQuizzes() {
      try {
        const fetched = await getQuizzesByGenre(genreName, 20);
        setQuizzes(fetched);

        // ブックマーク判定
        if (user && fetched.length > 0) {
          const ids = new Set<string>();
          for (const q of fetched) {
            const isB = await isBookmarked(user.id, q.id);
            if (isB) ids.add(q.id);
          }
          setBookmarkedIds(ids);
        }
      } catch (e) {
        console.error('[GenreExplore] 読み込み失敗:', e);
      } finally {
        setLoading(false);
      }
    }
    loadQuizzes();
  }, [genreName, user]);

  const handleBookmarkToggle = async (e: React.MouseEvent, quizId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) return;
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

  return (
    <>
      <Header />
      <div className={styles.container}>
      <Link href="/" className={styles.backBtn} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
        <ArrowLeft size={16} /> 戻る
      </Link>

      <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '20px', marginBottom: '10px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Grid size={28} style={{ color: 'var(--color-accent)' }} />
          ジャンル: {genreName} のクイズ一覧
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          ジャンル「{genreName}」に属する公開クイズを表示しています。
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>読み込み中...</div>
      ) : quizzes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          該当するクイズがありませんでした。
        </div>
      ) : (
        <div className={styles.grid}>
          {quizzes.map((quiz) => (
            <Link key={quiz.id} href={`/quiz/${quiz.id}`} className={styles.card}>
              <div className={styles.cardThumbnail}>
                {quiz.thumbnailUrl ? (
                  <Image src={quiz.thumbnailUrl} alt={quiz.title} fill sizes="300px" />
                ) : (
                  <span className={styles.thumbnailFallback}>💡</span>
                )}
              </div>
              <div className={styles.cardContent}>
                <span className={styles.cardGenre}>{quiz.genre}</span>
                <h3 className={styles.cardTitle}>{quiz.title}</h3>
                <div className={styles.cardDifficulty}>
                  <span>難易度 {quiz.difficulty}</span>
                  <div className={styles.difficultyBar}>
                    <div className={styles.difficultyFill} style={{ width: `${quiz.difficulty * 10}%` }}></div>
                  </div>
                </div>
                <div className={styles.cardStats}>
                  <div className={styles.statsLeft}>
                    <span>⏱️ {quiz.questionCount} 問</span>
                  </div>
                  <button
                    className={`${styles.bookmarkBtn} ${bookmarkedIds.has(quiz.id) ? styles.bookmarked : ''}`}
                    onClick={(e) => handleBookmarkToggle(e, quiz.id)}
                  >
                    <Star size={18} fill={bookmarkedIds.has(quiz.id) ? '#ff007f' : 'none'} />
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
