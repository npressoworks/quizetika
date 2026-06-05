/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { BookmarksTabs } from '@/components/bookmark/bookmarks-tabs';

describe('BookmarksTabs', () => {
  it('3タブと data-testid を表示し、タブ切替を通知する', () => {
    const onTabChange = jest.fn();
    render(<BookmarksTabs activeTab="quiz" onTabChange={onTabChange} />);

    expect(screen.getByTestId('bookmarks-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('bookmarks-tab-quiz')).toBeInTheDocument();
    expect(screen.getByTestId('bookmarks-tab-list')).toBeInTheDocument();
    expect(screen.getByTestId('bookmarks-tab-question')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bookmarks-tab-question'));
    expect(onTabChange).toHaveBeenCalledWith('question');
  });
});
