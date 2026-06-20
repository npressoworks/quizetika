/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AnnouncementsTab } from '@/app/notifications/announcements-tab';
import { getAnnouncements } from '@/services/announcement';

jest.mock('@/services/announcement', () => ({
  getAnnouncements: jest.fn(),
}));

describe('AnnouncementsTab Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('お知らせ一覧が降順で正しく表示され、MarkdownがHTMLに変換されること', async () => {
    (getAnnouncements as jest.Mock).mockResolvedValue([
      {
        id: 'ann-1',
        title: '新バージョン公開！',
        content: '**新機能**とバグ修正を行いました。[詳細リンク](https://example.com)',
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

    // Markdown がパースされ、HTMLタグ（strongやa）として入っていること
    const contentElement = screen.getByTestId('announcement-content-ann-1');
    expect(contentElement.innerHTML).toContain('<strong>新機能</strong>');
    expect(contentElement.innerHTML).toContain('<a href="https://example.com"');
  });

  test('お知らせが0件のときにメッセージが表示されること', async () => {
    (getAnnouncements as jest.Mock).mockResolvedValue([]);

    render(<AnnouncementsTab />);

    await waitFor(() => {
      expect(screen.getByText('掲載中のお知らせはありません。')).toBeInTheDocument();
    });
  });
});
