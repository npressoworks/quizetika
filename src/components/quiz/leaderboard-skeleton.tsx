import React from 'react';
import styles from './leaderboard-skeleton.module.css';

interface LeaderboardSkeletonProps {
  'data-testid'?: string;
}

export function LeaderboardSkeleton({ 'data-testid': testId = 'leaderboard-skeleton' }: LeaderboardSkeletonProps) {
  return (
    <div className={styles.leaderboardSection} data-testid={testId}>
      {/* タブバープレースホルダー */}
      <div className={styles.tabBar}>
        <div className={`${styles.tab} ${styles.pulse}`} />
        <div className={`${styles.tab} ${styles.pulse}`} />
      </div>

      {/* テーブル枠プレースホルダー */}
      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <div className={`${styles.headerCell} ${styles.pulse}`} style={{ width: '10%' }} />
          <div className={`${styles.headerCell} ${styles.pulse}`} style={{ width: '30%' }} />
          <div className={`${styles.headerCell} ${styles.pulse}`} style={{ width: '20%' }} />
          <div className={`${styles.headerCell} ${styles.pulse}`} style={{ width: '20%' }} />
          <div className={`${styles.headerCell} ${styles.pulse}`} style={{ width: '20%' }} />
        </div>
        
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.tableRow}>
            <div className={`${styles.cell} ${styles.pulse}`} style={{ width: '10%' }} />
            <div className={`${styles.cell} ${styles.pulse}`} style={{ width: '30%' }} />
            <div className={`${styles.cell} ${styles.pulse}`} style={{ width: '20%' }} />
            <div className={`${styles.cell} ${styles.pulse}`} style={{ width: '20%' }} />
            <div className={`${styles.cell} ${styles.pulse}`} style={{ width: '20%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
