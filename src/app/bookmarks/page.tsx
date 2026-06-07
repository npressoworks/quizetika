import React, { Suspense } from 'react';
import { BookmarksClient } from './bookmarks-client';
import { BookmarksSkeleton } from '@/components/ui/bookmarks-skeleton';
import styles from './bookmarks.module.css';

export default async function BookmarksPage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<BookmarksSkeleton data-testid="bookmarks-skeleton" />}>
        <BookmarksClient />
      </Suspense>
    </div>
  );
}
