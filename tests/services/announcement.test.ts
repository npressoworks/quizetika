import { 
  getAnnouncements, 
  adminGetAnnouncements, 
  getAnnouncementById,
  createAnnouncement, 
  updateAnnouncement, 
  deleteAnnouncement 
} from '../../src/services/announcement';
import { getDocs, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';

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
  });

  describe('getAnnouncements', () => {
    test('一般向け公開お知らせを降順で取得できること', async () => {
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

      const list = await getAnnouncements();

      expect(getDocs).toHaveBeenCalled();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('announcement-1');
      expect(list[0].status).toBe('published');
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
