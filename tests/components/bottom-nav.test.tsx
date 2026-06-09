/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BottomNav } from '@/components/layout/bottom-nav';

// Mock navigation
let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

// Mock auth context
let mockUser: { id: string; avatarUrl?: string; displayName?: string } | null = null;
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}));

describe('BottomNav Component', () => {
  beforeEach(() => {
    mockPathname = '/';
    mockUser = null;
  });

  it('未ログイン時はホームと検索の2リンクを表示する', () => {
    mockUser = null;
    render(<BottomNav />);

    const links = screen.getAllByRole('link');
    expect(links.length).toBe(2);
    expect(screen.getByTestId('bottom-nav-home')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-search')).toBeInTheDocument();
    expect(screen.queryByTestId('bottom-nav-notifications')).not.toBeInTheDocument();
  });

  it('ログイン時はホーム、検索、通知、ブックマーク、プロフィールの5リンクを表示する', () => {
    mockUser = { id: 'user-123', avatarUrl: 'avatar.png' };
    render(<BottomNav />);

    const links = screen.getAllByRole('link');
    expect(links.length).toBe(5);

    expect(screen.getByTestId('bottom-nav-home')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-search')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-notifications')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-bookmarks')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-profile')).toBeInTheDocument();
  });

  it('/ ではホームのみ active', () => {
    mockUser = null;
    mockPathname = '/';
    render(<BottomNav />);

    expect(screen.getByTestId('bottom-nav-home')).toHaveClass('active');
    expect(screen.getByTestId('bottom-nav-search')).not.toHaveClass('active');
  });

  it('/search では検索のみ active', () => {
    mockUser = null;
    mockPathname = '/search';
    render(<BottomNav />);

    expect(screen.getByTestId('bottom-nav-search')).toHaveClass('active');
    expect(screen.getByTestId('bottom-nav-home')).not.toHaveClass('active');
  });

  it('アクティブなパスに合致するアイテムがハイライト表示される', () => {
    mockUser = { id: 'user-123', avatarUrl: 'avatar.png' };
    mockPathname = '/notifications';
    render(<BottomNav />);

    const activeLink = screen.getByTestId('bottom-nav-notifications');
    expect(activeLink).toHaveClass('active');
  });
});
