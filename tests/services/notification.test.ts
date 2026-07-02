import { 
  getNotifications, 
  markAsRead, 
  createNotification,
  getUnreadNotificationsCount,
  markAllNotificationsAsRead
} from '../../src/services/notification';

// Supabase クライアントのモックを作成
jest.mock('@/lib/supabase/client', () => {
  const mock = {
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    order: jest.fn(() => mock),
    limit: jest.fn(() => mock),
    lt: jest.fn(() => mock),
    update: jest.fn(() => mock),
    insert: jest.fn(() => mock),
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

function makeNotificationRow(id: string, userId: string, type: string, senderName: string, isRead = false) {
  return {
    id,
    user_id: userId,
    type,
    sender_id: 'sender-uid',
    sender_name: senderName,
    sender_avatar: 'https://example.com/avatar.png',
    target_id: 'target-1',
    target_title: 'Target Title',
    is_read: isRead,
    created_at: new Date('2026-05-29T10:00:00Z').toISOString(),
  };
}

describe('NotificationService', () => {
  const userId = 'user-uid';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.limit.mockReturnValue(mockSupabase);
    mockSupabase.lt.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.single.mockResolvedValue({ data: null, error: null });
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

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'new-notif-id' },
        error: null,
      });

      const newId = await createNotification(mockNotifData);

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          type: 'follow',
          sender_name: '山田太郎',
        })
      );
      expect(newId).toBe('new-notif-id');
    });
  });

  describe('getNotifications', () => {
    test('ユーザー宛ての通知一覧を降順で取得できること（ページング対応）', async () => {
      const mockRow = makeNotificationRow('notif-1', userId, 'follow', 'ユーザー1');

      // Thenable mock
      mockSupabase.then.mockImplementationOnce((onFulfilled: any) => {
        return Promise.resolve({ data: [mockRow], error: null }).then(onFulfilled);
      });

      const res = await getNotifications(userId, 10);

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(res.items).toHaveLength(1);
      expect(res.items[0]).toEqual({
        id: 'notif-1',
        userId,
        type: 'follow',
        senderId: 'sender-uid',
        senderName: 'ユーザー1',
        senderAvatar: 'https://example.com/avatar.png',
        targetId: 'target-1',
        targetTitle: 'Target Title',
        isRead: false,
        createdAt: new Date('2026-05-29T10:00:00Z'),
      });
      expect(res.lastVisible).toBe(mockRow.created_at);
    });
  });

  describe('getUnreadNotificationsCount', () => {
    test('未読の通知件数を正しくカウントできること', async () => {
      mockSupabase.then.mockImplementationOnce((onFulfilled: any) => {
        return Promise.resolve({ count: 5, error: null }).then(onFulfilled);
      });

      const count = await getUnreadNotificationsCount(userId);

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabase.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(count).toBe(5);
    });
  });

  describe('markAllNotificationsAsRead', () => {
    test('すべての未読通知を一括で既読にできること', async () => {
      mockSupabase.then.mockImplementationOnce((onFulfilled: any) => {
        return Promise.resolve({ data: [], error: null }).then(onFulfilled);
      });

      await markAllNotificationsAsRead(userId);

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabase.update).toHaveBeenCalledWith({ is_read: true });
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_read', false);
    });
  });

  describe('markAsRead', () => {
    test('指定された通知を既読に更新できること', async () => {
      mockSupabase.then.mockImplementationOnce((onFulfilled: any) => {
        return Promise.resolve({ error: null }).then(onFulfilled);
      });

      await markAsRead('notif-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabase.update).toHaveBeenCalledWith({ is_read: true });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'notif-1');
    });
  });
});
