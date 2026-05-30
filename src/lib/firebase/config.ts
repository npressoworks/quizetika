import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

export { app, auth, db, storage };
export default app;
