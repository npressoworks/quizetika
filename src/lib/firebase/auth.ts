import { 
  signInWithPopup as fbSignInWithPopup,
  GoogleAuthProvider as fbGoogleAuthProvider,
  signInWithEmailAndPassword as fbSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as fbCreateUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';

const MOCK_USER_KEY = 'quizeum_mock_user';

// テスト環境判定 (環境変数、またはローカルストレージにモックユーザーが存在する場合にテストモードとする)
const isTestEnv = typeof window !== 'undefined' && 
  (process.env.NEXT_PUBLIC_ENV === 'test' || localStorage.getItem(MOCK_USER_KEY) !== null);

// 登録されたリスナーのリスト
const listeners: ((user: any | null) => void)[] = [];

// リスナー全員に通知
const notifyListeners = (user: any | null) => {
  listeners.forEach(cb => cb(user));
};

/**
 * 認証状態の変更リスナーを登録
 */
export const onAuthStateChanged = (auth: Auth, callback: (user: any | null) => void) => {
  if (isTestEnv) {
    listeners.push(callback);
    // 初期状態を非同期で即座に通知する（Firebase Authの挙動に合わせる）
    setTimeout(() => {
      const stored = localStorage.getItem(MOCK_USER_KEY);
      callback(stored ? JSON.parse(stored) : null);
    }, 0);
    
    // クリーンアップ関数を返す
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx !== -1) {
        listeners.splice(idx, 1);
      }
    };
  }
  return fbOnAuthStateChanged(auth, callback);
};

/**
 * メールアドレスとパスワードによるサインイン
 */
export const signInWithEmailAndPassword = async (auth: Auth, email: string, pass: string) => {
  if (isTestEnv) {
    const mockUser = {
      uid: 'e2e-test-uid-123456',
      email: email,
      displayName: 'テストユーザー',
      photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=e2e-test-uid-123456',
      emailVerified: true
    };
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    notifyListeners(mockUser);
    return { user: mockUser };
  }
  return fbSignInWithEmailAndPassword(auth, email, pass);
};

/**
 * メールアドレスとパスワードによるアカウント作成
 */
export const createUserWithEmailAndPassword = async (auth: Auth, email: string, pass: string) => {
  if (isTestEnv) {
    const mockUser = {
      uid: 'e2e-test-uid-123456',
      email: email,
      displayName: 'テストユーザー',
      photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=e2e-test-uid-123456',
      emailVerified: true
    };
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    notifyListeners(mockUser);
    return { user: mockUser };
  }
  return fbCreateUserWithEmailAndPassword(auth, email, pass);
};

/**
 * サインアウト
 */
export const signOut = async (auth: Auth) => {
  if (isTestEnv) {
    localStorage.removeItem(MOCK_USER_KEY);
    notifyListeners(null);
    return;
  }
  return fbSignOut(auth);
};

/**
 * ポップアップによるサインイン (Googleログイン等)
 */
export const signInWithPopup = async (auth: Auth, provider: any) => {
  if (isTestEnv) {
    const mockUser = {
      uid: 'e2e-test-uid-123456',
      email: 'e2e-test-user@example.com',
      displayName: 'テストユーザー',
      photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=e2e-test-uid-123456',
      emailVerified: true
    };
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    notifyListeners(mockUser);
    return { user: mockUser };
  }
  return fbSignInWithPopup(auth, provider);
};

/**
 * GoogleAuthProvider クラスのモック
 */
export class GoogleAuthProvider extends fbGoogleAuthProvider {}
