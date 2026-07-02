import { createClient } from '../lib/supabase/client';
import { Database } from '../lib/supabase/database.types';

export interface Notification {
  id: string;
  userId: string; // recipientId から userId へ仕様一元化
  type: 'follow' | 'bookmark' | 'correction_resolved' | 'badge_unlocked' | 'quiz_review_warning' | 'correction_reported';
  senderId: string;
  senderName: string;
  senderAvatar: string;
  targetId?: string;
  targetTitle?: string;
  isRead: boolean;
  createdAt: Date;
}

const supabase = createClient();

export interface PaginatedNotifications {
  items: Notification[];
  lastVisible: any; // startAfterDoc / ページング用カーソル（created_at または id など）
}

function mapRowToNotification(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as Notification['type'],
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderAvatar: row.sender_avatar ?? '',
    targetId: row.target_id ?? undefined,
    targetTitle: row.target_title ?? undefined,
    isRead: row.is_read,
    createdAt: new Date(row.created_at),
  };
}

/**
 * ユーザー宛ての通知一覧を降順で取得（ページング対応）
 */
export async function getNotifications(
  userId: string,
  limitCount?: number,
  startAfterDoc?: any // テスト互換性を考慮して any。FirebaseのQueryDocumentSnapshotまたは作成日時のISO文字列
): Promise<PaginatedNotifications> {
  let queryBuilder = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (startAfterDoc) {
    // startAfterDocがQueryDocumentSnapshotライクなオブジェクトの場合、createdAtの値を抽出
    let cursorTime: string;
    if (typeof startAfterDoc === 'object') {
      const data = typeof startAfterDoc.data === 'function' ? startAfterDoc.data() : startAfterDoc;
      const rawCreatedAt = data.createdAt || data.created_at;
      if (rawCreatedAt instanceof Date) {
        cursorTime = rawCreatedAt.toISOString();
      } else if (typeof rawCreatedAt === 'object' && typeof rawCreatedAt.toDate === 'function') {
        cursorTime = rawCreatedAt.toDate().toISOString();
      } else {
        cursorTime = new Date(rawCreatedAt).toISOString();
      }
    } else {
      cursorTime = new Date(startAfterDoc).toISOString();
    }
    queryBuilder = queryBuilder.lt('created_at', cursorTime);
  }

  if (limitCount && limitCount > 0) {
    queryBuilder = queryBuilder.limit(limitCount);
  }

  const { data, error } = await queryBuilder;

  if (error || !data) {
    return { items: [], lastVisible: null };
  }

  const items = data.map(mapRowToNotification);
  // 次のページの取得に使うため、最後のドキュメント（または作成日時）を返す
  const lastVisible = data.length > 0 ? data[data.length - 1].created_at : null;

  return { items, lastVisible };
}

/**
 * 特定の通知を既読にする
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    throw new Error(`通知の既読処理に失敗しました: ${error.message}`);
  }
}

// 後方互換性用の別名
export { markAsRead as markNotificationAsRead };

/**
 * 新規通知を登録する
 */
export async function createNotification(
  notificationData: Omit<Notification, 'id' | 'createdAt' | 'isRead'>
): Promise<string> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: notificationData.userId,
      type: notificationData.type,
      sender_id: notificationData.senderId,
      sender_name: notificationData.senderName,
      sender_avatar: notificationData.senderAvatar,
      target_id: notificationData.targetId ?? null,
      target_title: notificationData.targetTitle ?? null,
      is_read: false,
      created_at: new Date().toISOString(),
    } as any)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`通知の作成に失敗しました: ${error?.message}`);
  }
  return data.id;
}

/**
 * ユーザーの未読通知件数を取得
 */
export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    throw new Error(`未読通知件数の取得に失敗しました: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * ユーザーのすべての未読通知を一括で既読にする
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    throw new Error(`通知の一括既読処理に失敗しました: ${error.message}`);
  }
}
