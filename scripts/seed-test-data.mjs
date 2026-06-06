import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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

/** @param {unknown} value */
function convertDates(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return Timestamp.fromDate(new Date(value));
  }
  if (Array.isArray(value)) {
    return value.map(convertDates);
  }
  if (typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = convertDates(nested);
    }
    return result;
  }
  return value;
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
      'FIREBASE_SERVICE_ACCOUNT_JSON が未設定です。.env.local を確認するか、--emulator で Emulator へ投入してください。'
    );
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  return initializeApp({
    credential: cert(serviceAccount),
    projectId: projectId ?? serviceAccount.project_id,
  });
}

async function seedTestData() {
  if (process.argv.includes('--emulator')) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  }

  loadEnvFile(resolve(root, '.env.local'));
  loadEnvFile(resolve(root, '.env'));

  initAdminApp();
  const db = getFirestore();

  const testDataPath = resolve(root, 'src/data/test_data.json');
  const testData = JSON.parse(readFileSync(testDataPath, 'utf8'));

  let batch = db.batch();
  let opCount = 0;
  let totalDocs = 0;
  /** @type {Record<string, number>} */
  const countsByCollection = {};

  for (const [collectionName, docs] of Object.entries(testData)) {
    if (!Array.isArray(docs)) continue;

    countsByCollection[collectionName] = docs.length;

    for (const doc of docs) {
      if (!doc?.id || typeof doc.id !== 'string') {
        throw new Error(`${collectionName} に id がないドキュメントがあります`);
      }

      const payload = convertDates(doc);
      batch.set(db.collection(collectionName).doc(doc.id), payload, { merge: true });
      opCount += 1;
      totalDocs += 1;

      if (opCount >= 400) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  const target = process.env.FIRESTORE_EMULATOR_HOST
    ? `Emulator (${process.env.FIRESTORE_EMULATOR_HOST})`
    : `Firestore (${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'quizeum-77bc6'})`;

  console.log(`test_data.json を ${target} に投入しました`);
  console.log(`合計 ${totalDocs} ドキュメント:`);
  for (const [name, count] of Object.entries(countsByCollection)) {
    console.log(`  ${name}: ${count}`);
  }
}

seedTestData().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
