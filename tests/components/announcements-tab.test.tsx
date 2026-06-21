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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('お知らせ一覧が正しく表示され、初期状態では省略表示で、クリック時にMarkdown全文が展開されること', async () => {
    (getAnnouncements as jest.Mock).mockResolvedValue([
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
    ]);

    render(<AnnouncementsTab />);

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
    (getAnnouncements as jest.Mock).mockResolvedValue([
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
    ]);

    render(<AnnouncementsTab />);

    await waitFor(() => {
      expect(screen.getByText('接続障害について')).toBeInTheDocument();
    });

    // バッジ名が「不具合」であること
    expect(screen.getByText('不具合')).toBeInTheDocument();
  });

  test('お知らせが0件のときにメッセージが表示されること', async () => {
    (getAnnouncements as jest.Mock).mockResolvedValue([]);

    render(<AnnouncementsTab />);

    await waitFor(() => {
      expect(screen.getByText('掲載中のお知らせはありません。')).toBeInTheDocument();
    });
  });
});
