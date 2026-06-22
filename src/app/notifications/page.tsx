import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowBackOutlined, NotificationsOutlined } from '@mui/icons-material';
import { NotificationsClient } from './notifications-client';
import { NotificationsSkeleton } from '@/components/ui/notifications-skeleton';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

export default async function NotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="flex flex-col gap-6">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowBackOutlined sx={{ fontSize: 16 }} />
          <span>ホームに戻る</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <NotificationsOutlined sx={{ fontSize: 24 }} className="text-primary" />
              通知一覧
            </CardTitle>
          </CardHeader>

          <Suspense fallback={<NotificationsSkeleton data-testid="notifications-skeleton" />}>
            <NotificationsClient />
          </Suspense>
        </Card>
      </div>
    </main>
  );
}
