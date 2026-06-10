import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const BATCH_SIZE = 500;

/** @param {string} path */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function initAdminApp() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'quizeum-77bc6';

  if (getApps().length > 0) {
    return getApps()[0];
  }

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId });
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!serviceAccountJson) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON が未設定です。.env.local を確認するか、--emulator で Emulator を対象にしてください。'
    );
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  return initializeApp({
    credential: cert(serviceAccount),
    projectId: projectId ?? serviceAccount.project_id,
  });
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} collectionName
 * @param {boolean} dryRun
 */
async function deleteCollection(db, collectionName, dryRun) {
  let total = 0;
  let lastDoc = null;

  while (true) {
    let query = db.collection(collectionName).orderBy('__name__').limit(BATCH_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    if (snap.empty) break;

    total += snap.size;
    if (!dryRun) {
      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_SIZE) break;
  }

  return total;
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {boolean} dryRun
 */
async function deleteListBookmarks(db, dryRun) {
  let total = 0;
  let lastDoc = null;

  while (true) {
    let query = db
      .collection('bookmarks')
      .where('targetType', '==', 'list')
      .orderBy('__name__')
      .limit(BATCH_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    if (snap.empty) break;

    total += snap.size;
    if (!dryRun) {
      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_SIZE) break;
  }

  return total;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const useEmulator = process.argv.includes('--emulator');

  if (useEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  }

  loadEnvFile(resolve(root, '.env.local'));
  loadEnvFile(resolve(root, '.env'));

  initAdminApp();
  const db = getFirestore();

  const quizListsCount = await deleteCollection(db, 'quizLists', dryRun);
  const listBookmarksCount = await deleteListBookmarks(db, dryRun);

  const mode = dryRun ? 'DRY-RUN' : 'DELETE';
  console.log(`[migrate-delete-quizlists] ${mode}`);
  console.log(`  quizLists: ${quizListsCount} documents`);
  console.log(`  bookmarks (targetType=list): ${listBookmarksCount} documents`);

  if (dryRun) {
    console.log('実削除するには --dry-run を外して実行してください。');
  }
}

main().catch((err) => {
  console.error('[migrate-delete-quizlists] failed:', err);
  process.exit(1);
});
