import React from 'react';
import styles from './profile-skeleton.module.css';

interface ProfileDetailSkeletonProps {
  'data-testid'?: string;
}

export function ProfileEditSkeleton() {
  return (
    <div className={styles.container} data-testid="profile-edit-skeleton">
      <div className={styles.card}>
        <div className={`${styles.lineTitle} ${styles.pulse}`} />
        <div className={`${styles.lineBio} ${styles.pulse}`} style={{ marginTop: 24 }} />
        <div className={`${styles.lineBio} ${styles.pulse}`} style={{ marginTop: 16, height: 120 }} />
      </div>
    </div>
  );
}

export function ProfileDetailSkeleton({
  'data-testid': testId = 'profile-skeleton',
}: ProfileDetailSkeletonProps) {
  return (
    <div className={styles.container} data-testid={testId}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={`${styles.avatar} ${styles.pulse}`} />
          <div style={{ flex: 1 }}>
            <div className={`${styles.lineTitle} ${styles.pulse}`} />
            <div className={`${styles.lineShort} ${styles.pulse}`} />
            <div className={`${styles.lineBio} ${styles.pulse}`} />
            <div className={`${styles.lineBio} ${styles.pulse}`} style={{ width: '80%' }} />
          </div>
        </div>
      </div>
      <div className={styles.tabs}>
        <div className={`${styles.tab} ${styles.pulse}`} />
        <div className={`${styles.tab} ${styles.pulse}`} />
        <div className={`${styles.tab} ${styles.pulse}`} />
      </div>
      <div className={styles.grid}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`${styles.gridCard} ${styles.pulse}`} />
        ))}
      </div>
    </div>
  );
}
