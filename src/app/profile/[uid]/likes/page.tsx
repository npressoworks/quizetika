import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowBackOutlined } from '@mui/icons-material';
import { LikesClient } from './likes-client';
import { LikesSkeleton } from '@/components/profile/likes-skeleton';

type PageProps = {
  params: Promise<{ uid: string }>;
};

export default async function LikesPage({ params }: PageProps) {
  const { uid } = await params;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="flex flex-col gap-6">
        <Link
          href={`/profile/${uid}`}
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowBackOutlined sx={{ fontSize: 16 }} />
          <span>プロフィールに戻る</span>
        </Link>

        <Suspense fallback={<LikesSkeleton />}>
          <LikesClient />
        </Suspense>
      </div>
    </main>
  );
}
