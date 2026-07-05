import { getUserProfile } from '@/services/user';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import type { User } from '@/types';

/**
 * 初期ジャンル投入前の権限検証（`is_admin()` RPC と同等の判定をクライアント側で事前確認する）
 */
export async function assertSeedGenresAccess(uid: string): Promise<User> {
  const user = await getUserProfile(uid);
  if (!user) {
    throw new Error(
      `users/${uid} が存在しません。ログイン後にプロフィールが作成されているか確認してください。`
    );
  }

  if (user.isBanned === true) {
    throw new Error('アカウントが停止（BAN）されているため、ジャンル投入は実行できません。');
  }

  if (!isAdminUser(user)) {
    throw new Error(
      `管理者権限がありません（moderationTier: ${user.moderationTier}, role: ${user.role ?? '未設定'}）。`
    );
  }

  return user;
}
