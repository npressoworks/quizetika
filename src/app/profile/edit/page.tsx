import React, { Suspense } from 'react';
import { ProfileEditClient } from './profile-edit-client';
import { ProfileEditSkeleton } from '@/components/profile/profile-skeleton';

export default function ProfileEditPage() {
  return (
    <Suspense fallback={<ProfileEditSkeleton />}>
      <ProfileEditClient />
    </Suspense>
  );
}
