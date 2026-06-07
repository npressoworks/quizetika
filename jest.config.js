/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // TypeScript のトランスパイルに ts-jest を使用
  preset: 'ts-jest',
  testEnvironment: 'node',

  // テストファイルの配置場所
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],

  // ts-jest の設定: プロジェクトルートの tsconfig を使用
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        // 型チェックをスキップして実行を高速化
        diagnostics: false,
      },
    ],
  },

  // モジュール解決のエイリアスと Firebase SDK のモック化
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/tests/__mocks__/styleMock.ts',
    // Next.js の @ エイリアス
    '^@/(.*)$': '<rootDir>/src/$1',
    // Firebase SDK は純粋関数テストでは不要なためモック化
    '^firebase/(.*)$': '<rootDir>/tests/__mocks__/firebase/$1.ts',
    // src/lib/firebase/* へのインポートをモックに置き換え (Windows対応、相対・絶対パス不問)
    'firebase[\\/]config$': '<rootDir>/tests/__mocks__/firebase-config.ts',
    'firebase[\\/]firestore$': '<rootDir>/tests/__mocks__/firebase-firestore.ts',
  },

  // Firebase SDK が使用するグローバル環境を定義
  globals: {},
};
