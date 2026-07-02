import { isPostHogEnabled } from '@/lib/posthog-enabled';

describe('isPostHogEnabled', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPublicEnv = process.env.NEXT_PUBLIC_ENV;
  const originalPostHogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  afterEach(() => {
    (process.env as any).NODE_ENV = originalNodeEnv;
    process.env.NEXT_PUBLIC_ENV = originalPublicEnv;
    process.env.NEXT_PUBLIC_POSTHOG_KEY = originalPostHogKey;
  });

  it('開発ビルドでは無効', () => {
    (process.env as any).NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';

    expect(isPostHogEnabled()).toBe(false);
  });

  it('E2E テスト環境では無効', () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_ENV = 'test';
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';

    expect(isPostHogEnabled()).toBe(false);
  });

  it('API キー未設定の本番ビルドでは無効', () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_ENV = undefined;
    process.env.NEXT_PUBLIC_POSTHOG_KEY = '';

    expect(isPostHogEnabled()).toBe(false);
  });

  it('本番ビルドかつ API キーありで有効', () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_ENV = undefined;
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_live_key';

    expect(isPostHogEnabled()).toBe(true);
  });
});
