'use client';

import React, { useState, useEffect } from 'react';
import { QuizCard } from '@/components/quiz/quiz-card';
import { AdsenseInlineAd } from '@/components/ads/adsense-inline-ad';
import { InfiniteScrollLoader } from '@/components/ui/infinite-scroll-loader';
import { Input } from '@/components/ui/input';
import { useAds } from '@/hooks/useAds';
import { getQuizzesByAuthor, getQuizzesByAuthorPage } from '@/services/quiz';
import type { Quiz } from '@/types';

interface ProfileQuizzesPanelProps {
  authorId: string;
  isMyProfile: boolean;
  bookmarkedIds: Set<string>;
  onBookmarkToggle: (quizId: string) => Promise<void>;
  onPlayClick: (quizId: string) => void;
  onQuizzesCountChange?: (count: number) => void;
}

export function ProfileQuizzesPanel({
  authorId,
  isMyProfile,
  bookmarkedIds,
  onBookmarkToggle,
  onPlayClick,
  onQuizzesCountChange,
}: ProfileQuizzesPanelProps) {
  const { showAds } = useAds();

  const [searchQuery, setSearchQuery] = useState('');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // 検索用の一括キャッシュ
  const [allQuizzesForSearch, setAllQuizzesForSearch] = useState<Quiz[] | null>(null);
  const [searchOffset, setSearchOffset] = useState(20);

  // 検索クエリ空時の段階フェッチの初期化
  useEffect(() => {
    async function initPageLoad() {
      if (searchQuery.trim() !== '') return;

      try {
        setLoading(true);
        const result = await getQuizzesByAuthorPage(authorId, {
          limit: 20,
          includeUnpublished: isMyProfile,
        });
        setQuizzes(result.items);
        setNextCursor(result.nextCursor);
        setHasMore(result.nextCursor !== null);
        onQuizzesCountChange?.(result.items.length);
      } catch (err) {
        console.error('Failed to load author quizzes page:', err);
      } finally {
        setLoading(false);
      }
    }

    initPageLoad();
  }, [authorId, isMyProfile, searchQuery]);

  // 検索クエリ入力時の処理
  useEffect(() => {
    async function handleSearch() {
      const q = searchQuery.toLowerCase().trim();
      if (q === '') return;

      try {
        setLoading(true);
        let allQuizzes = allQuizzesForSearch;
        if (!allQuizzes) {
          allQuizzes = await getQuizzesByAuthor(authorId, isMyProfile);
          setAllQuizzesForSearch(allQuizzes);
        }

        const filtered = allQuizzes.filter(quiz =>
          quiz.title.toLowerCase().includes(q) ||
          (quiz.description || '').toLowerCase().includes(q) ||
          quiz.genre.toLowerCase().includes(q) ||
          quiz.tags.some(tag => tag.toLowerCase().includes(q))
        );

        setQuizzes(filtered.slice(0, 20));
        setSearchOffset(20);
        setHasMore(filtered.length > 20);
        onQuizzesCountChange?.(filtered.length);
      } catch (err) {
        console.error('Failed to search author quizzes:', err);
      } finally {
        setLoading(false);
      }
    }

    handleSearch();
  }, [authorId, isMyProfile, searchQuery, allQuizzesForSearch]);

  const loadMore = async () => {
    if (loading || loadingMore || !hasMore) return;

    const q = searchQuery.toLowerCase().trim();
    if (q === '') {
      // 段階フェッチの追加ロード
      try {
        setLoadingMore(true);
        const result = await getQuizzesByAuthorPage(authorId, {
          limit: 20,
          cursor: nextCursor,
          includeUnpublished: isMyProfile,
        });
        const newQuizzes = [...quizzes, ...result.items];
        setQuizzes(newQuizzes);
        setNextCursor(result.nextCursor);
        setHasMore(result.nextCursor !== null);
        onQuizzesCountChange?.(newQuizzes.length);
      } catch (err) {
        console.error('Failed to load more author quizzes:', err);
      } finally {
        setLoadingMore(false);
      }
    } else {
      // 検索モード（インメモリ）の追加ロード
      if (!allQuizzesForSearch) return;
      const filtered = allQuizzesForSearch.filter(quiz =>
        quiz.title.toLowerCase().includes(q) ||
        (quiz.description || '').toLowerCase().includes(q) ||
        quiz.genre.toLowerCase().includes(q) ||
        quiz.tags.some(tag => tag.toLowerCase().includes(q))
      );

      const nextOffset = searchOffset + 20;
      setQuizzes(filtered.slice(0, nextOffset));
      setSearchOffset(nextOffset);
      setHasMore(filtered.length > nextOffset);
      onQuizzesCountChange?.(filtered.length);
    }
  };

  const displayedItems = quizzes.reduce<React.ReactNode[]>((acc, quiz, index) => {
    acc.push(
      <QuizCard
        key={quiz.id}
        quiz={quiz}
        isBookmarked={bookmarkedIds.has(quiz.id)}
        onBookmarkToggle={onBookmarkToggle}
        onPlayClick={onPlayClick}
      />
    );

    if (showAds && (index + 1) % 10 === 0) {
      acc.push(
        <AdsenseInlineAd
          key={`ad-${quiz.id}`}
          adSlot="inline-profile-slot"
        />
      );
    }
    return acc;
  }, []);

  return (
    <div id="profile-quizzes-container" className="flex flex-col gap-6">
      {/* 検索入力欄 */}
      <div className="max-w-md">
        <Input
          type="text"
          placeholder="クイズを検索（タイトル、説明、ジャンル、タグ）"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="profile-quiz-search-input"
          className="w-full"
        />
      </div>

      {loading && quizzes.length === 0 ? (
        <InfiniteScrollLoader
          hasMore={true}
          loading={true}
          onLoadMore={() => {}}
          testIdPrefix="profile-feed"
        />
      ) : quizzes.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          該当するクイズが見つかりませんでした。
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
            {displayedItems}
          </div>

          <InfiniteScrollLoader
            hasMore={hasMore}
            loading={loadingMore}
            onLoadMore={loadMore}
            testIdPrefix="profile-feed"
          />
        </>
      )}
    </div>
  );
}
