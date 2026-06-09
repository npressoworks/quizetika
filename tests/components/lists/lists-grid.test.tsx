/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ListsGrid } from '@/components/lists/lists-grid';
import type { QuizList } from '@/types';

function makeList(id: string): QuizList {
  return {
    id,
    authorId: 'a1',
    authorName: '作者',
    authorAvatar: '',
    title: `リスト ${id}`,
    description: '説明',
    quizIds: ['q1'],
    questionIds: [],
    isPublished: true,
    bookmarksCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ListsGrid', () => {
  test('空状態を表示する', () => {
    render(
      <ListsGrid lists={[]} loading={false} error={null} onRetry={jest.fn()} />
    );
    expect(screen.getByTestId('lists-empty-state')).toBeInTheDocument();
  });

  test('エラー時に再試行ボタンを表示する', () => {
    render(
      <ListsGrid lists={[]} loading={false} error="失敗" onRetry={jest.fn()} />
    );
    expect(screen.getByText('失敗')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
  });

  test('カード件数を表示する', () => {
    render(
      <ListsGrid
        lists={[makeList('1'), makeList('2')]}
        loading={false}
        error={null}
        onRetry={jest.fn()}
      />
    );
    expect(screen.getAllByTestId('lists-discovery-card')).toHaveLength(2);
  });
});
