import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

let adminApp: App | undefined;

function initAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    adminApp = initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      projectId: projectId ?? serviceAccount.project_id,
    });
    return adminApp;
  }

  throw new Error(
    'FIREBASE_SERVICE_ACCOUNT_JSON が未設定です。Firebase Console → プロジェクト設定 → サービスアカウント から JSON キーを発行し、.env.local に FIREBASE_SERVICE_ACCOUNT_JSON=\'{"type":"service_account",...}\' として1行で設定してください。'
  );
}

/** Rules をバイパスする特権 Firestore（サーバー API 専用） */
export function getAdminFirestore(): Firestore {
  return getFirestore(initAdminApp());
}

/** Rules をバイパスする特権 Storage（サーバー API 専用） */
export function getAdminStorage(): Storage {
  return getStorage(initAdminApp());
}
