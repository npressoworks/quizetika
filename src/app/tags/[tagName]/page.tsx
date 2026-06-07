import React, { Suspense } from 'react';
import { listActiveGenres, getQuizzesByTag } from '@/services/quiz';
import { TagExploreClient } from './tag-explore-client';
import { GridSkeleton } from '@/components/ui/grid-skeleton';
import styles from '../../page.module.css';

interface PageProps {
  params: Promise<{ tagName: string }>;
}

export default async function TagExplorePage({ params }: PageProps) {
  const resolvedParams = await params;
  const tagName = decodeURIComponent(resolvedParams.tagName);

  return (
    <div className={styles.container}>
      <Suspense fallback={<GridSkeleton data-testid="explore-list-skeleton" />}>
        <TagExploreDataLoader tagName={tagName} />
      </Suspense>
    </div>
  );
}

interface LoaderProps {
  tagName: string;
}

async function TagExploreDataLoader({ tagName }: LoaderProps) {
  try {
    const [genres, quizzes] = await Promise.all([
      listActiveGenres(),
      getQuizzesByTag(tagName, 20, 'latest'),
    ]);

    // FirestoreのTimestampオブジェクトなど、非プレーンオブジェクトをシリアライズ可能にする
    const plainGenres = JSON.parse(JSON.stringify(genres));
    const plainQuizzes = JSON.parse(JSON.stringify(quizzes));

    return (
      <TagExploreClient
        tagName={tagName}
        initialQuizzes={plainQuizzes}
        initialGenres={plainGenres}
      />
    );
  } catch (e) {
    console.error('[TagExploreDataLoader] 初期データ取得失敗:', e);
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger, #c62828)' }}>
        データの読み込みに失敗しました。ページを再読み込みしてください。
      </div>
    );
  }
}
