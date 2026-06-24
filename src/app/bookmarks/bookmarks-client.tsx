'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useBookmarkFeed } from '@/hooks/useBookmarkFeed';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { useActiveTags } from '@/hooks/useActiveTags';
import { BookmarksTabs } from '@/components/bookmark/bookmarks-tabs';
import { BookmarkSearchSection } from '@/components/bookmark/bookmark-search-section';
import { BookmarkQuizGrid } from '@/components/bookmark/bookmark-quiz-grid';
import { BookmarkQuestionList } from '@/components/bookmark/bookmark-question-list';
import { BookmarksSkeleton } from '@/components/ui/bookmarks-skeleton';
import { DEFAULT_MY_QUIZ_FILTER, hasActiveMyQuizFilters, type MyQuizFilterState } from '@/lib/my-quiz-filter';
import { filterBookmarkedQuizzes, filterBookmarkedQuestions } from '@/lib/bookmark-filter';

export function BookmarksClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { feed, loading, activeTab, setActiveTab, removeBookmark } = useBookmarkFeed(user?.id);

  const { genres, loading: genresLoading, error: genresError, refetch: refetchGenres, genreLabelById } =
    useActiveGenres();
  const { tags, loading: tagsLoading, error: tagsError, tagLabelById } = useActiveTags();

  const [filters, setFilters] = useState<MyQuizFilterState>(DEFAULT_MY_QUIZ_FILTER);

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

  const filteredQuizzes = useMemo(() => {
    return filterBookmarkedQuizzes(feed?.quizzes ?? [], filters);
  }, [feed?.quizzes, filters]);

  const filteredQuestions = useMemo(() => {
    return filterBookmarkedQuestions(feed?.questions ?? [], filters);
  }, [feed?.questions, filters]);

  const hasFilters = hasActiveMyQuizFilters(filters);

  if (authLoading || loading) {
    return <BookmarksSkeleton data-testid="bookmarks-skeleton" />;
  }

  if (!user) {
    return null;
  }

  return (
    <div data-testid="bookmarks-page-container">
      <BookmarksTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <BookmarkSearchSection
        filters={filters}
        onChange={setFilters}
        genres={genres}
        genresLoading={genresLoading}
        genresError={genresError}
        onGenresRetry={refetchGenres}
        genreLabelById={genreLabelById}
        tags={tags}
        tagsLoading={tagsLoading}
        tagsError={tagsError}
        tagLabelById={tagLabelById}
      />

      {activeTab === 'quiz' && (
        <BookmarkQuizGrid
          quizzes={filteredQuizzes}
          onRemove={(id) => handleRemove('quiz', id)}
          filtered={hasFilters}
        />
      )}
      {activeTab === 'question' && (
        <BookmarkQuestionList
          questions={filteredQuestions}
          onRemove={(id) => handleRemove('question', id)}
          filtered={hasFilters}
        />
      )}
    </div>
  );
}

