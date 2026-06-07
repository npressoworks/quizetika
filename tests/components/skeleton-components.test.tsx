/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { GridSkeleton } from '@/components/ui/grid-skeleton';
import { DetailSkeleton } from '@/components/quiz/detail-skeleton';
import { LeaderboardSkeleton } from '@/components/quiz/leaderboard-skeleton';
import { ResultSkeleton } from '@/components/quiz/result-skeleton';
import { RecommendSkeleton } from '@/components/quiz/recommend-skeleton';
import { BookmarksSkeleton } from '@/components/ui/bookmarks-skeleton';
import { ReviewSkeleton } from '@/components/ui/review-skeleton';
import { NotificationsSkeleton } from '@/components/ui/notifications-skeleton';

describe('Streaming skeleton components', () => {
  it('GridSkeleton は data-testid を受け取る', () => {
    render(<GridSkeleton data-testid="home-feed-skeleton" />);
    expect(screen.getByTestId('home-feed-skeleton')).toBeInTheDocument();
  });

  it('DetailSkeleton は既定 testid を付与する', () => {
    render(<DetailSkeleton />);
    expect(screen.getByTestId('quiz-detail-skeleton')).toBeInTheDocument();
  });

  it('LeaderboardSkeleton は既定 testid を付与する', () => {
    render(<LeaderboardSkeleton />);
    expect(screen.getByTestId('leaderboard-skeleton')).toBeInTheDocument();
  });

  it('ResultSkeleton は既定 testid を付与する', () => {
    render(<ResultSkeleton />);
    expect(screen.getByTestId('quiz-result-skeleton')).toBeInTheDocument();
  });

  it('RecommendSkeleton は既定 testid を付与する', () => {
    render(<RecommendSkeleton />);
    expect(screen.getByTestId('recommend-skeleton')).toBeInTheDocument();
  });

  it('BookmarksSkeleton は既定 testid を付与する', () => {
    render(<BookmarksSkeleton />);
    expect(screen.getByTestId('bookmarks-skeleton')).toBeInTheDocument();
  });

  it('ReviewSkeleton は既定 testid を付与する', () => {
    render(<ReviewSkeleton />);
    expect(screen.getByTestId('review-skeleton')).toBeInTheDocument();
  });

  it('NotificationsSkeleton は既定 testid を付与する', () => {
    render(<NotificationsSkeleton />);
    expect(screen.getByTestId('notifications-skeleton')).toBeInTheDocument();
  });
});
