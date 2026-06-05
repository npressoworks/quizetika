/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProfileListsPanel } from '@/components/profile/profile-lists-panel';
import type { QuizList } from '@/types';

function list(id: string, listType?: 'quiz' | 'question'): QuizList {
  return {
    id,
    authorId: 'u1',
    authorName: 'A',
    authorAvatar: '',
    title: `List ${id}`,
    description: '',
    quizIds: listType === 'question' ? [] : ['q1'],
    questionIds: listType === 'question' ? ['x1'] : [],
    listType,
    isPublished: true,
    bookmarksCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ProfileListsPanel', () => {
  it('0件時は作成導線を表示（本人）', () => {
    render(<ProfileListsPanel lists={[]} isMyProfile />);
    expect(screen.getByText(/作成したリストはまだありません/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /新しいリストを作成する/ })).toHaveAttribute(
      'href',
      '/list/create'
    );
  });

  it('フィルタで設問リストのみに絞れる', () => {
    render(
      <ProfileListsPanel
        lists={[list('quiz-1'), list('q-1', 'question')]}
        isMyProfile={false}
      />
    );
    expect(screen.getAllByTestId('profile-list-card')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('profile-list-filter-question'));
    expect(screen.getAllByTestId('profile-list-card')).toHaveLength(1);
    expect(screen.getByTestId('profile-list-type-badge')).toHaveTextContent('設問リスト');
  });

  it('フィルタ結果0件で解除操作を表示', () => {
    render(<ProfileListsPanel lists={[list('quiz-only')]} isMyProfile={false} />);
    fireEvent.click(screen.getByTestId('profile-list-filter-question'));
    expect(screen.getByTestId('profile-list-filter-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /フィルタを解除/ }));
    expect(screen.getAllByTestId('profile-list-card')).toHaveLength(1);
  });
});
