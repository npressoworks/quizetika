import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const jestConfigSource = readFileSync(join(process.cwd(), 'jest.config.js'), 'utf8');

const REMOVED_MOCK_PATHS = [
  'tests/__mocks__/firebase',
  'tests/__mocks__/firebase-config.ts',
  'tests/__mocks__/firebase-firestore.ts',
];

describe('jest.config.js の Firebase 自動モック除去', () => {
  it('moduleNameMapper に Firebase 関連エントリを含まない', () => {
    expect(jestConfigSource).not.toMatch(/firebase/i);
  });
});

describe('Firebase モックファイルの削除', () => {
  it.each(REMOVED_MOCK_PATHS)('%s が存在しない', (relativePath) => {
    expect(existsSync(join(process.cwd(), relativePath))).toBe(false);
  });
});
