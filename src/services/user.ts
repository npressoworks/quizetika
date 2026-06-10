import {
  doc,
  documentId,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  getDocs,
  arrayUnion,
  arrayRemove,
  runTransaction,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { usersRef, followsRef, quizzesRef } from '../lib/firebase/firestore';
import { auth } from '../lib/firebase/config';
import { User, Follow, Badge } from '../types';
import { resolveSubscriptionTier } from '@/lib/subscription-plans';
import { deleteImage } from './storage';

/**
 * プロフィール更新データ型
 */
export interface UpdateProfileData {
  displayName: string;
  bio: string;
  followedGenres?: string[];
}

/**
 * プロフィール更新のバリデーションエラー型
 */
export interface ProfileValidationError {
  field: 'displayName' | 'bio';
  message: string;
}

/**
 * Firestore から読み取ったユーザーレコードを正規化する
 */
export function normalizeUserRecord(user: User): User {
  return {
    ...user,
    subscriptionTier: resolveSubscriptionTier(user.subscriptionTier),
  };
}

/**
 * ユーザープロフィール情報を取得
 * @param uid Firebase Auth UID
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  const docRef = doc(usersRef, uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return normalizeUserRecord(snap.data() as User);
}

/**
 * ユーザープロフィールを更新する（バリデーション付き）
 */
export async function updateUserProfile(uid: string, updates: Partial<User>): Promise<void> {
  const docRef = doc(usersRef, uid);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date(),
  });
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

// 既存の互換用スタブ
export { getUserProfile as getUser };
export { updateUserProfile as updateUser };

/* ==========================================================================
   バッジ定義 (マイルストーン称号)
   ========================================================================== */

interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  iconName: string;
  condition: (user: User) => boolean;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'play_10',
    title: '初挑戦者',
    description: '10回クイズに挑戦した',
    iconName: 'play-circle',
    condition: (u) => u.totalPlayCount >= 10,
  },
  {
    id: 'play_50',
    title: '常連プレイヤー',
    description: '50回クイズに挑戦した',
    iconName: 'zap',
    condition: (u) => u.totalPlayCount >= 50,
  },
  {
    id: 'play_100',
    title: '百戦錬磨',
    description: '100回クイズに挑戦した',
    iconName: 'star',
    condition: (u) => u.totalPlayCount >= 100,
  },
  {
    id: 'play_500',
    title: 'クイズ狂',
    description: '500回クイズに挑戦した',
    iconName: 'award',
    condition: (u) => u.totalPlayCount >= 500,
  },
  {
    id: 'play_1000',
    title: 'レジェンドプレイヤー',
    description: '1000回クイズに挑戦した',
    iconName: 'crown',
    condition: (u) => u.totalPlayCount >= 1000,
  },
  {
    id: 'create_1',
    title: 'クイズクリエイター',
    description: '初めてクイズを公開した',
    iconName: 'pencil',
    condition: (u) => u.createdQuizzesCount >= 1,
  },
  {
    id: 'create_10',
    title: '多作クリエイター',
    description: '10個のクイズを公開した',
    iconName: 'book-open',
    condition: (u) => u.createdQuizzesCount >= 10,
  },
  {
    id: 'create_50',
    title: '知識の伝道師',
    description: '50個のクイズを公開した',
    iconName: 'library',
    condition: (u) => u.createdQuizzesCount >= 50,
  },
  {
    id: 'followers_10',
    title: '人気者',
    description: '10人にフォローされた',
    iconName: 'users',
    condition: (u) => u.followersCount >= 10,
  },
  {
    id: 'followers_100',
    title: 'インフルエンサー',
    description: '100人にフォローされた',
    iconName: 'trending-up',
    condition: (u) => u.followersCount >= 100,
  },
  {
    id: 'followers_1000',
    title: 'クイズ界のスター',
    description: '1000人にフォローされた',
    iconName: 'sparkles',
    condition: (u) => u.followersCount >= 1000,
  },
];

/* ==========================================================================
   プロフィール更新 (バリデーション付き)
   ========================================================================== */

export function validateProfileData(data: UpdateProfileData): ProfileValidationError[] {
  const errors: ProfileValidationError[] = [];

  const trimmedName = data.displayName.trim();
  if (!trimmedName) {
    errors.push({ field: 'displayName', message: '表示名は必須です' });
  } else if (trimmedName.length > 30) {
    errors.push({ field: 'displayName', message: '表示名は30文字以内で入力してください' });
  }

  if (data.bio.length > 200) {
    errors.push({ field: 'bio', message: '自己紹介は200文字以内で入力してください' });
  }

  return errors;
}

export async function updateProfile(uid: string, data: UpdateProfileData): Promise<void> {
  const errors = validateProfileData(data);
  if (errors.length > 0) {
    throw new Error(
      `プロフィールのバリデーションに失敗しました: ${errors.map((e) => e.message).join(', ')}`
    );
  }

  const docRef = doc(usersRef, uid);
  const updateData: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> & { updatedAt: Date } = {
    displayName: data.displayName.trim(),
    bio: data.bio,
    updatedAt: new Date(),
  };

  if (data.followedGenres !== undefined) {
    updateData.followedGenres = data.followedGenres;
  }

  await updateDoc(docRef, updateData as any);
}

/* ==========================================================================
   バッジ付与 (アトミック)
   ========================================================================== */

