import { createClient } from '@/lib/supabase/client';
import { User, Follow, Badge } from '../types';
import { resolveSubscriptionTier } from '@/lib/subscription-plans';
import { Database } from '@/lib/supabase/database.types';
import { SupabaseClient } from '@supabase/supabase-js';

const supabase = createClient();

/**
 * プロフィール更新データ型
 */
export interface UpdateProfileData {
  displayName: string;
  bio: string;
  followedGenres?: string[];
  snsLinks?: {
    youtube?: string;
    x?: string;
    instagram?: string;
    tiktok?: string;
  };
}

/**
 * プロフィール更新のバリデーションエラー型
 */
export interface ProfileValidationError {
  field: 'displayName' | 'bio' | 'snsLinks.youtube' | 'snsLinks.x' | 'snsLinks.instagram' | 'snsLinks.tiktok';
  message: string;
}

/**
 * user_badges / user_genre_follows の JOIN 結果（正規化テーブル由来のユーザー関連データ）
 */
export interface UserRelations {
  badges: Badge[];
  followedGenres: string[];
}

const EMPTY_USER_RELATIONS: UserRelations = { badges: [], followedGenres: [] };

/**
 * データベースレコードからUser型オブジェクトへマッピングする
 * `badges` / `followedGenres` は正規化テーブル (`user_badges`, `user_genre_follows`) から
 * 別途取得した `relations` を注入する（black-box: 呼び出し元の型・形状は変更しない）
 */
export function mapRowToUser(
  row: Database['public']['Tables']['users']['Row'],
  relations: UserRelations = EMPTY_USER_RELATIONS
): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? '',
    bio: row.bio ?? '',
    followedGenres: relations.followedGenres,
    badges: relations.badges,
    createdQuizzesCount: row.created_quizzes_count ?? 0,
    totalPlayCount: row.total_play_count ?? 0,
    followersCount: row.followers_count ?? 0,
    followingCount: row.following_count ?? 0,
    reputationScore: row.reputation_score ?? 0,
    moderationTier: (row.moderation_tier as User['moderationTier']) ?? 'newcomer',
    role: row.role ?? undefined,
    reputationHistory: (row.reputation_history as any[])?.map((h) => ({
      eventId: h.eventId,
      delta: h.delta,
      reason: h.reason,
      createdAt: new Date(h.createdAt),
    })) ?? [],
    lastReputationCalculatedAt: row.last_reputation_calculated_at ? new Date(row.last_reputation_calculated_at) : null,
    totalFailedQuestionsCount: row.total_failed_questions_count ?? 0,
    deleteStatus: (row.delete_status as User['deleteStatus']) ?? 'active',
    isBanned: row.is_banned ?? undefined,
    bannedReason: row.banned_reason ?? undefined,
    bannedAt: row.banned_at ? new Date(row.banned_at) : undefined,
    subscriptionTier: row.subscription_tier as any,
    stripeCustomerId: row.stripe_customer_id ?? undefined,
    stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
    subscriptionStatus: row.subscription_status as any,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : undefined,
    snsLinks: (row.sns_links as User['snsLinks']) ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * User型オブジェクトの部分データからデータベースのアップデート用レコードへマッピングする
 */
