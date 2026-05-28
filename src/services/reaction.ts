import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';

export interface Reaction {
  id: string;
  senderId: string;
  recipientId: string;
  quizId: string;
  quizTitle: string;
  createdAt: Date;
}

const reactionsCollection = collection(db, 'reactions');

/**
 * 作家へお礼のリアクション（いいね・感謝）をアトミックに送信
 */
export async function sendReaction(
  senderId: string,
  recipientId: string,
  quizId: string,
  quizTitle: string
): Promise<void> {
  if (senderId === recipientId) return; // 自分自身には送信不可
  
  await addDoc(reactionsCollection, {
    senderId,
    recipientId,
    quizId,
    quizTitle,
    createdAt: new Date()
  });
}

/**
 * 自分が送ったリアクション履歴を取得 (降順)
 */
export async function getSentReactions(userId: string): Promise<Reaction[]> {
  const q = query(
    reactionsCollection,
    where('senderId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      senderId: data.senderId,
      recipientId: data.recipientId,
      quizId: data.quizId,
      quizTitle: data.quizTitle,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
    } as Reaction;
  });
}

/**
 * 自作クイズに貰ったリアクション履歴を取得 (降順)
 */
export async function getReceivedReactions(userId: string): Promise<Reaction[]> {
  const q = query(
    reactionsCollection,
    where('recipientId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      senderId: data.senderId,
      recipientId: data.recipientId,
      quizId: data.quizId,
      quizTitle: data.quizTitle,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
    } as Reaction;
  });
}
