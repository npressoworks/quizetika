import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';

export interface Notification {
  id: string;
  recipientId: string;
  type: 'follow' | 'issue_resolved' | 'content_deleted' | 'bookmark';
  quizId?: string;
  quizTitle?: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  message: string;
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
    where('recipientId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      recipientId: data.recipientId,
      type: data.type,
      quizId: data.quizId,
      quizTitle: data.quizTitle,
      senderId: data.senderId,
      senderName: data.senderName,
      senderAvatar: data.senderAvatar,
      message: data.message,
      isRead: data.isRead,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
    } as Notification;
  });
}

/**
 * 特定の通知を既読にする
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const docRef = doc(notificationsCollection, notificationId);
  await updateDoc(docRef, {
    isRead: true
  });
}
