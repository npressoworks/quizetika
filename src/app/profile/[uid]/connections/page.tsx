import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ConnectionsClient } from './connections-client';
import { ConnectionsSkeleton } from '@/components/profile/connections-skeleton';
import styles from './connections.module.css';

type PageProps = {
  params: Promise<{ uid: string }>;
};

export default async function ConnectionsPage({ params }: PageProps) {
  const { uid } = await params;

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <Link href={`/profile/${uid}`} className={styles.backButton}>
          <ArrowLeft size={16} />
          <span>プロフィールに戻る</span>
        </Link>

        <Suspense fallback={<ConnectionsSkeleton data-testid="connections-skeleton" />}>
          <ConnectionsClient />
        </Suspense>
      </div>
    </main>
  );
}
