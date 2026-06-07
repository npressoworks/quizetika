import React, { Suspense } from 'react';
import { listActiveGenres } from '@/services/quiz';
import { ReviewClient } from './review-client';
import { ReviewSkeleton } from '@/components/ui/review-skeleton';
import styles from './review.module.css';

export default async function ReviewPage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<ReviewSkeleton data-testid="review-skeleton" />}>
        <ReviewDataLoader />
      </Suspense>
    </div>
  );
}

async function ReviewDataLoader() {
  try {
    const genres = await listActiveGenres();
    const plainGenres = JSON.parse(JSON.stringify(genres));

    return (
      <ReviewClient initialGenres={plainGenres} />
    );
  } catch (e) {
    console.error('[ReviewDataLoader] 初期データ取得失敗:', e);
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger, #c62828)' }}>
        データの読み込みに失敗しました。ページを再読み込みしてください。
      </div>
    );
  }
}
