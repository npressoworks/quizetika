/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProfileDetailSkeleton, ProfileEditSkeleton } from '@/components/profile/profile-skeleton';
import { ConnectionsSkeleton } from '@/components/profile/connections-skeleton';
import { LikesSkeleton } from '@/components/profile/likes-skeleton';

describe('Auth profile skeleton components', () => {
  it('ProfileDetailSkeleton は既定 testid を付与する', () => {
    render(<ProfileDetailSkeleton />);
    expect(screen.getByTestId('profile-skeleton')).toBeInTheDocument();
  });

  it('ProfileEditSkeleton は profile-edit-skeleton testid を付与する', () => {
    render(<ProfileEditSkeleton />);
    expect(screen.getByTestId('profile-edit-skeleton')).toBeInTheDocument();
  });

  it('ConnectionsSkeleton は既定 testid を付与する', () => {
    render(<ConnectionsSkeleton />);
    expect(screen.getByTestId('connections-skeleton')).toBeInTheDocument();
  });

  it('LikesSkeleton は likes-skeleton testid を付与する', () => {
    render(<LikesSkeleton />);
    expect(screen.getByTestId('likes-skeleton')).toBeInTheDocument();
  });
});