export function mapUserToRow(user: Partial<User>): Database['public']['Tables']['users']['Update'] {
  const row: Database['public']['Tables']['users']['Update'] = {};
  if (user.id !== undefined) row.id = user.id;
  if (user.email !== undefined) row.email = user.email;
  if (user.displayName !== undefined) row.display_name = user.displayName;
  if (user.avatarUrl !== undefined) row.avatar_url = user.avatarUrl;
  if (user.bio !== undefined) row.bio = user.bio;
  if (user.createdQuizzesCount !== undefined) row.created_quizzes_count = user.createdQuizzesCount;
  if (user.totalPlayCount !== undefined) row.total_play_count = user.totalPlayCount;
  if (user.followersCount !== undefined) row.followers_count = user.followersCount;
  if (user.followingCount !== undefined) row.following_count = user.followingCount;
  if (user.reputationScore !== undefined) row.reputation_score = user.reputationScore;
  if (user.moderationTier !== undefined) row.moderation_tier = user.moderationTier;
  if (user.role !== undefined) row.role = user.role;
  if (user.reputationHistory !== undefined) row.reputation_history = user.reputationHistory as any;
  if (user.lastReputationCalculatedAt !== undefined) row.last_reputation_calculated_at = user.lastReputationCalculatedAt?.toISOString() ?? null;
  if (user.totalFailedQuestionsCount !== undefined) row.total_failed_questions_count = user.totalFailedQuestionsCount;
  if (user.deleteStatus !== undefined) row.delete_status = user.deleteStatus;
  if (user.isBanned !== undefined) row.is_banned = user.isBanned;
  if (user.bannedReason !== undefined) row.banned_reason = user.bannedReason;
  if (user.bannedAt !== undefined) row.banned_at = user.bannedAt?.toISOString() ?? null;
  if (user.subscriptionTier !== undefined) row.subscription_tier = user.subscriptionTier;
  if (user.stripeCustomerId !== undefined) row.stripe_customer_id = user.stripeCustomerId;
  if (user.stripeSubscriptionId !== undefined) row.stripe_subscription_id = user.stripeSubscriptionId;
  if (user.subscriptionStatus !== undefined) row.subscription_status = user.subscriptionStatus;
  if (user.currentPeriodEnd !== undefined) row.current_period_end = user.currentPeriodEnd?.toISOString() ?? null;
  if (user.snsLinks !== undefined) row.sns_links = user.snsLinks as any;
  if (user.createdAt !== undefined) row.created_at = user.createdAt.toISOString();
  if (user.updatedAt !== undefined) row.updated_at = user.updatedAt.toISOString();
  return row;
}

/**
 * ユーザーレコードを正規化する
 */
export function normalizeUserRecord(user: User): User {
  return {
    ...user,
    subscriptionTier: resolveSubscriptionTier(user.subscriptionTier),
  };
}

interface UserBadgeJoinRow {
  user_id?: string;
  badge_id: string;
  unlocked_at: string;
  badges: { title: string; description: string; icon_name: string } | null;
}

function mapBadgeJoinRow(row: UserBadgeJoinRow): Badge {
  return {
    id: row.badge_id,
    title: row.badges?.title ?? row.badge_id,
    description: row.badges?.description ?? '',
    iconName: row.badges?.icon_name ?? '',
    unlockedAt: new Date(row.unlocked_at),
  };
}

/** 単一ユーザーの user_badges / user_genre_follows を取得する */
async function fetchUserRelations(userId: string): Promise<UserRelations> {
  const [badgesResult, genresResult] = await Promise.all([
    supabase
      .from('user_badges')
      .select('badge_id, unlocked_at, badges(title, description, icon_name)')
      .eq('user_id', userId),
    supabase.from('user_genre_follows').select('genre_id').eq('user_id', userId),
  ]);

  const badges = ((badgesResult.data ?? []) as unknown as UserBadgeJoinRow[]).map(mapBadgeJoinRow);
  const followedGenres = (genresResult.data ?? []).map((row) => row.genre_id);
  return { badges, followedGenres };
}

