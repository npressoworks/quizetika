import React from 'react';
import styles from './editor-skeleton.module.css';

interface EditorFormSkeletonProps {
  'data-testid'?: string;
}

export function EditorFormSkeleton({ 'data-testid': testId = 'quiz-editor-skeleton' }: EditorFormSkeletonProps) {
  return (
    <div className={styles.container} data-testid={testId}>
      <div className={`${styles.title} ${styles.pulse}`} />
      <div className={`${styles.subtitle} ${styles.pulse}`} />
      <div className={styles.card}>
        <div className={`${styles.field} ${styles.pulse}`} />
        <div className={`${styles.textarea} ${styles.pulse}`} />
        <div className={`${styles.field} ${styles.pulse}`} />
        <div className={`${styles.field} ${styles.pulse}`} />
      </div>
      <div className={styles.card}>
        <div className={`${styles.textarea} ${styles.pulse}`} />
      </div>
    </div>
  );
}
