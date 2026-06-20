import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  getDoc,
  doc, 
  addDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { Announcement } from '../types';

const announcementsCollection = collection(db, 'announcements');

function mapDocToAnnouncement(docSnap: any): Announcement {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    title: data.title,
    content: data.content,
    category: data.category,
    status: data.status,
    publishedAt: data.publishedAt?.toDate ? data.publishedAt.toDate() : (data.publishedAt ? new Date(data.publishedAt) : null),
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
    authorId: data.authorId,
  };
}

/**
 * 一般ユーザー向け: 公開済みのお知らせ一覧を降順で取得
 */
export async function getAnnouncements(limitCount?: number): Promise<Announcement[]> {
  let q = query(
    announcementsCollection,
    where('status', '==', 'published'),
    orderBy('publishedAt', 'desc')
  );
  
  if (limitCount && limitCount > 0) {
    const { limit } = require('firebase/firestore');
    q = query(q, limit(limitCount));
  }

  const snap = await getDocs(q);
  return snap.docs.map(mapDocToAnnouncement);
}

/**
 * 特定のお知らせをIDで取得
 */
export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  const docRef = doc(announcementsCollection, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return mapDocToAnnouncement(docSnap);
}

/**
 * 管理者向け: すべてのお知らせ（下書き含む）を降順で取得
 */
export async function adminGetAnnouncements(): Promise<Announcement[]> {
  const q = query(
    announcementsCollection,
    orderBy('createdAt', 'desc')
  );

  const snap = await getDocs(q);
  return snap.docs.map(mapDocToAnnouncement);
}

/**
 * 新規お知らせを作成
 */
export async function createAnnouncement(
  announcementData: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date();
  const payload = {
    ...announcementData,
    publishedAt: announcementData.status === 'published' ? (announcementData.publishedAt || now) : null,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(announcementsCollection, payload);
  return docRef.id;
}

/**
 * お知らせを更新
 */
export async function updateAnnouncement(
  id: string,
  announcementData: Partial<Announcement>
): Promise<void> {
  const now = new Date();
  const docRef = doc(announcementsCollection, id);
  
  const payload: Record<string, any> = {
    ...announcementData,
    updatedAt: now,
  };

  if (announcementData.status === 'published') {
    payload.publishedAt = announcementData.publishedAt || now;
  } else if (announcementData.status === 'draft') {
    payload.publishedAt = null;
  }

  delete payload.id;
  delete payload.createdAt;

  await updateDoc(docRef, payload);
}

/**
 * お知らせを削除
 */
export async function deleteAnnouncement(id: string): Promise<void> {
  const docRef = doc(announcementsCollection, id);
  await deleteDoc(docRef);
}
