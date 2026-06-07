import React, { Suspense } from 'react';
import { NotificationsClient } from './notifications-client';
import { NotificationsSkeleton } from '@/components/ui/notifications-skeleton';
import styles from './notifications.module.css';

export default async function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsSkeleton data-testid="notifications-skeleton" />}>
      <NotificationsClient />
    </Suspense>
  );
}
