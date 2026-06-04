import { resolveModerationTierDisplay } from '@/lib/moderation-tier-display';
import type { User } from '@/types';

describe('resolveModerationTierDisplay', () => {
  test('role が admin の場合はシステム管理者と表示する', () => {
    const user = {
      moderationTier: 'newcomer',
      role: 'admin',
    } as User;

    expect(resolveModerationTierDisplay(user)).toEqual({
      key: 'admin',
      label: 'システム管理者',
    });
  });

  test('moderationTier が admin の場合はシステム管理者と表示する', () => {
    const user = {
      moderationTier: 'admin' as User['moderationTier'],
    } as User;

    expect(resolveModerationTierDisplay(user)).toEqual({
      key: 'admin',
      label: 'システム管理者',
    });
  });

  test('一般ユーザーは moderationTier に応じたラベルを返す', () => {
    expect(
      resolveModerationTierDisplay({ moderationTier: 'contributor' } as User)
    ).toEqual({ key: 'contributor', label: 'コントリビューター' });
  });
});
