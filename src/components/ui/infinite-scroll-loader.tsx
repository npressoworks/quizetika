'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from './button';
import { GridSkeleton } from './grid-skeleton';
import { useIntersectionLoadMore } from '@/hooks/useIntersectionLoadMore';

interface InfiniteScrollLoaderProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  testIdPrefix?: string;
}

export function InfiniteScrollLoader({
  hasMore,
  loading,
  onLoadMore,
  testIdPrefix = 'infinite-scroll',
}: InfiniteScrollLoaderProps) {
  const [isInfinite, setIsInfinite] = useState(false);
  const clickedLoadMoreRef = useRef(false);

  const handleLoadMore = () => {
    clickedLoadMoreRef.current = true;
    setIsInfinite(true);
    onLoadMore();
  };

  const handleIntersect = () => {
    clickedLoadMoreRef.current = true;
    onLoadMore();
  };

  const sentinelRef = useIntersectionLoadMore({
    onIntersect: handleIntersect,
    enabled: hasMore && !loading && isInfinite,
  });

  useEffect(() => {
    if (loading) {
      if (!clickedLoadMoreRef.current) {
        // 外部（検索クエリ変更など）による新規ロード開始なので、無限スクロール状態をリセット
        setIsInfinite(false);
      }
    } else {
      // ロード完了時にクリックフラグをリセット
      clickedLoadMoreRef.current = false;
    }
  }, [loading]);

  if (!hasMore) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center py-6 w-full gap-4">
      {!isInfinite && (
        <Button
          variant="outline"
          onClick={handleLoadMore}
          disabled={loading}
          data-testid={`${testIdPrefix}-load-more-button`}
          className="px-8 py-2 text-sm"
        >
          {loading ? '読み込み中...' : 'もっと見る'}
        </Button>
      )}
      {isInfinite && (
        <div
          ref={sentinelRef}
          className="h-px w-full"
          data-testid={`${testIdPrefix}-sentinel`}
        />
      )}
      {loading && (
        <GridSkeleton
          count={3}
          data-testid={`${testIdPrefix}-skeleton`}
        />
      )}
    </div>
  );
}
