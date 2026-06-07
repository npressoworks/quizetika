import React, { Suspense } from 'react';
import { listActiveGenres, listActiveTags, getQuizzesByGenre } from '@/services/quiz';
import { GenreExploreClient } from './genre-explore-client';
import { GridSkeleton } from '@/components/ui/grid-skeleton';
import styles from '../../page.module.css';

interface PageProps {
  params: Promise<{ genreName: string }>;
}

export default async function GenreExplorePage({ params }: PageProps) {
  const resolvedParams = await params;
  const genreId = decodeURIComponent(resolvedParams.genreName);

  return (
    <div className={styles.container}>
      <Suspense fallback={<GridSkeleton data-testid="explore-list-skeleton" />}>
        <GenreExploreDataLoader genreId={genreId} />
      </Suspense>
    </div>
  );
}

interface LoaderProps {
  genreId: string;
}

async function GenreExploreDataLoader({ genreId }: LoaderProps) {
  try {
    const [genres, tags, quizzes] = await Promise.all([
      listActiveGenres(),
      listActiveTags(),
      getQuizzesByGenre(genreId, 20, 'latest'),
    ]);

    // FirestoreのTimestampオブジェクトなど、非プレーンオブジェクトをシリアライズ可能にする
    const plainGenres = JSON.parse(JSON.stringify(genres));
    const plainTags = JSON.parse(JSON.stringify(tags));
    const plainQuizzes = JSON.parse(JSON.stringify(quizzes));

    return (
      <GenreExploreClient
        genreId={genreId}
        initialGenres={plainGenres}
        initialTags={plainTags}
        initialQuizzes={plainQuizzes}
      />
    );
  } catch (e) {
    console.error('[GenreExploreDataLoader] 初期データ取得失敗:', e);
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger, #c62828)' }}>
        データの読み込みに失敗しました。ページを再読み込みしてください。
      </div>
    );
  }
}
