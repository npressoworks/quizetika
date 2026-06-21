import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  addDoc,
  updateDoc,
  QueryDocumentSnapshot,
  startAfter,
  getCountFromServer,
  writeBatch
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

export interface PaginatedNotifications {
  items: Notification[];
  lastVisible: QueryDocumentSnapshot | null;
}

/**
 * ユーザー宛ての通知一覧を降順で取得（ページング対応）
 */
export async function getNotifications(
  userId: string,
  limitCount?: number,
  startAfterDoc?: QueryDocumentSnapshot | null
): Promise<PaginatedNotifications> {
  let q = query(
    notificationsCollection,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  if (startAfterDoc) {
    q = query(q, startAfter(startAfterDoc));
  }
  
  if (limitCount && limitCount > 0) {
    const { limit } = require('firebase/firestore');
    q = query(q, limit(limitCount));
  }
  
  const snap = await getDocs(q);
  const items = snap.docs.map(docSnap => {
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
  
  const lastVisible = snap.docs.length > 0 ? (snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot) : null;
  
  return { items, lastVisible };
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

/**
 * ユーザーの未読通知件数を取得
 */
export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const q = query(
    notificationsCollection,
    where('userId', '==', userId),
    where('isRead', '==', false)
  );
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

/**
 * ユーザーのすべての未読通知を一括で既読にする
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const q = query(
    notificationsCollection,
    where('userId', '==', userId),
    where('isRead', '==', false)
  );
  const snap = await getDocs(q);
  if (snap.docs.length === 0) return;
  
  const batch = writeBatch(db);
  snap.docs.forEach(docSnap => {
    batch.update(docSnap.ref, { isRead: true });
  });
  await batch.commit();
}
