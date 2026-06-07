import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LikesClient } from './likes-client';
import { LikesSkeleton } from '@/components/profile/likes-skeleton';
import styles from './likes.module.css';

type PageProps = {
  params: Promise<{ uid: string }>;
};

export default async function LikesPage({ params }: PageProps) {
  const { uid } = await params;

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <Link href={`/profile/${uid}`} className={styles.backButton}>
          <ArrowLeft size={16} />
          <span>プロフィールに戻る</span>
        </Link>

        <Suspense fallback={<LikesSkeleton />}>
          <LikesClient />
        </Suspense>
      </div>
    </main>
  );
}
