import type { User } from '@/types';

export type ModerationTierDisplayKey =
  | 'admin'
  | 'senior_moderator'
  | 'moderator'
  | 'contributor'
  | 'newcomer';

export interface ModerationTierDisplay {
  key: ModerationTierDisplayKey;
  label: string;
}

type TierSource = Pick<User, 'moderationTier'> & { role?: string };

/**
 * プロフィール等の表示用ティア（role: admin / moderationTier: admin を含む）
 */
export function resolveModerationTierDisplay(user: TierSource): ModerationTierDisplay {
  const role = user.role;
  const tier = user.moderationTier as string;

  if (tier === 'admin' || role === 'admin') {
    return { key: 'admin', label: 'システム管理者' };
  }

  switch (user.moderationTier) {
    case 'senior_moderator':
      return { key: 'senior_moderator', label: 'シニアモデレーター' };
    case 'moderator':
      return { key: 'moderator', label: 'モデレーター' };
    case 'contributor':
      return { key: 'contributor', label: 'コントリビューター' };
    case 'newcomer':
    default:
      return { key: 'newcomer', label: 'ニューカマー' };
  }
}
