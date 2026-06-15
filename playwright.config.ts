import { defineConfig, devices } from '@playwright/test';

/**
 * Playwrightの設定ファイル
 * 詳細はこちら: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // テストファイルが配置されるディレクトリ
  testDir: './e2e',

  // Firestore Emulator にジャンルマスタを投入
  globalSetup: './e2e/global-setup.ts',
  
  // 各テストの最大実行時間 (ミリ秒) - Firebaseの初期化時間を考慮して60秒に設定
  timeout: 60 * 1000,
  
  // アサーションの最大待ち時間 (ミリ秒) - 10秒に延長
  expect: {
    timeout: 10000,
  },
  
  // テストを並列で実行するかどうか
  fullyParallel: false,
  
  // CI環境等でのみリトライを許可する
  retries: process.env.CI ? 2 : 0,
  
  // ローカル開発環境では並列実行数を1に制限して競合を防止する
  workers: 1,
  
  // レポーターの設定 (リスト形式およびHTMLレポートの生成)
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  
  // すべてのプロジェクトで共有するグローバルなオプション設定
  use: {
    // 操作対象のベースURL。Next.jsの開発サーバーに合わせる
    baseURL: 'http://localhost:3000',
    
    // アクションごとのデフォルトタイムアウト - Firebase認証完了を考慮して15秒
    actionTimeout: 15000,
    
    // ページナビゲーションのデフォルトタイムアウト - 30秒に設定
    navigationTimeout: 30000,
    
    // エラー発生時のスクリーンショット取得設定
    screenshot: 'only-on-failure',
    
    // エラー発生時のトレース取得設定
    trace: 'retain-on-failure',
    
    // ビデオの記録設定
    video: 'retain-on-failure',
  },

  /* 主要なテスト用ブラウザを設定 */
  projects: [
    // 最初に実行される認証セットアッププロジェクト
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // 認証状態を引き継いで実行する通常のテスト
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // auth.setup.tsで保存した認証状態を読み込む
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'], // setupが完了してから実行される
    },
  ],

  /* テスト開始前にローカルのWebサーバー（Next.js）を起動する設定 */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: false, // テスト用環境変数を確実に反映するため再利用しない
    timeout: 120 * 1000,
    env: {
      NEXT_PUBLIC_ENV: 'test', // E2Eテスト環境変数を指定
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
    },
  },
});
