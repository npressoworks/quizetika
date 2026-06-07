import React from 'react';
import styles from './list-skeleton.module.css';

interface ListEditorSkeletonProps {
  'data-testid'?: string;
}

export function ListEditorSkeleton({ 'data-testid': testId = 'list-editor-skeleton' }: ListEditorSkeletonProps) {
  return (
    <div className={styles.container} data-testid={testId}>
      <div className={styles.header}>
        <div className={`${styles.backBtn} ${styles.pulse}`} />
        <div className={`${styles.title} ${styles.pulse}`} />
      </div>
      <div className={`${styles.subtitle} ${styles.pulse}`} />
      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.pulse}`} />
        <div className={`${styles.card} ${styles.pulse}`} />
      </div>
    </div>
  );
}
