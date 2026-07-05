import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';

/**
 * Playwrightの設定ファイル
 * 詳細はこちら: https://playwright.dev/docs/test-configuration
 */

// Next.js の開発サーバーとは別プロセスで globalSetup 等が実行されるため、
// .env.local 等を明示的に読み込む (Next.js 本体と同じ @next/env を使用)
loadEnvConfig(process.cwd());

const PORT = process.env.PORT || '3000';

export default defineConfig({
  // テストファイルが配置されるディレクトリ
  testDir: './e2e',

  // Supabase ローカル環境にジャンルマスタ等のフィクスチャを投入
  globalSetup: './e2e/global-setup.ts',

  // 各テストの最大実行時間 (ミリ秒)
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
  
  // レポーターの設定 (リスト形式・HTMLレポート・機械可読なJSONレポートの生成)
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }]
  ],
  
  // すべてのプロジェクトで共有するグローバルなオプション設定
  use: {
    // 操作対象のベースURL。Next.jsの開発サーバーに合わせる
    baseURL: `http://localhost:${PORT}`,
    
    // アクションごとのデフォルトタイムアウト - 認証完了を考慮して15秒
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

  webServer: process.env.CI
    ? {
        // CI環境: 独立ビルドサーバーを起動する
        command: `npm run build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 180 * 1000,
        env: {
          NEXT_PUBLIC_ENV: 'test',
        },
      }
    : {
        // ローカル環境: 既存のnpm run devサーバーを再利用する
        command: `npx next dev -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true, // 既存のdevサーバーを再利用する
        timeout: 60 * 1000,
        env: {
          NEXT_PUBLIC_ENV: 'test',
        },
      },
});
