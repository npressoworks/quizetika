import { 
  getNotifications, 
  markAsRead, 
  createNotification 
} from '../../src/services/notification';
import { getDocs, updateDoc, addDoc } from 'firebase/firestore';

// Firebase Firestore モック
jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    getDocs: jest.fn(),
    doc: jest.fn((ref, ...paths) => ({ id: paths[paths.length - 1] || 'mock-notif-id' })),
    addDoc: jest.fn(),
    updateDoc: jest.fn(),
  };
});

describe('NotificationService', () => {
  const userId = 'user-uid';

  beforeEach(() => {
    jest.clearAllMocks();
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
    test('ユーザー宛ての通知一覧を降順で取得できること', async () => {
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
        {
          id: 'notif-2',
          data: () => ({
            userId,
            type: 'correction_resolved',
            senderId: 'sender-2',
            senderName: 'ユーザー2',
            senderAvatar: 'avatar-2',
            targetId: 'quiz-1',
            targetTitle: 'クイズタイトル',
            isRead: true,
            createdAt: { toDate: () => new Date('2026-05-29T09:00:00Z') },
          }),
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue({
        docs: mockDocs,
      });

      const list = await getNotifications(userId);

      expect(getDocs).toHaveBeenCalled();
      expect(list).toHaveLength(2);
      expect(list[0]).toEqual({
        id: 'notif-1',
        userId,
        type: 'follow',
        senderId: 'sender-1',
        senderName: 'ユーザー1',
        senderAvatar: 'avatar-1',
        isRead: false,
        createdAt: new Date('2026-05-29T10:00:00Z'),
      });
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
