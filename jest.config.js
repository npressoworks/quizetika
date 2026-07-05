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

  // モジュール解決のエイリアス
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/tests/__mocks__/styleMock.ts',
    // Next.js の @ エイリアス
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  globals: {},
};
