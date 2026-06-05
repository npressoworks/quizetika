/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProfileListCard } from '@/components/profile/profile-list-card';
import type { QuizList } from '@/types';

function baseList(overrides: Partial<QuizList> = {}): QuizList {
  return {
    id: 'list-1',
    authorId: 'u1',
    authorName: 'Author',
    authorAvatar: '',
    title: 'テストリスト',
    description: '説明',
    quizIds: ['quiz-a', 'quiz-b'],
    questionIds: [],
    isPublished: true,
    bookmarksCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ProfileListCard', () => {
  it('レガシー未設定リストはクイズリストとして表示', () => {
    render(<ProfileListCard list={baseList()} />);
    expect(screen.getByTestId('profile-list-type-badge')).toHaveTextContent('クイズリスト');
    expect(screen.getByText('収録クイズ: 2 件')).toBeInTheDocument();
  });

  it('設問リストは questionIds 件数を表示', () => {
    render(
      <ProfileListCard
        list={baseList({
          listType: 'question',
          quizIds: ['should-not-show'],
          questionIds: ['q1', 'q2', 'q3'],
        })}
      />
    );
    expect(screen.getByTestId('profile-list-type-badge')).toHaveTextContent('設問リスト');
    expect(screen.getByText('収録設問: 3 件')).toBeInTheDocument();
    expect(screen.queryByText(/収録クイズ/)).not.toBeInTheDocument();
  });

  it('data-testid を付与する', () => {
    render(<ProfileListCard list={baseList()} />);
    expect(screen.getByTestId('profile-list-card')).toBeInTheDocument();
  });
});
