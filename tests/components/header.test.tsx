/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Header } from '@/components/layout/header';

// Mock navigation
let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock auth context
let mockUser: any = null;
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}));
jest.mock('@/lib/supabase/auth', () => ({
  signOut: jest.fn(() => Promise.resolve()),
}));

describe('Header Component (Mobile Mini Header)', () => {
  beforeEach(() => {
    mockPathname = '/';
    mockUser = null;
  });

  it('ロゴが常にレンダリングされること', () => {
    render(<Header />);
    expect(screen.getByText('Quiz')).toBeInTheDocument();
    expect(screen.getByText('eum')).toBeInTheDocument();
  });

  it('未ログイン時はログインボタンを表示し、作問ボタン・アバターを非表示にする', () => {
    mockUser = null;
    render(<Header />);
    
    expect(screen.getByRole('link', { name: 'ログイン' })).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-header-create-btn')).not.toBeInTheDocument();
    expect(screen.queryByAltText('avatar')).not.toBeInTheDocument();
  });

  it('ログイン時は作問ボタンとプロフィールボタンを表示し、ログインボタンを非表示にする', () => {
    mockUser = { id: 'user-123', displayName: 'ななみ', avatarUrl: 'avatar.png' };
    render(<Header />);
    
    expect(screen.queryByRole('link', { name: 'ログイン' })).not.toBeInTheDocument();
    expect(screen.getByTestId('mobile-header-create-btn')).toBeInTheDocument();
    expect(screen.getByTestId('header-profile-btn')).toBeInTheDocument();
    expect(screen.getByText('な')).toBeInTheDocument();
  });

  it('クイズプレイ画面（/play/）では非表示になること', () => {
    mockPathname = '/play/quiz-1';
    const { container } = render(<Header />);
    expect(container.firstChild).toBeNull();
  });
});
