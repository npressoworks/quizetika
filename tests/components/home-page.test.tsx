/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { HomeClient } from '@/app/home-client';

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

jest.mock('@/hooks/useActiveTags', () => ({
  useActiveTags: () => ({
    tags: [{ id: 'ウミガメのスープ', tagName: 'ウミガメのスープ', canonicalId: null, mergedTagIds: [] }],
    loading: false,
    error: null,
    tagLabelById: new Map([['ウミガメのスープ', 'ウミガメのスープ']]),
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
    questions: [],
    questionIds: [],
  },
];

let mockFeedLoading = false;
jest.mock('@/hooks/useExploreQuizFeed', () => ({
  useExploreQuizFeed: () => ({
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
    render(<HomeClient initialGenres={mockGenres} initialTags={[]} initialQuizzes={mockQuizzes} />);

    const input = screen.getByPlaceholderText(/クイズを検索/);
    fireEvent.change(input, { target: { value: 'TypeScript' } });
    expect(input).toHaveValue('TypeScript');

    const clearBtn = screen.getByTestId('search-clear-btn');
    fireEvent.click(clearBtn);
    expect(input).toHaveValue('');
  });

  it('クイック検索チップをクリックするとタグチップが追加されること', () => {
    render(<HomeClient initialGenres={mockGenres} initialTags={[]} initialQuizzes={mockQuizzes} />);

    const chip = screen.getByRole('button', { name: '#ウミガメのスープ' });
    fireEvent.click(chip);

    expect(screen.getAllByTestId('search-tag-chip').length).toBeGreaterThanOrEqual(1);
  });

  it('ロード中はフィード領域のみスケルトンが表示されること', () => {
    mockFeedLoading = true;
    render(<HomeClient initialGenres={mockGenres} initialTags={[]} initialQuizzes={mockQuizzes} />);

    expect(screen.getByTestId('home-feed-skeleton')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/クイズを検索/)).toBeInTheDocument();
    expect(screen.getByTestId('explore-accordion-genre')).toBeInTheDocument();
  });

  it('ロード完了後はクイズカードが表示されること', () => {
    mockFeedLoading = false;
    render(<HomeClient initialGenres={mockGenres} initialTags={[]} initialQuizzes={mockQuizzes} />);

    expect(screen.getByText('JavaScript 基礎クイズ')).toBeInTheDocument();
    expect(screen.getByTestId('quiz-card-difficulty')).toBeInTheDocument();
  });

  it('GenreNav は表示せず探索アコーディオンを表示すること', () => {
    render(<HomeClient initialGenres={mockGenres} initialTags={[]} initialQuizzes={mockQuizzes} />);

    expect(screen.queryByTestId('genre-nav')).not.toBeInTheDocument();
    expect(screen.getByTestId('explore-accordion-genre')).toBeInTheDocument();
    expect(screen.getByTestId('explore-accordion-format')).toBeInTheDocument();
  });

  it('ジャンルアコーディオン展開後カルーセル選択で router.push しないこと', () => {
    render(<HomeClient initialGenres={mockGenres} initialTags={[]} initialQuizzes={mockQuizzes} />);

    fireEvent.click(screen.getByTestId('explore-accordion-genre'));
    fireEvent.click(screen.getByTestId('genre-carousel-card-programming'));

    expect(push).not.toHaveBeenCalled();
  });
});
