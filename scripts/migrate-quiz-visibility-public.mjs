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
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'quizetika-77bc6';

  if (getApps().length > 0) {
    return getApps()[0];
  }

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId });
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!serviceAccountJson) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON が未設定です。.env.local を確認するか --emulator を使用してください。'
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
 * @param {boolean} dryRun
 */
async function backfillPublishedVisibility(db, dryRun) {
  let scanned = 0;
  let updated = 0;
  let lastDoc = null;

  while (true) {
    let q = db
      .collection('quizzes')
      .where('status', '==', 'published')
      .orderBy('__name__')
      .limit(BATCH_SIZE);
    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }
    const snap = await q.get();
    if (snap.empty) break;

    const batch = dryRun ? null : db.batch();
    let batchUpdated = 0;
    for (const docSnap of snap.docs) {
      scanned += 1;
      const data = docSnap.data();
      if (data.visibility !== undefined && data.visibility !== null) {
        continue;
      }
      updated += 1;
      batchUpdated += 1;
      if (!dryRun && batch) {
        batch.update(docSnap.ref, { visibility: 'public' });
      }
    }

    if (!dryRun && batch && batchUpdated > 0) {
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_SIZE) break;
  }

  return { scanned, updated };
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

  const { scanned, updated } = await backfillPublishedVisibility(db, dryRun);
  const mode = dryRun ? 'DRY-RUN' : 'UPDATE';
  console.log(`[migrate-quiz-visibility-public] ${mode}`);
  console.log(`  published quizzes scanned: ${scanned}`);
  console.log(`  visibility backfill targets: ${updated}`);

  if (dryRun) {
    console.log('実更新するには --dry-run を外して実行してください。');
  }
}

main().catch((err) => {
  console.error('[migrate-quiz-visibility-public] failed:', err);
  process.exit(1);
});
