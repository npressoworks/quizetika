/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationsClient } from '@/app/notifications/notifications-client';
import { useAuth } from '@/context/auth-context';
import { 
  getNotifications, 
  getUnreadNotificationsCount, 
  markAllNotificationsAsRead 
} from '@/services/notification';
import { getUnreadAnnouncementsCount } from '@/services/announcement';

jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/services/notification', () => ({
  getNotifications: jest.fn(),
  markAsRead: jest.fn(),
  getUnreadNotificationsCount: jest.fn(),
  markAllNotificationsAsRead: jest.fn(),
}));

jest.mock('@/services/announcement', () => ({
  getUnreadAnnouncementsCount: jest.fn(),
}));

jest.mock('@/app/notifications/announcements-tab', () => ({
  AnnouncementsTab: () => <div data-testid="announcements-tab-stub">Announcements Tab Stub</div>,
}));

describe('NotificationsClient - Tabs Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUnreadAnnouncementsCount as jest.Mock).mockResolvedValue(0);
    (getUnreadNotificationsCount as jest.Mock).mockResolvedValue(0);
  });

  test('未ログイン時、「運営からのお知らせ」タブが表示され、通知タブにログイン誘導が表示されること', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
    });

    render(<NotificationsClient />);

    // ロード完了（スケルトン非表示）を待つ
    await waitFor(() => {
      expect(screen.queryByTestId('notifications-skeleton')).not.toBeInTheDocument();
    });

    // 「運営からのお知らせ」タブを選択して表示されること（初期表示は personal タブだが、announcements タブもレンダリングされているか、切り替え時に表示される）
    const annTabTrigger = screen.getByText('運営からのお知らせ');
    fireEvent.click(annTabTrigger);
    expect(screen.getByTestId('announcements-tab-stub')).toBeInTheDocument();

    // 「通知」タブを選択
    const personalTabTrigger = screen.getByText('通知');
    fireEvent.click(personalTabTrigger);

    // ログイン誘導が表示されること
    expect(screen.getByText('通知機能を利用するにはログインが必要です')).toBeInTheDocument();
    expect(screen.getByTestId('login-redirect-btn')).toBeInTheDocument();
  });

  test('ログイン時、通常通り通知が表示されること', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1', name: 'ユーザー1' },
      loading: false,
    });

    (getNotifications as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'follow',
          senderId: 'sender-1',
          senderName: 'フォロー送信者',
          senderAvatar: 'avatar-1',
          isRead: false,
          createdAt: new Date(),
        },
      ],
      lastVisible: null,
    });

    render(<NotificationsClient />);

    // ロード完了（スケルトン非表示）を待つ
    await waitFor(() => {
      expect(screen.queryByTestId('notifications-skeleton')).not.toBeInTheDocument();
    });

    // 「通知」タブを選択
    const personalTabTrigger = screen.getByText('通知');
    fireEvent.click(personalTabTrigger);

    await waitFor(() => {
      expect(screen.getByText('フォロー送信者さんがあなたをフォローしました。')).toBeInTheDocument();
    });
  });
});
