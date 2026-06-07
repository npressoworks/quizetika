import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell } from 'lucide-react';
import { NotificationsClient } from './notifications-client';
import { NotificationsSkeleton } from '@/components/ui/notifications-skeleton';
import styles from './notifications.module.css';

export default async function NotificationsPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <Link href="/" className={styles.backButton}>
          <ArrowLeft size={16} />
          <span>ホームに戻る</span>
        </Link>

        <div className={`${styles.notificationsCard} glass-card`}>
          <div className={styles.cardHeader}>
            <div className={styles.titleWrapper}>
              <Bell size={24} className={styles.bellIcon} />
              <h1 className={styles.title}>通知一覧</h1>
            </div>
          </div>

          <Suspense fallback={<NotificationsSkeleton data-testid="notifications-skeleton" />}>
            <NotificationsClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
