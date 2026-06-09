'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useMyQuizPool } from '@/hooks/useMyQuizPool';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { MyQuizSourcePanel } from '@/components/my-quiz/my-quiz-source-panel';
import { MyQuizFilters } from '@/components/my-quiz/my-quiz-filters';
import { MyQuizPlaySettings } from '@/components/my-quiz/my-quiz-play-settings';
import { MyQuizPreviewBar } from '@/components/my-quiz/my-quiz-preview-bar';
import myQuizStyles from '@/components/my-quiz/my-quiz.module.css';
import styles from './my-quiz.module.css';

export function MyQuizClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { genres } = useActiveGenres();
  const pool = useMyQuizPool(user?.id);

  const genreOptions = useMemo(
    () => genres.map((g) => ({ id: g.id, label: g.displayName })),
    [genres]
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=%2Fmy-quiz');
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return <div data-testid="my-quiz-skeleton">読み込み中...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div data-testid="my-quiz-page">
      <header>
        <h1 className={styles.title}>マイクイズ</h1>
        <p className={styles.desc}>
          自作・ブックマークから問題を集め、フィルタして連続プレイできます。
        </p>
      </header>

      {pool.loading ? (
        <div data-testid="my-quiz-skeleton">問題プールを読み込み中...</div>
      ) : pool.error ? (
        <div>
          <p>{pool.error}</p>
          <button type="button" className="btn btn-secondary" onClick={() => pool.refetch()}>
            再試行
          </button>
        </div>
      ) : (
        <div className={myQuizStyles.stack}>
          <MyQuizSourcePanel flags={pool.sourceFlags} onChange={pool.setSourceFlags} />
          <MyQuizFilters
            filters={pool.filters}
            onChange={pool.setFilters}
            genreOptions={genreOptions}
          />
          <MyQuizPlaySettings
            settings={pool.playSettings}
            filteredCount={pool.filteredCount}
            effectivePlayCount={pool.effectivePlayCount}
            onChange={pool.setPlaySettings}
          />
          <MyQuizPreviewBar
            filteredCount={pool.filteredCount}
            effectivePlayCount={pool.effectivePlayCount}
            hasAnySource={pool.hasAnySource}
            buildEntries={pool.buildEntries}
          />
        </div>
      )}
    </div>
  );
}
