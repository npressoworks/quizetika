'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useBookmarkFeed } from '@/hooks/useBookmarkFeed';
import { BookmarksTabs } from '@/components/bookmark/bookmarks-tabs';
import { BookmarkQuizGrid } from '@/components/bookmark/bookmark-quiz-grid';
import { BookmarkQuestionList } from '@/components/bookmark/bookmark-question-list';
import { BookmarksSkeleton } from '@/components/ui/bookmarks-skeleton';

export function BookmarksClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { feed, loading, activeTab, setActiveTab, removeBookmark } = useBookmarkFeed(user?.id);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/bookmarks');
    }
  }, [user, authLoading, router]);

  const handleRemove = async (targetType: 'quiz' | 'question', targetId: string) => {
    try {
      await removeBookmark(targetType, targetId);
    } catch (err) {
      console.error('[BookmarksClient] ブックマーク解除失敗:', err);
    }
  };

  if (authLoading || loading) {
    return <BookmarksSkeleton data-testid="bookmarks-skeleton" />;
  }

  if (!user) {
    return null;
  }

  return (
    <div data-testid="bookmarks-page-container">
      <BookmarksTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'quiz' && (
        <BookmarkQuizGrid
          quizzes={feed?.quizzes ?? []}
          onRemove={(id) => handleRemove('quiz', id)}
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
