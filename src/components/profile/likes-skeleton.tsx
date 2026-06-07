import React from 'react';
import styles from './connections-skeleton.module.css';

export function LikesSkeleton() {
  return (
    <div className={styles.container} data-testid="likes-skeleton">
      <div className={styles.card}>
        <div className={`${styles.title} ${styles.pulse}`} />
        <div className={styles.tabs}>
          <div className={`${styles.tab} ${styles.pulse}`} />
          <div className={`${styles.tab} ${styles.pulse}`} />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.row}>
            <div className={`${styles.avatar} ${styles.pulse}`} />
            <div>
              <div className={`${styles.lineName} ${styles.pulse}`} />
              <div className={`${styles.lineBio} ${styles.pulse}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
