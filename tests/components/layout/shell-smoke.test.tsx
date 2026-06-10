/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';

const mockUseAuth = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/lib/firebase/config', () => ({ auth: {} }));
jest.mock('@/lib/firebase/auth', () => ({ signOut: jest.fn() }));

describe('shell components smoke', () => {
  test('BottomNav renders for logged-out user', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-home')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-search')).toBeInTheDocument();
    expect(screen.queryByTestId('bottom-nav-profile')).not.toBeInTheDocument();
  });

  test('BottomNav renders profile for logged-in user', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', displayName: 'Test', avatarUrl: 'https://example.com/a.png' },
      loading: false,
    });
    render(<BottomNav />);
    expect(screen.getByTestId('bottom-nav-profile')).toBeInTheDocument();
  });

  test('Sidebar renders nav for logged-in user', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', displayName: 'Test', avatarUrl: 'https://example.com/a.png' },
      loading: false,
    });
    render(<Sidebar />);
    expect(screen.getByTestId('nav-home')).toBeInTheDocument();
    expect(screen.getByTestId('nav-my-quiz')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-lists')).not.toBeInTheDocument();
  });

  test('Header renders login link for logged-out user', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<Header />);
    expect(screen.getByRole('link', { name: 'ログイン' })).toBeInTheDocument();
  });
});