/** 複数ユーザー分の user_badges / user_genre_follows を一括取得する（N+1 回避） */
async function fetchUserRelationsBulk(userIds: string[]): Promise<Map<string, UserRelations>> {
  const map = new Map<string, UserRelations>();
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return map;

  for (const id of uniqueIds) map.set(id, { badges: [], followedGenres: [] });

  const [badgesResult, genresResult] = await Promise.all([
    supabase
      .from('user_badges')
      .select('user_id, badge_id, unlocked_at, badges(title, description, icon_name)')
      .in('user_id', uniqueIds),
    supabase.from('user_genre_follows').select('user_id, genre_id').in('user_id', uniqueIds),
  ]);

  for (const row of (badgesResult.data ?? []) as unknown as UserBadgeJoinRow[]) {
    const entry = map.get(row.user_id!);
    entry?.badges.push(mapBadgeJoinRow(row));
  }
  for (const row of genresResult.data ?? []) {
    const entry = map.get(row.user_id);
    entry?.followedGenres.push(row.genre_id);
  }
  return map;
}

/**
 * ユーザープロフィール情報を取得
 * @param uid Auth UID
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', uid)
    .single();

  if (error || !data) return null;
  const relations = await fetchUserRelations(uid);
  return normalizeUserRecord(mapRowToUser(data, relations));
}

const USER_LEADERBOARD_SORT_COLUMNS = {
  reputationScore: 'reputation_score',
  totalPlayCount: 'total_play_count',
  createdQuizzesCount: 'created_quizzes_count',
} as const;

/**
 * プラットフォーム全体のユーザーランキングを指定した指標の降順で取得する。
 */
export async function getUserLeaderboard(
  sortBy: keyof typeof USER_LEADERBOARD_SORT_COLUMNS,
  limitCount: number = 10
): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order(USER_LEADERBOARD_SORT_COLUMNS[sortBy], { ascending: false })
    .limit(limitCount);

  if (error || !data) return [];
  return data.map((row) => mapRowToUser(row));
}

/**
 * ユーザープロフィールを更新する
 */
export async function updateUserProfile(uid: string, updates: Partial<User>): Promise<void> {
  const rowUpdates = mapUserToRow({
    ...updates,
    updatedAt: new Date(),
  });

  const { error } = await supabase
    .from('users')
    .update(rowUpdates)
    .eq('id', uid);

  if (error) {
    throw new Error(`ユーザープロフィールの更新に失敗しました: ${error.message}`);
  }
}

/**
 * ユーザー情報を新規作成
 */
export async function createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<void> {
  const now = new Date();
  const newUser: User = {
    ...user,
    createdAt: now,
    updatedAt: now,
  };

  const { error } = await supabase
    .from('users')
    .insert(mapUserToRow(newUser) as Database['public']['Tables']['users']['Insert']);

  if (error) {
    throw new Error(`ユーザーの作成に失敗しました: ${error.message}`);
  }
}

/**
 * メールアドレスからユーザープロフィール情報を取得
 * @param email メールアドレス
 */
export async function getUserProfileByEmail(email: string): Promise<User | null> {
  if (!email) return null;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) return null;
  const relations = await fetchUserRelations(data.id);
  return normalizeUserRecord(mapRowToUser(data, relations));
}

/**
 * ユーザーのUIDを更新する（開発環境用または不整合解消用）
 */
export async function updateUserUid(oldUid: string, newUid: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ id: newUid, updated_at: new Date().toISOString() })
    .eq('id', oldUid);

  if (error) {
    throw new Error(`ユーザーIDの更新に失敗しました: ${error.message}`);
  }
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

  if (data.snsLinks) {
    const snsDomains: Record<string, string[]> = {
      youtube: ['youtube.com', 'youtu.be'],
      x: ['x.com', 'twitter.com'],
      instagram: ['instagram.com'],
      tiktok: ['tiktok.com'],
    };

    for (const [key, value] of Object.entries(data.snsLinks)) {
      const fieldKey = `snsLinks.${key}` as 'snsLinks.youtube' | 'snsLinks.x' | 'snsLinks.instagram' | 'snsLinks.tiktok';
      
      if (!value || value.trim() === '') {
        continue;
      }

      let url: URL;
      try {
        url = new URL(value.trim());
      } catch (e) {
        errors.push({ field: fieldKey, message: '正しいURL形式で入力してください' });
        continue;
      }

      const hostname = url.hostname.toLowerCase();
      const allowedDomains = snsDomains[key];
      if (allowedDomains) {
        const isMatch = allowedDomains.some((domain) => {
          return hostname === domain || hostname.endsWith('.' + domain);
        });
        if (!isMatch) {
          errors.push({
            field: fieldKey,
            message: `${key}のリンクには許可されていないドメインです。`,
          });
        }
      }
    }
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

  const updates: Partial<User> = {
    displayName: data.displayName.trim(),
    bio: data.bio,
    updatedAt: new Date(),
  };

  if (data.snsLinks !== undefined) {
    const snsLinks: Record<string, string> = {};
    for (const [key, value] of Object.entries(data.snsLinks)) {
      if (value && value.trim() !== '') {
        snsLinks[key] = value.trim();
      }
    }
    updates.snsLinks = snsLinks;
  }

  await updateUserProfile(uid, updates);

  if (data.followedGenres !== undefined) {
    await syncFollowedGenres(uid, data.followedGenres);
  }
}

