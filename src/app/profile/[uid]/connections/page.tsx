import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowBackOutlined } from '@mui/icons-material';
import { ConnectionsClient } from './connections-client';
import { ConnectionsSkeleton } from '@/components/profile/connections-skeleton';

type PageProps = {
  params: Promise<{ uid: string }>;
};

export default async function ConnectionsPage({ params }: PageProps) {
  const { uid } = await params;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-3xl flex-col gap-5 px-6 py-10">
      <Link
        href={`/profile/${uid}`}
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowBackOutlined sx={{ fontSize: 16 }} />
        <span>プロフィールに戻る</span>
      </Link>

      <Suspense fallback={<ConnectionsSkeleton data-testid="connections-skeleton" />}>
        <ConnectionsClient />
      </Suspense>
    </main>
  );
}
