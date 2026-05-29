import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  addDoc,
  updateDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';

export interface Notification {
  id: string;
  userId: string; // recipientId から userId へ仕様一元化
  type: 'follow' | 'bookmark' | 'correction_resolved' | 'badge_unlocked' | 'quiz_review_warning';
  senderId: string;
  senderName: string;
  senderAvatar: string;
  targetId?: string;
  targetTitle?: string;
  isRead: boolean;
  createdAt: Date;
}

const notificationsCollection = collection(db, 'notifications');

/**
 * ユーザー宛ての通知一覧を降順で取得
 */
export async function getNotifications(userId: string): Promise<Notification[]> {
  const q = query(
    notificationsCollection,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      userId: data.userId,
      type: data.type,
      senderId: data.senderId,
      senderName: data.senderName,
      senderAvatar: data.senderAvatar,
      targetId: data.targetId,
      targetTitle: data.targetTitle,
      isRead: data.isRead,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
    } as Notification;
  });
}

/**
 * 特定の通知を既読にする
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const docRef = doc(notificationsCollection, notificationId);
  await updateDoc(docRef, {
    isRead: true
  });
}

// 後方互換性用の別名
export { markAsRead as markNotificationAsRead };

/**
 * 新規通知を登録する
 */
export async function createNotification(
  notificationData: Omit<Notification, 'id' | 'createdAt' | 'isRead'>
): Promise<string> {
  const payload: Omit<Notification, 'id'> = {
    ...notificationData,
    isRead: false,
    createdAt: new Date(),
  };

  const docRef = await addDoc(notificationsCollection, payload);
  return docRef.id;
}
