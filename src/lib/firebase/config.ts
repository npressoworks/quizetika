import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

// 環境変数からFirebase設定を読み込み
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// クライアント/サーバーで安全にアプリを初期化 (シングルトンパターン)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// サービスインスタンスの作成
// E2Eテスト環境では browserLocalPersistence を使用してStorageStateとの互換性を確保
let auth: Auth;
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ENV === 'test') {
  // テスト環境: LocalStorageを使用
  auth = initializeAuth(app, {
    persistence: browserLocalPersistence
  });
} else {
  // 本番環境: デフォルト設定
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

function shouldInitializeAppCheck(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_ENV === 'test') return false;
  // npm run dev では reCAPTCHA 未設定のため App Check を付けない（Firestore 拒否を防ぐ）
  if (process.env.NODE_ENV !== 'production') return false;
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  if (!siteKey || siteKey.includes('placeholder')) return false;
  return true;
}

// App Checkの初期化 (本番ビルド + 有効な reCAPTCHA サイトキーのみ)
if (shouldInitializeAppCheck()) {
  const appCheckSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!.trim();
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.log('[firebase-config] Firebase App Check を有効化しました。');
  } catch (err) {
    console.error('[firebase-config] Firebase App Check の初期化に失敗しました:', err);
  }
}

// E2Eテスト環境でのエミュレータ接続設定
const globalWithEmulators = global as typeof globalThis & {
  emulatorsConnected?: boolean;
};

const useEmulators =
  process.env.NEXT_PUBLIC_ENV === 'test' ||
  !!process.env.FIRESTORE_EMULATOR_HOST ||
  (process.env.NODE_ENV === 'development' &&
    !!process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST?.trim());

if (useEmulators && !globalWithEmulators.emulatorsConnected) {
  // 1. Auth Emulator
  if (typeof window !== 'undefined') {
    const authHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  }

  // 2. Firestore Emulator
  const firestoreHost =
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST ||
    '127.0.0.1:8080';
  const [fsIp, fsPort] = firestoreHost.split(':');
  connectFirestoreEmulator(db, fsIp, parseInt(fsPort || '8080'));

  // 3. Storage Emulator
  const storageHost =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ||
    '127.0.0.1:9199';
  const [stIp, stPort] = storageHost.split(':');
  connectStorageEmulator(storage, stIp, parseInt(stPort || '9199'));

  // 接続済みフラグをセット
  globalWithEmulators.emulatorsConnected = true;
  const label =
    process.env.NEXT_PUBLIC_ENV === 'test' || process.env.FIRESTORE_EMULATOR_HOST
      ? 'E2Eテスト環境'
      : 'ローカル開発環境';
  console.log(`[firebase-config] ${label}用のFirebase Local Emulator Suiteに接続しました。`);
}

export { app, auth, db, storage };
export default app;
