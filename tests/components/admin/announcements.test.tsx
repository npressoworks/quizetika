/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminAnnouncementsClient from '@/app/admin/announcements/client';
import { adminGetAnnouncements, createAnnouncement } from '@/services/announcement';
import { useAuth } from '@/context/auth-context';

// mocks
jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/announcement', () => ({
  adminGetAnnouncements: jest.fn(),
  createAnnouncement: jest.fn(),
  updateAnnouncement: jest.fn(),
  deleteAnnouncement: jest.fn(),
}));

// Next.js router mock
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('AdminAnnouncementsClient', () => {
  const mockUser = {
    id: 'admin-uid',
    moderationTier: 'admin',
    role: 'admin',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
    });
  });

  test('お知らせ一覧が取得されて表示されること', async () => {
    (adminGetAnnouncements as jest.Mock).mockResolvedValue([
      {
        id: 'ann-1',
        title: '緊急メンテナンス',
        content: '本文です',
        category: 'maintenance',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        authorId: 'admin-uid',
      },
    ]);

    render(<AdminAnnouncementsClient />);

    await waitFor(() => {
      expect(screen.getByText('緊急メンテナンス')).toBeInTheDocument();
    });
  });

  test('フォームでお知らせを作成できること', async () => {
    (adminGetAnnouncements as jest.Mock).mockResolvedValue([]);
    (createAnnouncement as jest.Mock).mockResolvedValue('new-ann-id');

    render(<AdminAnnouncementsClient />);

    // 「新規作成」ボタンをクリック
    const createBtn = screen.getByTestId('open-create-announcement-btn');
    fireEvent.click(createBtn);

    // フォームへの入力
    fireEvent.change(screen.getByPlaceholderText('お知らせのタイトルを入力'), {
      target: { value: '新しい機能の追加' },
    });
    fireEvent.change(screen.getByPlaceholderText('お知らせの本文を入力 (Markdown対応)'), {
      target: { value: '**新機能**をリリースしました。' },
    });

    // 送信
    const submitBtn = screen.getByTestId('submit-announcement-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '新しい機能の追加',
          content: '**新機能**をリリースしました。',
        })
      );
    });
  });

  test('フォームで不具合カテゴリのお知らせを作成できること', async () => {
    (adminGetAnnouncements as jest.Mock).mockResolvedValue([]);
    (createAnnouncement as jest.Mock).mockResolvedValue('bug-ann-id');

    render(<AdminAnnouncementsClient />);

    // 「新規作成」ボタンをクリック
    const createBtn = screen.getByTestId('open-create-announcement-btn');
    fireEvent.click(createBtn);

    // フォームへの入力
    fireEvent.change(screen.getByPlaceholderText('お知らせのタイトルを入力'), {
      target: { value: '不具合修正のお知らせ' },
    });
    fireEvent.change(screen.getByPlaceholderText('お知らせの本文を入力 (Markdown対応)'), {
      target: { value: '不具合を修正しました。' },
    });

    // カテゴリを「不具合」に変更
    const categorySelect = screen.getByDisplayValue('一般案内 (info)') as HTMLSelectElement;
    fireEvent.change(categorySelect, { target: { value: 'bug' } });

    // 送信
    const submitBtn = screen.getByTestId('submit-announcement-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '不具合修正のお知らせ',
          content: '不具合を修正しました。',
          category: 'bug',
        })
      );
    });
  });
});

