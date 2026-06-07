import React, { Suspense } from 'react';
import { listActiveGenres, listActiveTags, getLatestQuizzes } from '@/services/quiz';
import { HomeClient } from './home-client';
import { GridSkeleton } from '@/components/ui/grid-skeleton';
import styles from './page.module.css';

export default async function Home() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<GridSkeleton data-testid="home-feed-skeleton" />}>
        <HomeDataLoader />
      </Suspense>
    </div>
  );
}

async function HomeDataLoader() {
  try {
    const [genres, tags, quizzes] = await Promise.all([
      listActiveGenres(),
      listActiveTags(),
      getLatestQuizzes(10),
    ]);

    // FirestoreのTimestampオブジェクトなど、非プレーンオブジェクトをシリアライズ可能にする
    const plainGenres = JSON.parse(JSON.stringify(genres));
    const plainTags = JSON.parse(JSON.stringify(tags));
    const plainQuizzes = JSON.parse(JSON.stringify(quizzes));

    return (
      <HomeClient
        initialGenres={plainGenres}
        initialTags={plainTags}
        initialQuizzes={plainQuizzes}
      />
    );
  } catch (e) {
    console.error('[HomeDataLoader] 初期データ取得失敗:', e);
    // エラー時のフォールバック表示
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger, #c62828)' }}>
        データの読み込みに失敗しました。ページを再読み込みしてください。
      </div>
    );
  }
}
