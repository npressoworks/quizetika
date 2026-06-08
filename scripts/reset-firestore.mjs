import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

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

async function resetFirestore() {
  const useEmulator = process.argv.includes('--emulator');
  const confirmed = process.argv.includes('--confirm');

  if (useEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  }

  if (!useEmulator && !confirmed) {
    throw new Error(
      '本番 Firestore の全削除は不可逆です。実行するには --confirm を付けてください。'
    );
  }

  loadEnvFile(resolve(root, '.env.local'));
  loadEnvFile(resolve(root, '.env'));

  initAdminApp();
  const db = getFirestore();

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'quizeum-77bc6';
  const target = process.env.FIRESTORE_EMULATOR_HOST
    ? `Emulator (${process.env.FIRESTORE_EMULATOR_HOST})`
    : `Firestore (${projectId})`;

  console.log(`${target} の全コレクションを削除します...`);

  const collections = await db.listCollections();
  if (collections.length === 0) {
    console.log('削除対象のコレクションはありません。');
    return;
  }

  for (const collectionRef of collections) {
    console.log(`  削除中: ${collectionRef.id}`);
    await db.recursiveDelete(collectionRef);
  }

  console.log(`${collections.length} コレクションを削除しました。`);
}

resetFirestore().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
