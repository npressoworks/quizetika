import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { usersRef, followsRef } from '../lib/firebase/firestore';
import { User, Follow } from '../types';

/**
 * ユーザー情報を取得
 * @param userId Firebase Auth UID
 */
export async function getUser(userId: string): Promise<User | null> {
  const docRef = doc(usersRef, userId);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
}

/**
 * ユーザー情報を新規作成
 */
export async function createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<void> {
  const docRef = doc(usersRef, user.id);
  const now = new Date();
  const newUser: User = {
    ...user,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(docRef, newUser);
}

/**
 * ユーザー情報を更新
 */
export async function updateUser(userId: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const docRef = doc(usersRef, userId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date(),
  });
}

/* ==========================================================================
   フォロー機能 (ユーザー間)
   ========================================================================== */

/**
 * ユーザー間のフォローIDを生成
 */
function getFollowDocId(followerId: string, followingId: string): string {
  return `${followerId}_${followingId}`;
}

/**
 * ユーザーをフォローする
 */
export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return; // 自分自身はフォローできない
  
  const docId = getFollowDocId(followerId, followingId);
  const docRef = doc(followsRef, docId);
  
  const followData: Follow = {
    id: docId,
    followerId,
    followingId,
    createdAt: new Date(),
  };
  
  await setDoc(docRef, followData);
}

/**
 * ユーザーのフォローを解除する
 */
export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const docId = getFollowDocId(followerId, followingId);
  const docRef = doc(followsRef, docId);
  await deleteDoc(docRef);
}

/**
 * 特定のユーザーをフォローしているか判定
 */
export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const docId = getFollowDocId(followerId, followingId);
  const docRef = doc(followsRef, docId);
  const snap = await getDoc(docRef);
  return snap.exists();
}

/**
 * 特定のユーザーがフォローしているユーザーのリスト（Userオブジェクト）を取得
 */
export async function getFollowingUsers(userId: string): Promise<User[]> {
  const q = query(followsRef, where('followerId', '==', userId));
  const snap = await getDocs(q);
  
  const followingIds = snap.docs.map((doc) => doc.data().followingId);
  if (followingIds.length === 0) return [];
  
  // 10件ずつのバッチでユーザー情報を取得 (Firestore の IN クエリの制限が最大30件、歴史的には10件だったため、分割して並行取得)
  const users: User[] = [];
  const chunkSize = 10;
  for (let i = 0; i < followingIds.length; i += chunkSize) {
    const chunk = followingIds.slice(i, i + chunkSize);
    const usersQuery = query(usersRef, where('id', 'in', chunk));
    const usersSnap = await getDocs(usersQuery);
    usersSnap.forEach((doc) => users.push(doc.data()));
  }
  
  return users;
}

/**
 * 特定のユーザーをフォローしているフォロワーのリスト（Userオブジェクト）を取得
 */
export async function getFollowerUsers(userId: string): Promise<User[]> {
  const q = query(followsRef, where('followingId', '==', userId));
  const snap = await getDocs(q);
  
  const followerIds = snap.docs.map((doc) => doc.data().followerId);
  if (followerIds.length === 0) return [];
  
  const users: User[] = [];
  const chunkSize = 10;
  for (let i = 0; i < followerIds.length; i += chunkSize) {
    const chunk = followerIds.slice(i, i + chunkSize);
    const usersQuery = query(usersRef, where('id', 'in', chunk));
    const usersSnap = await getDocs(usersQuery);
    usersSnap.forEach((doc) => users.push(doc.data()));
  }
  
  return users;
}

/* ==========================================================================
   ジャンルフォロー機能
   ========================================================================== */

/**
 * 特定のジャンルをフォローする
 */
export async function followGenre(userId: string, genreName: string): Promise<void> {
  const docRef = doc(usersRef, userId);
  await updateDoc(docRef, {
    followedGenres: arrayUnion(genreName),
    updatedAt: new Date(),
  });
}

/**
 * 特定のジャンルのフォローを解除する
 */
export async function unfollowGenre(userId: string, genreName: string): Promise<void> {
  const docRef = doc(usersRef, userId);
  await updateDoc(docRef, {
    followedGenres: arrayRemove(genreName),
    updatedAt: new Date(),
  });
}
