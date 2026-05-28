/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // TypeScript のトランスパイルに ts-jest を使用
  preset: 'ts-jest',
  testEnvironment: 'node',

  // テストファイルの配置場所
  testMatch: ['**/tests/**/*.test.ts'],

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
    // Next.js の @ エイリアス
    '^@/(.*)$': '<rootDir>/src/$1',
    // Firebase SDK は純粋関数テストでは不要なためモック化
    '^firebase/(.*)$': '<rootDir>/tests/__mocks__/firebase/$1.ts',
    // src/lib/firebase/* へのインポートをモックに置き換え（絶対パスパターン）
    '<rootDir>/src/lib/firebase/config': '<rootDir>/tests/__mocks__/firebase-config.ts',
    '<rootDir>/src/lib/firebase/firestore': '<rootDir>/tests/__mocks__/firebase-firestore.ts',
    // 相対パスでのインポートも対応
    '^(\\.+/)*lib/firebase/config$': '<rootDir>/tests/__mocks__/firebase-config.ts',
    '^(\\.+/)*lib/firebase/firestore$': '<rootDir>/tests/__mocks__/firebase-firestore.ts',
  },

  // Firebase SDK が使用するグローバル環境を定義
  globals: {},
};
