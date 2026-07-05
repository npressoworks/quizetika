import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
const FIREBASE_PACKAGE_NAMES = ['firebase', 'firebase-admin', 'firebase-tools'];
const FIRESTORE_DEV_SCRIPT_NAMES = [
  'emulators',
  'deploy:rules',
  'seed:test-data',
  'seed:test-data:emulator',
  'db:reset',
  'db:reset:emulator',
  'db:reset-and-seed',
  'db:reset-and-seed:emulator',
];
const FIRESTORE_DEV_SCRIPT_FILES = [
  'scripts/seed-test-data.mjs',
  'scripts/reset-firestore.mjs',
  'scripts/migrate-delete-quizlists.mjs',
  'scripts/migrate-quiz-visibility-public.mjs',
];

describe('package.json の Firebase 依存除去', () => {
  it('dependencies / devDependencies に Firebase 関連パッケージを含まない', () => {
    for (const name of FIREBASE_PACKAGE_NAMES) {
      expect(packageJson.dependencies?.[name]).toBeUndefined();
      expect(packageJson.devDependencies?.[name]).toBeUndefined();
    }
  });

  it('Firestore 専用の npm スクリプトを含まない', () => {
    for (const name of FIRESTORE_DEV_SCRIPT_NAMES) {
      expect(packageJson.scripts?.[name]).toBeUndefined();
    }
  });

  it('verify:firebase-removed スクリプトが登録されている', () => {
    expect(packageJson.scripts?.['verify:firebase-removed']).toBe(
      'node scripts/verify-firebase-removed.js'
    );
  });
});

describe('Firestore 専用の開発スクリプトファイルの削除', () => {
  it.each(FIRESTORE_DEV_SCRIPT_FILES)('%s が存在しない', (relativePath) => {
    expect(existsSync(join(process.cwd(), relativePath))).toBe(false);
  });
});
