import React, { Suspense } from 'react';
import { ProfileClient } from './profile-client';
import { ProfileDetailSkeleton } from '@/components/profile/profile-skeleton';

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileDetailSkeleton data-testid="profile-skeleton" />}>
      <ProfileClient />
    </Suspense>
  );
}
