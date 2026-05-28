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
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { usersRef, followsRef } from '../lib/firebase/firestore';
import { User, Follow, Badge } from '../types';

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
   バッジ定義 (マイルストーン称号)
   ========================================================================== */

/**
 * バッジ付与条件の定義
 * 各バッジは特定の数値条件（プレイ数・作成数・フォロワー数）を持つ
 */
interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  iconName: string;
  condition: (user: User) => boolean;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ── プレイ回数バッジ ──────────────────────────────────────
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
  // ── 作成数バッジ ──────────────────────────────────────────
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
  // ── フォロワー数バッジ ────────────────────────────────────
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

/**
 * プロフィール更新のバリデーションエラー型
 */
export interface ProfileValidationError {
  field: 'displayName' | 'bio';
  message: string;
}

/**
 * プロフィール更新データ型
 */
export interface UpdateProfileData {
  displayName: string;
  bio: string;
  followedGenres?: string[];
}

/**
 * プロフィール入力値をバリデートする
 * @returns エラーがなければ空配列、エラーがあればエラー一覧を返す
 */
export function validateProfileData(data: UpdateProfileData): ProfileValidationError[] {
  const errors: ProfileValidationError[] = [];

  // 表示名: 1文字以上30文字以下
  const trimmedName = data.displayName.trim();
  if (!trimmedName) {
    errors.push({ field: 'displayName', message: '表示名は必須です' });
  } else if (trimmedName.length > 30) {
    errors.push({ field: 'displayName', message: '表示名は30文字以内で入力してください' });
  }

  // 自己紹介: 200文字以下
  if (data.bio.length > 200) {
    errors.push({ field: 'bio', message: '自己紹介は200文字以内で入力してください' });
  }

  return errors;
}

/**
 * ユーザープロフィールを更新する（バリデーション付き）
 * @param uid Firebase Auth の UID
 * @param data 更新データ（displayName, bio, followedGenres）
 * @throws バリデーションエラーまたは Firestore エラー
 */
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

/**
 * ユーザーの現在の統計情報をもとにバッジ条件を評価し、
 * 未付与のバッジをトランザクションでアトミックに `users.badges` へ追加する。
 * @param uid Firebase Auth の UID
 * @returns 新たに付与されたバッジの配列（0件の場合は空配列）
 */
export async function checkAndAwardBadges(uid: string): Promise<Badge[]> {
  const docRef = doc(usersRef, uid);

  const newlyAwarded: Badge[] = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) {
      throw new Error(`ユーザーが見つかりません: uid=${uid}`);
    }

    const user = snap.data() as User;
    // 既に付与済みのバッジIDセットを作成（重複付与防止）
    const existingBadgeIds = new Set(user.badges.map((b) => b.id));

    // 条件を満たし、かつ未付与のバッジを抽出
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

    // arrayUnion を使い、他フィールドを変更せずにバッジのみをアトミックに追加
    transaction.update(docRef, {
      badges: arrayUnion(...badgesToAward),
      updatedAt: now,
    });

    return badgesToAward;
  });

  return newlyAwarded;
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
 * ユーザーをフォローする（フォロワー数・フォロー数をアトミック漏更新）
 * @returns フォロー登録が新規の場合 true、既にフォロー済みの場合 false
 */
export async function followUser(followerId: string, followingId: string): Promise<{ isFollowing: boolean }> {
  if (followerId === followingId) return { isFollowing: false }; // 自分自身はフォロー不可

  const docId = getFollowDocId(followerId, followingId);
  const followDocRef = doc(followsRef, docId);
  const followerUserRef = doc(usersRef, followerId);
  const followingUserRef = doc(usersRef, followingId);

  await runTransaction(db, async (transaction) => {
    const existingSnap = await transaction.get(followDocRef);
    if (existingSnap.exists()) {
      // 既にフォロー済みの場合は何もしない
      return;
    }

    const followData: Follow = {
      id: docId,
      followerId,
      followingId,
      createdAt: new Date(),
    };
    transaction.set(followDocRef, followData as any);

    // フォロワー・フォローイング数をアトミックに更新
    transaction.update(followerUserRef, { followingCount: increment(1), updatedAt: new Date() });
    transaction.update(followingUserRef, { followersCount: increment(1), updatedAt: new Date() });
  });

  return { isFollowing: true };
}

/**
 * ユーザーのフォローを解除する（フォロワー数・フォロー数をアトミック漏更新）
 */
export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const docId = getFollowDocId(followerId, followingId);
  const followDocRef = doc(followsRef, docId);
  const followerUserRef = doc(usersRef, followerId);
  const followingUserRef = doc(usersRef, followingId);

  await runTransaction(db, async (transaction) => {
    const existingSnap = await transaction.get(followDocRef);
    if (!existingSnap.exists()) return; // またはフォローしていない場合は何もしない

    transaction.delete(followDocRef);
    transaction.update(followerUserRef, { followingCount: increment(-1), updatedAt: new Date() });
    transaction.update(followingUserRef, { followersCount: increment(-1), updatedAt: new Date() });
  });
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
