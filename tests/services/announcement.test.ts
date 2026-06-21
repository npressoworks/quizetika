import { 
  getAnnouncements, 
  adminGetAnnouncements, 
  getAnnouncementById,
  createAnnouncement, 
  updateAnnouncement, 
  deleteAnnouncement,
  getUnreadAnnouncementsCount
} from '../../src/services/announcement';
import { getDocs, updateDoc, addDoc, deleteDoc, getCountFromServer } from 'firebase/firestore';

// Firebase Firestore モック
jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
    doc: jest.fn((ref, ...paths) => ({ id: paths[paths.length - 1] || 'mock-announcement-id' })),
    addDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    startAfter: jest.fn(),
    count: jest.fn(),
    getCountFromServer: jest.fn(),
  };
});

describe('AnnouncementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      (addDoc as jest.Mock).mockResolvedValue({ id: 'new-announcement-id' });

      const newId = await createAnnouncement(mockData);

      expect(addDoc).toHaveBeenCalled();
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

      (addDoc as jest.Mock).mockResolvedValue({ id: 'bug-announcement-id' });

      const newId = await createAnnouncement(mockData);

      expect(addDoc).toHaveBeenCalled();
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

      (addDoc as jest.Mock).mockResolvedValue({ id: 'important-announcement-id' });

      const newId = await createAnnouncement(mockData);

      expect(addDoc).toHaveBeenCalled();
      expect(newId).toBe('important-announcement-id');
    });
  });

  describe('getAnnouncements', () => {
    test('一般向け公開お知らせを降順で取得できること（ページング対応）', async () => {
      const mockDocs = [
        {
          id: 'announcement-1',
          data: () => ({
            title: 'お知らせ1',
            content: '本文1',
            category: 'update',
            status: 'published',
            publishedAt: { toDate: () => new Date('2026-06-20T10:00:00Z') },
            createdAt: { toDate: () => new Date('2026-06-20T10:00:00Z') },
            updatedAt: { toDate: () => new Date('2026-06-20T10:00:00Z') },
            authorId: 'admin-uid',
          }),
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue({
        docs: mockDocs,
      });

      const res = await getAnnouncements(10);

      expect(getDocs).toHaveBeenCalled();
      expect(res.items).toHaveLength(1);
      expect(res.items[0].id).toBe('announcement-1');
      expect(res.items[0].status).toBe('published');
      expect(res.lastVisible).toBeDefined();
    });
  });

  describe('getUnreadAnnouncementsCount', () => {
    test('未読のお知らせ件数を正しくカウントできること', async () => {
      (getCountFromServer as jest.Mock).mockResolvedValue({
        data: () => ({ count: 3 })
      });

      const lastReadAt = new Date('2026-06-21T00:00:00Z');
      const count = await getUnreadAnnouncementsCount(lastReadAt);

      expect(getCountFromServer).toHaveBeenCalled();
      expect(count).toBe(3);
    });
  });

  describe('updateAnnouncement', () => {
    test('お知らせを更新できること', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateAnnouncement('announcement-1', { title: '更新タイトル' });

      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe('deleteAnnouncement', () => {
    test('お知らせを削除できること', async () => {
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      await deleteAnnouncement('announcement-1');

      expect(deleteDoc).toHaveBeenCalled();
    });
  });
});
