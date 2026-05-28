'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, Heart } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { getBookmarkedQuizzes, toggleBookmark } from '@/services/bookmark';
import { Quiz } from '@/types';
import styles from './bookmarks.module.css';
import cardStyles from '../page.module.css';

export default function BookmarksPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. ログイン保護
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // 2. ブックマーククイズ読み込み
  const loadBookmarkedQuizzes = async () => {
    if (!user) return;
    try {
      const list = await getBookmarkedQuizzes(user.id);
      setQuizzes(list);
    } catch (e) {
      console.error('[Bookmarks] 読み込み失敗:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookmarkedQuizzes();
  }, [user]);

  // ブックマーク解除 (ダイレクトトグル)
  const handleRemoveBookmark = async (e: React.MouseEvent, quizId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) return;

    try {
      await toggleBookmark(user.id, quizId, 'quiz');
      // 一覧から削除
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
    } catch (err) {
      console.error('[Bookmarks] ブックマーク解除失敗:', err);
    }
  };

  if (authLoading || loading) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}>
        <p style={{ color: 'var(--text-muted)' }}>ブックマークを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Link href="/" className={cardStyles.backBtn} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
        <ArrowLeft size={16} /> ホームに戻る
      </Link>

      <div className={styles.titleSection}>
        <h1 className={styles.title}>
          <Star size={32} fill="#ff007f" style={{ color: '#ff007f' }} />
          お気に入りブックマーク一覧
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          あなたがブックマークしたクイズです。ここから直接プレイや解除が行えます。
        </p>
      </div>

      {quizzes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: 'var(--radius-lg)' }}>
          <Heart size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', opacity: 0.3 }} />
          <h2 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>ブックマークしたクイズがありません</h2>
          <p style={{ color: 'var(--text-muted)' }}>気になるクイズをお気に入り登録してコレクションしましょう！</p>
        </div>
      ) : (
        <div className={cardStyles.grid}>
          {quizzes.map((quiz) => (
            <Link key={quiz.id} href={`/quiz/${quiz.id}`} className={cardStyles.card}>
              {/* 評価バッジ表示 */}
              {quiz.reviewBadge && !quiz.isReviewMasked && (
                <div className={cardStyles.badgeContainer}>
                  <span className={cardStyles.badge}>🏅 {quiz.reviewBadge}</span>
                </div>
              )}
              
              <div className={cardStyles.cardThumbnail}>
                {quiz.thumbnailUrl ? (
                  <Image src={quiz.thumbnailUrl} alt={quiz.title} fill sizes="300px" />
                ) : (
                  <span className={cardStyles.thumbnailFallback}>💡</span>
                )}
              </div>
              <div className={cardStyles.cardContent}>
                <span className={cardStyles.cardGenre}>{quiz.genre}</span>
                <h3 className={cardStyles.cardTitle}>{quiz.title}</h3>
                <div className={cardStyles.cardDifficulty}>
                  <span>難易度 {quiz.difficulty}</span>
                  <div className={cardStyles.difficultyBar}>
                    <div className={cardStyles.difficultyFill} style={{ width: `${quiz.difficulty * 10}%` }}></div>
                  </div>
                </div>
                <div className={cardStyles.cardStats}>
                  <div className={cardStyles.statsLeft}>
                    <span>⏱️ {quiz.questionCount} 問</span>
                  </div>
                  <button
                    className={`${cardStyles.bookmarkBtn} ${cardStyles.bookmarked}`}
                    onClick={(e) => handleRemoveBookmark(e, quiz.id)}
                    title="ブックマーク解除"
                  >
                    <Star size={18} fill="#ff007f" />
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