/* ==========================================================================
   バッジ付与 (アトミック)
   ========================================================================== */

export async function checkAndAwardBadges(uid: string): Promise<Badge[]> {
  const user = await getUserProfile(uid);
  if (!user) {
    throw new Error(`ユーザーが見つかりません: uid=${uid}`);
  }

  const existingBadgeIds = new Set(user.badges.map((b) => b.id));
  const now = new Date();
  const candidateBadges: Badge[] = BADGE_DEFINITIONS.filter(
    (def) => def.condition(user) && !existingBadgeIds.has(def.id)
  ).map((def) => ({
    id: def.id,
    title: def.title,
    description: def.description,
    iconName: def.iconName,
    unlockedAt: now,
  }));

  if (candidateBadges.length === 0) {
    return [];
  }

  // RPC関数の実行（user_badges への冪等な INSERT ... ON CONFLICT DO NOTHING）
  const { data: awardedIds, error } = await supabase.rpc('handle_check_and_award_badges', {
    p_user_id: uid,
    p_badge_ids: candidateBadges.map((b) => b.id),
  });

  if (error) {
    throw new Error(`バッジ獲得処理のRPC実行に失敗しました: ${error.message}`);
  }

  // RPC が実際に新規挿入したバッジIDのみを対象とする（同時実行時の二重付与を防ぐ）
  const awardedIdSet = new Set((awardedIds ?? []) as string[]);
  const badgesToAward = candidateBadges.filter((badge) => awardedIdSet.has(badge.id));

  // 新規バッジ獲得通知の作成
  for (const badge of badgesToAward) {
    try {
      await supabase.from('notifications').insert({
        user_id: uid,
        type: 'badge_unlocked',
        sender_id: 'system',
        sender_name: '運営',
        sender_avatar: '',
        target_id: badge.id,
        target_title: badge.title,
        is_read: false,
        created_at: new Date().toISOString(),
      } as any);
    } catch (err) {
      console.error('バッジ獲得通知の作成に失敗しました:', err);
    }
  }

  return badgesToAward;
}

/* ==========================================================================
   退会・アカウント削除 (セキュアサーバー委譲化)
   ========================================================================== */

/**
 * ユーザーアカウントの削除（退会）処理をセキュアなサーバーAPIに安全に一本化して委譲します。
 * クライアントのブラウザ環境でのバッチループを廃止し、データ不整合リスクを排除。
 */
