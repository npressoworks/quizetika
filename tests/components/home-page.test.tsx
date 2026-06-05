/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Home from '@/app/page';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    firebaseUser: { uid: 'user-1' },
    loading: false,
  }),
}));

const mockGenres = [
  { id: 'programming', displayName: 'コンピュータ・IT', iconImageUrl: null, canonicalId: null, mergedGenreIds: [], isActive: true },
];

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: () => ({
    genres: mockGenres,
    loading: false,
    error: null,
    genreLabelById: new Map([['programming', 'コンピュータ・IT']]),
    refetch: jest.fn(),
  }),
}));

const mockQuizzes = [
  {
    id: 'quiz-1',
    authorId: 'author-1',
    authorName: 'テスト作者',
    title: 'JavaScript 基礎クイズ',
    description: 'JSの基礎知識を問います',
    thumbnailUrl: null,
    difficulty: 5,
    genre: 'programming',
    tags: ['js'],
    questionCount: 10,
    status: 'published',
    playCount: 10,
    bookmarksCount: 3,
    reviewScore: 4.5,
  },
];

let mockFeedLoading = false;
jest.mock('@/hooks/useHomeQuizFeed', () => ({
  useHomeQuizFeed: () => ({
    quizzes: mockQuizzes,
    loading: mockFeedLoading,
    error: null,
  }),
}));

jest.mock('@/hooks/usePlayedQuizIds', () => ({
  usePlayedQuizIds: () => ({
    playedQuizIds: new Set(),
  }),
}));

jest.mock('@/services/bookmark', () => ({
  toggleBookmark: jest.fn(),
  getBookmarkedQuizIds: () => Promise.resolve([]),
}));

describe('Home Page UI', () => {
  beforeEach(() => {
    push.mockClear();
    mockFeedLoading = false;
  });

  it('検索バーに入力でき、消去ボタンでクリアされること', () => {
    render(<Home />);
    
    const input = screen.getByPlaceholderText(/クイズを検索.../);
    fireEvent.change(input, { target: { value: 'TypeScript' } });
    expect(input).toHaveValue('TypeScript');

    // クリアボタンが表示され、クリックでクリアされること
    const clearBtn = screen.getByLabelText('クリア');
    fireEvent.click(clearBtn);
    expect(input).toHaveValue('');
  });

  it('クイック検索チップをクリックすると検索欄に文字列がセットされること', () => {
    render(<Home />);
    
    const chip = screen.getByRole('button', { name: '#ウミガメのスープ' });
    fireEvent.click(chip);

    const input = screen.getByPlaceholderText(/クイズを検索.../);
    expect(input).toHaveValue('#ウミガメのスープ');
  });

  it('ロード中はスケルトンカードが表示されること', () => {
    mockFeedLoading = true;
    render(<Home />);

    const skeletons = screen.getAllByTestId('skeleton-card');
    expect(skeletons.length).toBe(6);
  });

  it('ロード完了後はクイズカードが表示されること', () => {
    mockFeedLoading = false;
    render(<Home />);

    expect(screen.getByText('JavaScript 基礎クイズ')).toBeInTheDocument();
  });
});
