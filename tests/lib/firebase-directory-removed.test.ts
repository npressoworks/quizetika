import { existsSync } from 'node:fs';
import { join } from 'node:path';

const REMOVED_PATHS = [
  'src/lib/firebase',
  '.firebaserc',
  'firebase.json',
  'firestore.indexes.json',
  'firestore.rules',
  'storage.rules',
  'firebase-debug.log',
  'firestore-debug.log',
];

describe('Firebase 初期化コードと設定ファイルの削除', () => {
  it.each(REMOVED_PATHS)('%s が存在しない', (relativePath) => {
    expect(existsSync(join(process.cwd(), relativePath))).toBe(false);
  });
});
