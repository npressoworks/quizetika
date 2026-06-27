/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ProfileEditClient } from '@/app/profile/edit/profile-edit-client';
import { getUser, updateProfile } from '@/services/user';
import { useActiveGenres } from '@/hooks/useActiveGenres';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const mockCurrentUser = { id: 'user-1', displayName: '本人' };
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: mockCurrentUser, loading: false }),
}));

jest.mock('@/services/user', () => ({
  getUser: jest.fn().mockResolvedValue({
    id: 'user-1',
    displayName: 'テストユーザー',
    bio: 'プロフィール自己紹介',
    deleteStatus: 'active',
    followedGenres: ['genre-1'],
    snsLinks: { youtube: '', x: '', instagram: '', tiktok: '' },
  }),
  updateProfile: jest.fn(),
  validateProfileData: jest.fn().mockReturnValue([]),
}));

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: jest.fn().mockReturnValue({
    genres: [
      { id: 'genre-1', displayName: 'プログラミング', iconImageUrl: '/icons/prog.png' },
      { id: 'genre-2', displayName: '歴史', iconImageUrl: '' },
      { id: 'genre-3', displayName: '科学', iconImageUrl: '' },
      { id: 'genre-4', displayName: '芸術', iconImageUrl: '' },
    ],
    loading: false,
    error: null,
    genreLabelById: new Map([
      ['genre-1', 'プログラミング'],
      ['genre-2', '歴史'],
      ['genre-3', '科学'],
      ['genre-4', '芸術'],
    ]),
    refetch: jest.fn(),
  }),
}));

describe('ProfileEditClient - Genre Selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ジャンル選択UIが表示され、初期データがチップとして表示されていること', async () => {
    render(<ProfileEditClient />);

    // ロード完了を待つ
    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    // ジャンル選択UIコンテナが存在すること
    const genreSelectContainer = screen.getByTestId('profile-genre-select');
    expect(genreSelectContainer).toBeInTheDocument();

    // 初期値の「プログラミング」チップが表示されていること
    expect(screen.getByTestId('profile-genre-chip-genre-1')).toBeInTheDocument();
    expect(screen.getByText('プログラミング')).toBeInTheDocument();

    // 「歴史」チップはまだ表示されていないこと
    expect(screen.queryByTestId('profile-genre-chip-genre-2')).not.toBeInTheDocument();
  });

  it('検索バーに入力してサジェストから選択し、チップを削除して保存できること', async () => {
    (updateProfile as jest.Mock).mockResolvedValue(true);
    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    // 1. 初期選択の「プログラミング」チップを削除
    const removeBtn = screen.getByTestId('profile-genre-remove-genre-1');
    await act(async () => {
      fireEvent.click(removeBtn);
    });
    expect(screen.queryByTestId('profile-genre-chip-genre-1')).not.toBeInTheDocument();

    // 2. 検索バーに「歴史」と入力
    const searchInput = screen.getByTestId('profile-genre-search-input');
    await act(async () => {
      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: '歴史' } });
    });

    // サジェストが表示されるのを待つ
    const suggestItem = await screen.findByTestId('profile-genre-suggest-genre-2');
    expect(suggestItem).toBeInTheDocument();

    // 3. サジェストを選択
    await act(async () => {
      fireEvent.mouseDown(suggestItem);
    });

    // 「歴史」チップが追加されたことを確認
    expect(screen.getByTestId('profile-genre-chip-genre-2')).toBeInTheDocument();

    // 保存ボタンをクリック
    const saveButton = screen.getByRole('button', { name: /保存/ });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith('user-1', {
        displayName: 'テストユーザー',
        bio: 'プロフィール自己紹介',
        followedGenres: ['genre-2'],
        snsLinks: { youtube: '', x: '', instagram: '', tiktok: '' },
      });
      expect(mockPush).toHaveBeenCalledWith('/profile/user-1');
    });
  });

  it('最大3つのジャンル制限が機能すること', async () => {
    // 初期選択を空にするモック
    (getUser as jest.Mock).mockResolvedValueOnce({
      id: 'user-1',
      displayName: 'テストユーザー',
      bio: 'プロフィール自己紹介',
      deleteStatus: 'active',
      followedGenres: [],
      snsLinks: { youtube: '', x: '', instagram: '', tiktok: '' },
    });

    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('profile-genre-search-input');

    // ジャンル1（プログラミング）を追加
    await act(async () => {
      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: 'プログラミング' } });
    });
    const suggest1 = await screen.findByTestId('profile-genre-suggest-genre-1');
    await act(async () => {
      fireEvent.mouseDown(suggest1);
    });

    // ジャンル2（歴史）を追加
    await act(async () => {
      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: '歴史' } });
    });
    const suggest2 = await screen.findByTestId('profile-genre-suggest-genre-2');
    await act(async () => {
      fireEvent.mouseDown(suggest2);
    });

    // ジャンル3（科学）を追加
    await act(async () => {
      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: '科学' } });
    });
    const suggest3 = await screen.findByTestId('profile-genre-suggest-genre-3');
    await act(async () => {
      fireEvent.mouseDown(suggest3);
    });

    // 3つ追加されたことの確認
    expect(screen.getByTestId('profile-genre-chip-genre-1')).toBeInTheDocument();
    expect(screen.getByTestId('profile-genre-chip-genre-2')).toBeInTheDocument();
    expect(screen.getByTestId('profile-genre-chip-genre-3')).toBeInTheDocument();

    // 検索インプットが disabled になり、プレースホルダーが変化することを確認
    expect(searchInput).toBeDisabled();
    expect(searchInput).toHaveAttribute('placeholder', 'ジャンルは最大3つまで登録できます');
  });
});
