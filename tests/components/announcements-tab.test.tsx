/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AnnouncementsTab } from '@/app/notifications/announcements-tab';
import { getAnnouncements } from '@/services/announcement';

jest.mock('@/services/announcement', () => ({
  getAnnouncements: jest.fn(),
}));

describe('AnnouncementsTab Component', () => {
  const mockOnMarkAllRead = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('お知らせ一覧が正しく表示され、初期状態では省略表示で、クリック時にMarkdown全文が展開されること', async () => {
    (getAnnouncements as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'ann-1',
          title: '新バージョン公開！',
          content: '**新機能**とバグ修正を行いました。[詳細リンク](https://example.com) ' + 'A'.repeat(120),
          category: 'update',
          status: 'published',
          publishedAt: new Date('2026-06-20T12:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: 'admin-uid',
        },
      ],
      lastVisible: null,
    });

    const mockOnMarkAsRead = jest.fn();
    render(
      <AnnouncementsTab 
        lastReadAt={null} 
        onMarkAllRead={mockOnMarkAllRead} 
        unreadCount={0} 
        readAnnouncementIds={[]}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    // タイトルが表示されること
    await waitFor(() => {
      expect(screen.getByText('新バージョン公開！')).toBeInTheDocument();
    });

    // カテゴリバッジが表示されること
    expect(screen.getByText('アップデート')).toBeInTheDocument();

    // 初期状態は省略表示（プレーンテキストで、長さが抑えられ、HTMLタグが含まれない）
    const contentElement = screen.getByTestId('announcement-content-ann-1');
    expect(contentElement.textContent).toContain('新機能とバグ修正を行いました');
    expect(contentElement.textContent).toContain('...');
    expect(contentElement.innerHTML).not.toContain('<strong>');

    // お知らせカードをクリック
    const cardElement = contentElement.closest('[data-testid="announcement-card"]') || contentElement.parentElement;
    if (cardElement) {
      fireEvent.click(cardElement);
    }

    // 展開後は Markdown がパースされ、HTMLタグ（strongやa）として入っていること
    expect(contentElement.innerHTML).toContain('<strong>新機能</strong>');
    expect(contentElement.innerHTML).toContain('<a href="https://example.com"');

    // もう一度クリックして折りたたまれること
    if (cardElement) {
      fireEvent.click(cardElement);
    }
    expect(contentElement.innerHTML).not.toContain('<strong>');
  });

  test('不具合カテゴリのお知らせがアイコンとバッジとともに表示されること', async () => {
    (getAnnouncements as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'ann-2',
          title: '接続障害について',
          content: '現在サーバーが不安定になっています。',
          category: 'bug',
          status: 'published',
          publishedAt: new Date('2026-06-20T12:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: 'admin-uid',
        },
      ],
      lastVisible: null,
    });

    render(
      <AnnouncementsTab 
        lastReadAt={null} 
        onMarkAllRead={mockOnMarkAllRead} 
        unreadCount={0} 
        readAnnouncementIds={[]}
        onMarkAsRead={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('接続障害について')).toBeInTheDocument();
    });

    // バッジ名が「不具合」であること
    expect(screen.getByText('不具合')).toBeInTheDocument();
  });

  test('お知らせが0件のときにメッセージが表示されること', async () => {
    (getAnnouncements as jest.Mock).mockResolvedValue({
      items: [],
      lastVisible: null,
    });

    render(
      <AnnouncementsTab 
        lastReadAt={null} 
        onMarkAllRead={mockOnMarkAllRead} 
        unreadCount={0} 
        readAnnouncementIds={[]}
        onMarkAsRead={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('掲載中のお知らせはありません。')).toBeInTheDocument();
    });
  });

  test('未読件数が1以上の時「すべて既読にする」ボタンが表示され、クリック時にコールバックが呼ばれること', async () => {
    (getAnnouncements as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'ann-3',
          title: 'お知らせ3',
          content: 'コンテンツ3',
          category: 'info',
          status: 'published',
          publishedAt: new Date('2026-06-20T12:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: 'admin-uid',
        },
      ],
      lastVisible: null,
    });

    render(
      <AnnouncementsTab 
        lastReadAt={null} 
        onMarkAllRead={mockOnMarkAllRead} 
        unreadCount={1} 
        readAnnouncementIds={[]}
        onMarkAsRead={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('announcements-mark-all-read-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('announcements-mark-all-read-btn'));
    expect(mockOnMarkAllRead).toHaveBeenCalled();
  });

  test('未読のお知らせを展開したときに onMarkAsRead コールバックが呼ばれ、未読バッジが表示されること', async () => {
    (getAnnouncements as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'ann-unread',
          title: '未読のお知らせ',
          content: '未読コンテンツのテスト',
          category: 'info',
          status: 'published',
          publishedAt: new Date('2026-06-20T12:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: 'admin-uid',
        },
        {
          id: 'ann-read',
          title: '既読のお知らせ',
          content: '既読コンテンツのテスト',
          category: 'info',
          status: 'published',
          publishedAt: new Date('2026-06-20T12:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: 'admin-uid',
        },
      ],
      lastVisible: null,
    });

    const mockOnMarkAsRead = jest.fn();

    render(
      <AnnouncementsTab 
        lastReadAt={null} 
        onMarkAllRead={mockOnMarkAllRead} 
        unreadCount={2} 
        readAnnouncementIds={['ann-read']}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('未読のお知らせ')).toBeInTheDocument();
      expect(screen.getByText('既読のお知らせ')).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId('announcement-card');
    expect(cards).toHaveLength(2);

    const unreadCard = cards[0];
    const readCard = cards[1];
    expect(unreadCard.querySelector('[data-testid="announcement-unread-badge"]')).toBeInTheDocument();
    expect(readCard.querySelector('[data-testid="announcement-unread-badge"]')).not.toBeInTheDocument();

    fireEvent.click(unreadCard);
    expect(mockOnMarkAsRead).toHaveBeenCalledWith('ann-unread');

    mockOnMarkAsRead.mockClear();
    fireEvent.click(readCard);
    expect(mockOnMarkAsRead).not.toHaveBeenCalled();
  });
});