export async function deleteUserAccount(uid: string): Promise<void> {
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token;
  
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

export async function followUser(followerId: string, followingId: string): Promise<{ isFollowing: boolean }> {
  if (followerId === followingId) return { isFollowing: false };

  // RPC関数の実行
  const { data: added, error } = await supabase.rpc('handle_follow_user', {
    p_follower_id: followerId,
    p_following_id: followingId,
  });

  if (error) {
    throw new Error(`フォロー処理のRPC実行に失敗しました: ${error.message}`);
  }

  if (added) {
    try {
      const sender = await getUserProfile(followerId);
      const senderName = sender?.displayName ?? 'ユーザー';
      const senderAvatar = sender?.avatarUrl ?? '';

      await supabase.from('notifications').insert({
        user_id: followingId,
        type: 'follow',
        sender_id: followerId,
        sender_name: senderName,
        sender_avatar: senderAvatar,
        target_id: followerId,
        is_read: false,
        created_at: new Date().toISOString(),
      } as any);
    } catch (err) {
      console.error('フォロー通知の作成に失敗しました:', err);
    }
  }

  return { isFollowing: true };
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return;

  const { error } = await supabase.rpc('handle_unfollow_user', {
    p_follower_id: followerId,
    p_following_id: followingId,
  });

  if (error) {
    throw new Error(`フォロー解除のRPC実行に失敗しました: ${error.message}`);
  }
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

async function hydrateUsers(rows: Database['public']['Tables']['users']['Row'][]): Promise<User[]> {
  const relationsMap = await fetchUserRelationsBulk(rows.map((row) => row.id));
  return rows.map((row) =>
    normalizeUserRecord(mapRowToUser(row, relationsMap.get(row.id)))
  );
}

export async function getFollowingUsers(userId: string): Promise<User[]> {
  const { data: followsData, error: followsError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (followsError || !followsData || followsData.length === 0) return [];

  const followingIds = followsData.map((f) => f.following_id);

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('*')
    .in('id', followingIds);

  if (usersError || !usersData) return [];

  return hydrateUsers(usersData);
}

export async function getFollowerUsers(userId: string): Promise<User[]> {
  const { data: followsData, error: followsError } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId);

  if (followsError || !followsData || followsData.length === 0) return [];

  const followerIds = followsData.map((f) => f.follower_id);

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('*')
    .in('id', followerIds);

  if (usersError || !usersData) return [];

  return hydrateUsers(usersData);
}

/* ==========================================================================
   ジャンルフォロー機能（正規化テーブル: user_genre_follows への単一行操作）
   ========================================================================== */

export async function followGenre(userId: string, genreId: string): Promise<void> {
  const { error } = await supabase
    .from('user_genre_follows')
    .upsert({ user_id: userId, genre_id: genreId }, { onConflict: 'user_id,genre_id' });

  if (error) {
    throw new Error(`ジャンルのフォローに失敗しました: ${error.message}`);
  }
}

export async function unfollowGenre(userId: string, genreId: string): Promise<void> {
  const { error } = await supabase
    .from('user_genre_follows')
    .delete()
    .eq('user_id', userId)
    .eq('genre_id', genreId);

  if (error) {
    throw new Error(`ジャンルのフォロー解除に失敗しました: ${error.message}`);
  }
}

/** プロフィール編集画面からの一括フォロージャンル置換（追加分 upsert・除去分 delete） */
async function syncFollowedGenres(userId: string, genreIds: string[]): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('user_genre_follows')
    .select('genre_id')
    .eq('user_id', userId);

  if (fetchError) {
    throw new Error(`フォロー中ジャンルの取得に失敗しました: ${fetchError.message}`);
  }

  const existingIds = new Set((existing ?? []).map((row) => row.genre_id));
  const nextIds = [...new Set(genreIds.filter(Boolean))];
  const nextIdSet = new Set(nextIds);
  const toDelete = [...existingIds].filter((id) => !nextIdSet.has(id));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('user_genre_follows')
      .delete()
      .eq('user_id', userId)
      .in('genre_id', toDelete);
    if (error) {
      throw new Error(`フォロー中ジャンルの削除に失敗しました: ${error.message}`);
    }
  }

  if (nextIds.length > 0) {
    const { error } = await supabase
      .from('user_genre_follows')
      .upsert(
        nextIds.map((genreId) => ({ user_id: userId, genre_id: genreId })),
        { onConflict: 'user_id,genre_id' }
      );
    if (error) {
      throw new Error(`フォロー中ジャンルの更新に失敗しました: ${error.message}`);
    }
  }
}

