import { 
  getAnnouncements, 
  adminGetAnnouncements, 
  getAnnouncementById,
  createAnnouncement, 
  updateAnnouncement, 
  deleteAnnouncement,
  getUnreadAnnouncementsCount
} from '../../src/services/announcement';

// Supabase クライアントのモックを作成
jest.mock('@/lib/supabase/client', () => {
  const mock: any = {
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    order: jest.fn(() => mock),
    limit: jest.fn(() => mock),
    lt: jest.fn(() => mock),
    gt: jest.fn(() => mock),
    update: jest.fn(() => mock),
    insert: jest.fn(() => mock),
    delete: jest.fn(() => mock),
    maybeSingle: jest.fn(),
    single: jest.fn(),
    then: jest.fn((onFulfilled) => Promise.resolve({ data: null, error: null }).then(onFulfilled)),
  };
  return {
    createClient: () => mock,
  };
});

import { createClient } from '@/lib/supabase/client';
const mockSupabase = createClient() as any;

function makeAnnouncementRow(id: string, title: string, category: string, status = 'published') {
  return {
    id,
    title,
    content: 'テスト本文',
    category,
    status,
    published_at: new Date('2026-06-20T10:00:00Z').toISOString(),
    created_at: new Date('2026-06-20T10:00:00Z').toISOString(),
    updated_at: new Date('2026-06-20T10:00:00Z').toISOString(),
    author_id: 'admin-uid',
  };
}

describe('AnnouncementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.limit.mockReturnValue(mockSupabase);
    mockSupabase.lt.mockReturnValue(mockSupabase);
    mockSupabase.gt.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.delete.mockReturnValue(mockSupabase);
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.single.mockResolvedValue({ data: null, error: null });
  });

  describe('createAnnouncement', () => {
    test('お知らせが正しく作成されること', async () => {
      const mockData = {
        title: 'テストお知らせ',
        content: 'テスト本文',
        category: 'info' as const,
        status: 'published' as const,
        publishedAt: new Date(),
        authorId: 'admin-uid',
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'new-announcement-id' },
        error: null,
      });

      const newId = await createAnnouncement(mockData);

      expect(mockSupabase.from).toHaveBeenCalledWith('announcements');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'テストお知らせ',
          category: 'info',
        })
      );
      expect(newId).toBe('new-announcement-id');
    });

    test('不具合カテゴリのお知らせが正しく作成されること', async () => {
      const mockData = {
        title: '不具合お知らせ',
        content: '不具合内容',
        category: 'bug' as const,
        status: 'published' as const,
        publishedAt: new Date(),
        authorId: 'admin-uid',
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'bug-announcement-id' },
        error: null,
      });

      const newId = await createAnnouncement(mockData);

      expect(newId).toBe('bug-announcement-id');
    });

    test('重要カテゴリのお知らせが正しく作成されること', async () => {
      const mockData = {
        title: '重要お知らせ',
        content: '重要内容',
        category: 'important' as const,
        status: 'published' as const,
        publishedAt: new Date(),
        authorId: 'admin-uid',
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'important-announcement-id' },
        error: null,
      });

      const newId = await createAnnouncement(mockData);

      expect(newId).toBe('important-announcement-id');
    });
  });

  describe('getAnnouncements', () => {
    test('一般向け公開お知らせを降順で取得できること（ページング対応）', async () => {
      const mockRow = makeAnnouncementRow('announcement-1', 'お知らせ1', 'update');

      mockSupabase.then.mockImplementationOnce((onFulfilled: any) => {
        return Promise.resolve({ data: [mockRow], error: null }).then(onFulfilled);
      });

      const res = await getAnnouncements(10);

      expect(mockSupabase.from).toHaveBeenCalledWith('announcements');
      expect(res.items).toHaveLength(1);
      expect(res.items[0].id).toBe('announcement-1');
      expect(res.items[0].status).toBe('published');
      expect(res.lastVisible).toBe(mockRow.published_at);
    });
  });

  describe('getUnreadAnnouncementsCount', () => {
    test('未読のお知らせ件数を正しくカウントできること', async () => {
      const mockRows = [
        { id: 'ann-1' },
        { id: 'ann-2' },
        { id: 'ann-3' },
      ];

      mockSupabase.then.mockImplementationOnce((onFulfilled: any) => {
        return Promise.resolve({ data: mockRows, error: null }).then(onFulfilled);
      });

      const lastReadAt = new Date('2026-06-21T00:00:00Z');
      const readIds = ['ann-1']; // ann-1 は既読
      const count = await getUnreadAnnouncementsCount(lastReadAt, readIds);

      expect(mockSupabase.from).toHaveBeenCalledWith('announcements');
      expect(mockSupabase.gt).toHaveBeenCalledWith('published_at', lastReadAt.toISOString());
      expect(count).toBe(2); // ann-2, ann-3 が未読
    });
  });

  describe('updateAnnouncement', () => {
    test('お知らせを更新できること', async () => {
      mockSupabase.then.mockImplementationOnce((onFulfilled: any) => {
        return Promise.resolve({ error: null }).then(onFulfilled);
      });

      await updateAnnouncement('announcement-1', { title: '更新タイトル' });

      expect(mockSupabase.from).toHaveBeenCalledWith('announcements');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ title: '更新タイトル' })
      );
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'announcement-1');
    });
  });

  describe('deleteAnnouncement', () => {
    test('お知らせを削除できること', async () => {
      mockSupabase.then.mockImplementationOnce((onFulfilled: any) => {
        return Promise.resolve({ error: null }).then(onFulfilled);
      });

      await deleteAnnouncement('announcement-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('announcements');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'announcement-1');
    });
  });
});
