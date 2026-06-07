import React from 'react';
import styles from './notifications-skeleton.module.css';

interface NotificationsSkeletonProps {
  'data-testid'?: string;
}

export function NotificationsSkeleton({ 'data-testid': testId = 'notifications-skeleton' }: NotificationsSkeletonProps) {
  return (
    <div className={styles.skeletonWrapper} data-testid={testId}>
      <div className={`${styles.backBtn} ${styles.pulse}`} />
      
      <div className={styles.notificationsCard}>
        <div className={styles.cardHeader}>
          <div className={`${styles.title} ${styles.pulse}`} />
        </div>

        <div className={styles.listContainer}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.notificationCard}>
              <div className={`${styles.avatar} ${styles.pulse}`} />
              <div className={styles.contentWrapper}>
                <div className={`${styles.message} ${styles.pulse}`} />
                <div className={`${styles.timestamp} ${styles.pulse}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
