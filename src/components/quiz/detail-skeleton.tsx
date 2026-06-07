import React from 'react';
import styles from './detail-skeleton.module.css';

interface DetailSkeletonProps {
  'data-testid'?: string;
}

export function DetailSkeleton({ 'data-testid': testId = 'quiz-detail-skeleton' }: DetailSkeletonProps) {
  return (
    <div className={styles.skeletonCard} data-testid={testId}>
      {/* ヘッダー・タイトル部分 */}
      <div className={styles.header}>
        <div className={`${styles.genre} ${styles.pulse}`} />
        <div className={`${styles.title} ${styles.pulse}`} />
      </div>

      {/* メタバッジ部分 */}
      <div className={styles.badges}>
        <div className={`${styles.badge} ${styles.pulse}`} />
        <div className={`${styles.badge} ${styles.pulse}`} />
        <div className={`${styles.badge} ${styles.pulse}`} />
      </div>

      {/* サムネイル画像プレースホルダー */}
      <div className={`${styles.thumbnail} ${styles.pulse}`} />

      {/* 作者情報部分 */}
      <div className={styles.authorSection}>
        <div className={`${styles.avatar} ${styles.pulse}`} />
        <div className={styles.authorInfo}>
          <div className={`${styles.lineShort} ${styles.pulse}`} />
          <div className={`${styles.lineMedium} ${styles.pulse}`} />
        </div>
      </div>

      {/* 説明文部分 */}
      <div className={styles.description}>
        <div className={`${styles.lineFull} ${styles.pulse}`} />
        <div className={`${styles.lineFull} ${styles.pulse}`} />
        <div className={`${styles.lineMedium} ${styles.pulse}`} />
      </div>
    </div>
  );
}
