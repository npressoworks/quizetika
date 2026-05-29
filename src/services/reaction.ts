import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  doc,
  runTransaction,
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';

export interface Reaction {
  id: string;
  senderId: string;
  receiverId: string; // クイズ作成者
  quizId: string;
  quizTitle: string;
  type: 'like' | 'thank'; // リアクションのタイプ (いいね、感謝)
  createdAt: Date;
}

const reactionsCollection = collection(db, 'reactions');

/**
 * 作家へお礼のリアクション（いいね・感謝）をアトミックに送信
 */
export async function sendReaction(
  senderId: string,
  receiverId: string,
  quizId: string,
  type: 'like' | 'thank'
): Promise<void> {
  if (senderId === receiverId) return; // 自分自身には送信不可
  
  const reactionId = `${senderId}_${quizId}_${type}`;
  const reactionDocRef = doc(db, 'reactions', reactionId);
  const quizDocRef = doc(db, 'quizzes', quizId);
  const userDocRef = doc(db, 'users', receiverId);
  
  await runTransaction(db, async (transaction) => {
    // リアクションがすでに存在するかチェック
    const reactionSnap = await transaction.get(reactionDocRef);
    if (reactionSnap.exists()) {
      return; // 既に送信済みの場合は何もしない (冪等性維持)
    }
    
    // クイズ情報を取得してタイトルを得る
    const quizSnap = await transaction.get(quizDocRef);
    if (!quizSnap.exists()) {
      throw new Error(`Quiz with ID ${quizId} not found`);
    }
    const quizData = quizSnap.data();
    const quizTitle = quizData.title || '無題のクイズ';
    
    // リアクションを登録
    transaction.set(reactionDocRef, {
      senderId,
      receiverId,
      quizId,
      quizTitle,
      type,
      createdAt: new Date()
    });
    
    // 作家のユーザー情報を取得し、累計リアクション数をインクリメント
    const userSnap = await transaction.get(userDocRef);
    if (userSnap.exists()) {
      transaction.update(userDocRef, {
        totalReactionsCount: increment(1)
      });
    }
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
      receiverId: data.receiverId,
      quizId: data.quizId,
      quizTitle: data.quizTitle,
      type: data.type,
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
    where('receiverId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      senderId: data.senderId,
      receiverId: data.receiverId,
      quizId: data.quizId,
      quizTitle: data.quizTitle,
      type: data.type,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
    } as Reaction;
  });
}
