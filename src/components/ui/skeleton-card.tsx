import React from 'react';
import styles from './skeleton-card.module.css';

export function SkeletonCard() {
  return (
    <div className={styles.skeletonCard} data-testid="skeleton-card">
      <div className={`${styles.thumbnail} ${styles.pulse}`} />
      <div className={styles.content}>
        <div className={`${styles.title} ${styles.pulse}`} />
        <div className={styles.meta}>
          <div className={`${styles.metaItem} ${styles.pulse}`} />
          <div className={`${styles.metaItem} ${styles.pulse}`} />
        </div>
        <div className={`${styles.footer} ${styles.pulse}`} />
      </div>
    </div>
  );
}
