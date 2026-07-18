/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';

if (typeof global.TransformStream === 'undefined') {
  const { TransformStream } = require('node:stream/web');
  global.TransformStream = TransformStream;
}
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('node:util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

import { render, screen, fireEvent, act } from '@testing-library/react';
import { QuizEditorContent } from '@/components/quiz/quiz-editor';
import { saveQuiz } from '@/services/quiz';
import type { GenreMetadata } from '@/types';

const mockSearchParams = new URLSearchParams();
const mockUser = { id: 'uid-1', displayName: 'Test User', avatarUrl: '' };
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}));

jest.mock('@/lib/pricing-entitlement', () => ({
  hasUnlimitedAiQuestionsForUser: () => false,
  hasAiAuthoringEntitlementsForUser: () => false,
}));

jest.mock('@/services/quiz', () => ({
  getQuiz: jest.fn(),
  saveQuiz: jest.fn().mockResolvedValue('new-quiz-id'),
  updateQuiz: jest.fn(),
}));

const genres: GenreMetadata[] = [
  {
    id: 'history-geography',
    displayName: '歴史・地理',
    iconImageUrl: null,
    canonicalId: null,
    mergedGenreIds: [],
    isActive: true,
  },
];

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: () => ({ genres: [{ id: 'history-geography', displayName: '歴史・地理', iconImageUrl: null, canonicalId: null, mergedGenreIds: [], isActive: true }], loading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('@/hooks/useActiveTags', () => ({
  useActiveTags: () => ({ tags: [], loading: false, error: null, tagLabelById: new Map(), refetch: jest.fn() }),
}));

describe('QuizEditor 下書き保存時の難易度デフォルト値', () => {
  it('難易度を選択せずに下書き保存すると、DBのCHECK制約(1〜5)を満たす値(1)で保存されること', async () => {
    window.alert = jest.fn();

    render(
      <QuizEditorContent
        quizId={undefined}
        initialGenres={genres}
        initialQuiz={null}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText('例: 世界の国旗と首都クイズ'),
      { target: { value: '[TEST] 難易度未選択クイズ' } }
    );

    const genreInput = screen.getByTestId('genre-editor-search-input');
    fireEvent.focus(genreInput);
    const genreOption = await screen.findByTestId('genre-editor-search-option-history-geography');
    fireEvent.click(genreOption);

    const questionText = screen.getByPlaceholderText('例: 日本で一番**高い**山は？');
    fireEvent.change(questionText, { target: { value: 'テスト問題文です' } });

    const saveDraftBtn = screen.getByRole('button', { name: '下書き保存' });
    await act(async () => {
      fireEvent.click(saveDraftBtn);
    });

    expect(saveQuiz).toHaveBeenCalledWith(
      expect.objectContaining({ difficulty: 1 }),
      'draft'
    );
  });
});
