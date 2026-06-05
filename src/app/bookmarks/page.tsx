'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useBookmarkFeed } from '@/hooks/useBookmarkFeed';
import { BookmarksTabs } from '@/components/bookmark/bookmarks-tabs';
import { BookmarkQuizGrid } from '@/components/bookmark/bookmark-quiz-grid';
import { BookmarkListGrid } from '@/components/bookmark/bookmark-list-grid';
import { BookmarkQuestionList } from '@/components/bookmark/bookmark-question-list';
import styles from './bookmarks.module.css';
import cardStyles from '../page.module.css';

export default function BookmarksPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { feed, loading, activeTab, setActiveTab, removeBookmark } = useBookmarkFeed(user?.id);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleRemove = async (targetType: 'quiz' | 'list' | 'question', targetId: string) => {
    try {
      await removeBookmark(targetType, targetId);
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
      <Link
        href="/"
        className={cardStyles.backBtn}
        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={16} /> ホームに戻る
      </Link>

      <div className={styles.titleSection}>
        <h1 className={styles.title}>
          <Bookmark size={32} fill="#00ff66" style={{ color: '#00ff66' }} />
          お気に入りブックマーク一覧
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          クイズ・リスト・設問を種類ごとに管理できます。
        </p>
      </div>

      <BookmarksTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'quiz' && (
        <BookmarkQuizGrid
          quizzes={feed?.quizzes ?? []}
          onRemove={(id) => handleRemove('quiz', id)}
        />
      )}
      {activeTab === 'list' && (
        <BookmarkListGrid
          lists={feed?.lists ?? []}
          onRemove={(id) => handleRemove('list', id)}
        />
      )}
      {activeTab === 'question' && (
        <BookmarkQuestionList
          questions={feed?.questions ?? []}
          onRemove={(id) => handleRemove('question', id)}
        />
      )}
    </div>
  );
}