export async function checkAndAwardBadges(uid: string): Promise<Badge[]> {
  const docRef = doc(usersRef, uid);

  const newlyAwarded: Badge[] = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) {
      throw new Error(`ユーザーが見つかりません: uid=${uid}`);
    }

    const user = snap.data() as User;
    const existingBadgeIds = new Set(user.badges.map((b) => b.id));

    const now = new Date();
    const badgesToAward: Badge[] = BADGE_DEFINITIONS.filter(
      (def) => def.condition(user) && !existingBadgeIds.has(def.id)
    ).map((def) => ({
      id: def.id,
      title: def.title,
      description: def.description,
      iconName: def.iconName,
      unlockedAt: now,
    }));

    if (badgesToAward.length === 0) {
      return [];
    }

    transaction.update(docRef, {
      badges: arrayUnion(...badgesToAward),
      updatedAt: now,
    });

    return badgesToAward;
  });

  return newlyAwarded;
}

/* ==========================================================================
   退会・アカウント削除 (セキュアサーバー委譲化)
   ========================================================================== */

/**
 * ユーザーアカウントの削除（退会）処理をセキュアなサーバーAPIに安全に一本化して委譲します。
 * クライアントのブラウザ環境でのバッチループを廃止し、データ不整合リスクを排除。
 */
export async function deleteUserAccount(uid: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/user/delete-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ uid }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || '退会処理のAPIリクエストに失敗しました。');
  }
}

/* ==========================================================================
   フォロー機能
   ========================================================================== */

function getFollowDocId(followerId: string, followingId: string): string {
  return `${followerId}_${followingId}`;
}

export async function followUser(followerId: string, followingId: string): Promise<{ isFollowing: boolean }> {
  if (followerId === followingId) return { isFollowing: false };

  const docId = getFollowDocId(followerId, followingId);
  const followDocRef = doc(followsRef, docId);
  const followerUserRef = doc(usersRef, followerId);
  const followingUserRef = doc(usersRef, followingId);

  await runTransaction(db, async (transaction) => {
    const existingSnap = await transaction.get(followDocRef);
    if (existingSnap.exists()) {
      return;
    }

    const followData: Follow = {
      id: docId,
      followerId,
      followingId,
      createdAt: new Date(),
    };
    transaction.set(followDocRef, followData as any);

    transaction.update(followerUserRef, { followingCount: increment(1), updatedAt: new Date() });
    transaction.update(followingUserRef, { followersCount: increment(1), updatedAt: new Date() });
  });

  return { isFollowing: true };
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const docId = getFollowDocId(followerId, followingId);
  const followDocRef = doc(followsRef, docId);
  const followerUserRef = doc(usersRef, followerId);
  const followingUserRef = doc(usersRef, followingId);

  await runTransaction(db, async (transaction) => {
    const existingSnap = await transaction.get(followDocRef);
    if (!existingSnap.exists()) return;

    transaction.delete(followDocRef);
    transaction.update(followerUserRef, { followingCount: increment(-1), updatedAt: new Date() });
    transaction.update(followingUserRef, { followersCount: increment(-1), updatedAt: new Date() });
  });
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const docId = getFollowDocId(followerId, followingId);
  const docRef = doc(followsRef, docId);
  const snap = await getDoc(docRef);
  return snap.exists();
}

export async function getFollowingUsers(userId: string): Promise<User[]> {
  const q = query(followsRef, where('followerId', '==', userId));
  const snap = await getDocs(q);
  
  const followingIds = snap.docs.map((doc) => doc.data().followingId);
  if (followingIds.length === 0) return [];
  
  const users: User[] = [];
  const chunkSize = 10;
  for (let i = 0; i < followingIds.length; i += chunkSize) {
    const chunk = followingIds.slice(i, i + chunkSize);
    const usersQuery = query(usersRef, where(documentId(), 'in', chunk));
    const usersSnap = await getDocs(usersQuery);
    usersSnap.forEach((doc) => users.push(doc.data()));
  }
  
  return users;
}

export async function getFollowerUsers(userId: string): Promise<User[]> {
  const q = query(followsRef, where('followingId', '==', userId));
  const snap = await getDocs(q);
  
  const followerIds = snap.docs.map((doc) => doc.data().followerId);
  if (followerIds.length === 0) return [];
  
  const users: User[] = [];
  const chunkSize = 10;
  for (let i = 0; i < followerIds.length; i += chunkSize) {
    const chunk = followerIds.slice(i, i + chunkSize);
    const usersQuery = query(usersRef, where(documentId(), 'in', chunk));
    const usersSnap = await getDocs(usersQuery);
    usersSnap.forEach((doc) => users.push(doc.data()));
  }
  
  return users;
}

/* ==========================================================================
   ジャンルフォロー機能
   ========================================================================== */

export async function followGenre(userId: string, genreName: string): Promise<void> {
  const docRef = doc(usersRef, userId);
  await updateDoc(docRef, {
    followedGenres: arrayUnion(genreName),
    updatedAt: new Date(),
  });
}

export async function unfollowGenre(userId: string, genreName: string): Promise<void> {
  const docRef = doc(usersRef, userId);
  await updateDoc(docRef, {
    followedGenres: arrayRemove(genreName),
    updatedAt: new Date(),
  });
}