/**
 * 退会済みユーザーのデータを安全にクレンジングおよび匿名化する（Admin権限が必要）
 * @param customSupabase サーバー側で生成された Supabase Admin Client
 * @param uid 対象ユーザーのUID
 */
export async function cleanUpDeletedUser(customSupabase: SupabaseClient<Database>, uid: string): Promise<void> {
  if (!uid) {
    throw new Error('missing-uid');
  }

  // 1. leaderboard_entries の削除
  const { error: leaderboardError } = await customSupabase
    .from('leaderboard_entries')
    .delete()
    .eq('user_id', uid);
  if (leaderboardError) {
    console.error(`[cleanUpDeletedUser] leaderboard_entries 削除エラー:`, leaderboardError);
    throw leaderboardError;
  }

  // 2. follows の削除 (follower_id または following_id が uid)
  const { error: followsError } = await customSupabase
    .from('follows')
    .delete()
    .or(`follower_id.eq.${uid},following_id.eq.${uid}`);
  if (followsError) {
    console.error(`[cleanUpDeletedUser] follows 削除エラー:`, followsError);
    throw followsError;
  }

  // 3. bookmarks の削除
  const { error: bookmarksError } = await customSupabase
    .from('bookmarks')
    .delete()
    .eq('user_id', uid);
  if (bookmarksError) {
    console.error(`[cleanUpDeletedUser] bookmarks 削除エラー:`, bookmarksError);
    throw bookmarksError;
  }

  // 4. notifications の削除
  const { error: notificationsError } = await customSupabase
    .from('notifications')
    .delete()
    .eq('user_id', uid);
  if (notificationsError) {
    console.error(`[cleanUpDeletedUser] notifications 削除エラー:`, notificationsError);
    throw notificationsError;
  }

  // 5. quizzes の匿名化
  const { error: quizzesError } = await customSupabase
    .from('quizzes')
    .update({ author_name: '退会済ユーザー', author_avatar: null })
    .eq('author_id', uid);
  if (quizzesError) {
    console.error(`[cleanUpDeletedUser] quizzes 匿名化エラー:`, quizzesError);
    throw quizzesError;
  }

  // 6. questions の匿名化
  const { error: questionsError } = await customSupabase
    .from('questions')
    .update({ author_name: '退会済ユーザー', author_avatar: null })
    .eq('author_id', uid);
  if (questionsError) {
    console.error(`[cleanUpDeletedUser] questions 匿名化エラー:`, questionsError);
    throw questionsError;
  }

  // 7. user_badges の削除
  const { error: userBadgesError } = await customSupabase
    .from('user_badges')
    .delete()
    .eq('user_id', uid);
  if (userBadgesError) {
    console.error(`[cleanUpDeletedUser] user_badges 削除エラー:`, userBadgesError);
    throw userBadgesError;
  }

  // 8. user_genre_follows の削除
  const { error: genreFollowsError } = await customSupabase
    .from('user_genre_follows')
    .delete()
    .eq('user_id', uid);
  if (genreFollowsError) {
    console.error(`[cleanUpDeletedUser] user_genre_follows 削除エラー:`, genreFollowsError);
    throw genreFollowsError;
  }

  // 9. users の匿名化
  const { error: userError } = await customSupabase
    .from('users')
    .update({
      display_name: '退会済ユーザー',
      email: `deleted_${uid}@example.com`,
      avatar_url: null,
      bio: '',
      sns_links: {},
      delete_status: 'deleted',
      subscription_tier: 'free',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: null,
      current_period_end: null,
      reputation_score: 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', uid);

  if (userError) {
    console.error(`[cleanUpDeletedUser] users 匿名化エラー:`, userError);
    throw userError;
  }
}
