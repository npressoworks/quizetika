/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { HomeDiscoveryClient } from '@/app/home-discovery-client';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: null, firebaseUser: null, loading: false }),
}));

jest.mock('@/services/bookmark', () => ({
  toggleBookmark: jest.fn(),
}));

const mockGenres = [
  {
    id: 'programming',
    displayName: 'コンピュータ・IT',
    iconImageUrl: null,
    canonicalId: null,
    mergedGenreIds: [],
    isActive: true,
  },
];

const mockQuizzes: any = [
  {
    id: 'quiz-1',
    authorId: 'author-1',
    authorName: '作者',
    title: 'トレンドクイズ',
    description: '説明',
    thumbnailUrl: null,
    difficulty: 3,
    genre: 'programming',
    tags: [],
    questionCount: 5,
    status: 'published' as const,
    playCount: 1,
    bookmarksCount: 0,
    questions: [],
    questionIds: [],
  },
  {
    id: 'quiz-2',
    authorId: 'author-2',
    authorName: '作者2',
    title: '新着クイズ',
    description: '説明2',
    thumbnailUrl: null,
    difficulty: 2,
    genre: 'programming',
    tags: [],
    questionCount: 3,
    status: 'published' as const,
    playCount: 1,
    bookmarksCount: 0,
    questions: [],
    questionIds: [],
  },
];

describe('HomeDiscoveryClient', () => {
  it('検索バーとタブを表示しない', () => {
    render(
      <HomeDiscoveryClient
        initialTrending={[mockQuizzes[0]]}
        initialLatest={[mockQuizzes[1]]}
        initialGenres={mockGenres}
      />
    );

    expect(screen.queryByPlaceholderText(/クイズを検索/)).not.toBeInTheDocument();
    expect(screen.queryByText('新着順')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-page')).not.toBeInTheDocument();
  });

  it('3セクションともっと見るリンクを表示する', () => {
    render(
      <HomeDiscoveryClient
        initialTrending={[mockQuizzes[0]]}
        initialLatest={[mockQuizzes[1]]}
        initialGenres={mockGenres}
      />
    );

    expect(screen.getByTestId('home-discovery-trending')).toBeInTheDocument();
    expect(screen.getByTestId('home-discovery-genres')).toBeInTheDocument();
    expect(screen.getByTestId('home-discovery-latest')).toBeInTheDocument();

    expect(screen.getByTestId('discovery-see-more-trending')).toHaveAttribute(
      'href',
      '/search?tab=trending'
    );
    expect(screen.getByTestId('discovery-see-more-latest')).toHaveAttribute(
      'href',
      '/search?tab=latest'
    );
    expect(screen.getByTestId('discovery-see-more-genres')).toHaveAttribute(
      'href',
      '/search?openFilters=1'
    );
  });
});
