import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import type { User } from '@/types';

const MODERATOR_TIERS = new Set(['moderator', 'senior_moderator', 'admin']);

/**
 * 初期ジャンル投入前の権限・ドキュメント検証（Firestore Rules と同等の判定）
 */
export async function assertSeedGenresAccess(uid: string): Promise<User> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    throw new Error(
      `users/${uid} が存在しません。ログイン後にプロフィールが作成されているか確認してください。`
    );
  }

  const user = { id: uid, ...snap.data() } as User;

  if (user.isBanned === true) {
    throw new Error('アカウントが停止（BAN）されているため、ジャンル投入は実行できません。');
  }

  if (!isAdminUser(user)) {
    throw new Error(
      `管理者権限がありません（moderationTier: ${user.moderationTier}, role: ${(user as User & { role?: string }).role ?? '未設定'}）。`
    );
  }

  const tier = user.moderationTier as string;
  const role = (user as User & { role?: string }).role;
  const rulesWouldAllow =
    MODERATOR_TIERS.has(tier) || role === 'admin' || tier === 'admin';

  if (!rulesWouldAllow) {
    throw new Error(
      `Firestore Rules 上の書き込み条件を満たしていません（moderationTier: ${tier}, role: ${role ?? '未設定'}）。`
    );
  }

  return user;
}

export function seedGenresDeployHint(): string {
  return (
    'ローカルの firestore.rules を編集しただけでは本番 Firestore に反映されません。' +
    ' ターミナルで `npm run deploy:rules` を実行するか、Firebase Console → Firestore → ルール に最新の firestore.rules を貼り付けて公開してください。'
  );
}
