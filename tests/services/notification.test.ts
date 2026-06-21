import { 
  getNotifications, 
  markAsRead, 
  createNotification,
  getUnreadNotificationsCount,
  markAllNotificationsAsRead
} from '../../src/services/notification';
import { getDocs, updateDoc, addDoc, getCountFromServer, writeBatch } from 'firebase/firestore';

const mockBatch = {
  update: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
};

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
    doc: jest.fn((ref, ...paths) => ({ id: paths[paths.length - 1] || 'mock-notif-id' })),
    addDoc: jest.fn(),
    updateDoc: jest.fn(),
    startAfter: jest.fn(),
    count: jest.fn(),
    getCountFromServer: jest.fn(),
    writeBatch: jest.fn(() => mockBatch),
  };
});

describe('NotificationService', () => {
  const userId = 'user-uid';

  beforeEach(() => {
    jest.clearAllMocks();
    mockBatch.update.mockClear();
    mockBatch.commit.mockClear();
  });

  describe('createNotification', () => {
    test('新規通知が正しく作成されること', async () => {
      const mockNotifData = {
        userId,
        type: 'follow' as const,
        senderId: 'sender-uid',
        senderName: '山田太郎',
        senderAvatar: 'https://example.com/avatar.png',
        targetId: 'sender-uid',
      };

      (addDoc as jest.Mock).mockResolvedValue({ id: 'new-notif-id' });

      const newId = await createNotification(mockNotifData);

      expect(addDoc).toHaveBeenCalled();
      expect(newId).toBe('new-notif-id');
    });
  });

  describe('getNotifications', () => {
    test('ユーザー宛ての通知一覧を降順で取得できること（ページング対応）', async () => {
      const mockDocs = [
        {
          id: 'notif-1',
          data: () => ({
            userId,
            type: 'follow',
            senderId: 'sender-1',
            senderName: 'ユーザー1',
            senderAvatar: 'avatar-1',
            isRead: false,
            createdAt: { toDate: () => new Date('2026-05-29T10:00:00Z') },
          }),
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue({
        docs: mockDocs,
      });

      const res = await getNotifications(userId, 10);

      expect(getDocs).toHaveBeenCalled();
      expect(res.items).toHaveLength(1);
      expect(res.items[0]).toEqual({
        id: 'notif-1',
        userId,
        type: 'follow',
        senderId: 'sender-1',
        senderName: 'ユーザー1',
        senderAvatar: 'avatar-1',
        isRead: false,
        createdAt: new Date('2026-05-29T10:00:00Z'),
      });
      expect(res.lastVisible).toBeDefined();
    });
  });

  describe('getUnreadNotificationsCount', () => {
    test('未読の通知件数を正しくカウントできること', async () => {
      (getCountFromServer as jest.Mock).mockResolvedValue({
        data: () => ({ count: 5 })
      });

      const count = await getUnreadNotificationsCount(userId);

      expect(getCountFromServer).toHaveBeenCalled();
      expect(count).toBe(5);
    });
  });

  describe('markAllNotificationsAsRead', () => {
    test('すべての未読通知を一括で既読にできること', async () => {
      const mockDocs = [
        { id: 'notif-1', ref: 'doc-ref-1' },
        { id: 'notif-2', ref: 'doc-ref-2' },
      ];

      (getDocs as jest.Mock).mockResolvedValue({
        docs: mockDocs,
      });

      await markAllNotificationsAsRead(userId);

      expect(getDocs).toHaveBeenCalled();
      expect(writeBatch).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    test('指定された通知を既読に更新できること', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await markAsRead('notif-1');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'notif-1' }),
        { isRead: true }
      );
    });
  });
});
