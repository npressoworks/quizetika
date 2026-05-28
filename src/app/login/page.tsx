'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase/config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { Header } from '@/components/layout/header';
import { Mail, Lock, User as UserIcon, AlertCircle, ArrowRight } from 'lucide-react';
import styles from './login.module.css';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // ログイン / 新規登録のトグル状態 ('login' | 'register')
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // フォーム入力データ
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // エラーとステータス
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 既にログインしている場合は自動的にホームにリダイレクト
  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Firebaseエラーを日本語の親しみやすいメッセージに変換
  const getFriendlyErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/invalid-email':
        return 'メールアドレスの形式が正しくありません。';
      case 'auth/user-disabled':
        return 'このアカウントは無効化されています。';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'メールアドレスまたはパスワードが正しくありません。';
      case 'auth/email-already-in-use':
        return 'このメールアドレスは既に登録されています。';
      case 'auth/weak-password':
        return 'パスワードは6文字以上で入力してください。';
      case 'auth/popup-closed-by-user':
        return 'Googleログインがキャンセルされました。';
      default:
        return 'エラーが発生しました。時間をおいて再度お試しください。';
    }
  };

  // メール/パスワードによる送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('すべての項目を入力してください。');
      return;
    }

    if (mode === 'register' && !displayName) {
      setErrorMsg('お名前（ニックネーム）を入力してください。');
      return;
    }

    setSubmitting(true);

    try {
      if (mode === 'login') {
        // ログイン処理
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // 新規登録処理
        // Authユーザー作成 -> auth-context側で自動的にFirestore初期ドキュメントが作られる
        await createUserWithEmailAndPassword(auth, email, password);
        // 作成したユーザーの表示名を登録 (可能であれば)
        // ※ auth-context が displayName を同期するために少しタイムラグがあるため、
        // 必要に応じて firebaseUser のプロファイル更新も併用可能ですが、基本シンクで対応
      }
      router.push('/');
    } catch (err: any) {
      console.error('Auth error:', err);
      setErrorMsg(getFriendlyErrorMessage(err.code));
    } finally {
      setSubmitting(false);
    }
  };

  // Googleでのログイン
  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (err: any) {
      console.error('Google auth error:', err);
      setErrorMsg(getFriendlyErrorMessage(err.code));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={`${styles.authCard} glass-card animate-fade-in`}>
          {/* Tabs */}
          <div className={styles.tabContainer}>
            <button
              className={`${styles.tabButton} ${mode === 'login' ? styles.activeTab : ''}`}
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
            >
              ログイン
            </button>
            <button
              className={`${styles.tabButton} ${mode === 'register' ? styles.activeTab : ''}`}
              onClick={() => {
                setMode('register');
                setErrorMsg('');
              }}
            >
              新規登録
            </button>
          </div>

          <div className={styles.cardHeader}>
            <h1 className={styles.title}>
              {mode === 'login' ? 'おかえりなさい！' : 'はじめましょう！'}
            </h1>
            <p className={styles.subtitle}>
              {mode === 'login'
                ? 'quizeumにログインしてクイズに挑戦しましょう'
                : 'アカウントを作成して、オリジナルのクイズを投稿しましょう'}
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className={`${styles.errorAlert} animate-fade-in`}>
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className={styles.form}>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label" htmlFor="displayName">ニックネーム</label>
                <div className={styles.inputWrapper}>
                  <UserIcon className={styles.inputIcon} size={18} />
                  <input
                    id="displayName"
                    type="text"
                    placeholder="クイズ太郎"
                    className={`${styles.authInput} form-input`}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="email">メールアドレス</label>
              <div className={styles.inputWrapper}>
                <Mail className={styles.inputIcon} size={18} />
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  className={`${styles.authInput} form-input`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">パスワード</label>
              <div className={styles.inputWrapper}>
                <Lock className={styles.inputIcon} size={18} />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className={`${styles.authInput} form-input`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <button
              type="submit"
              className={`btn btn-primary ${styles.submitBtn} ${submitting ? 'btn-disabled' : ''}`}
              disabled={submitting}
            >
              {submitting ? '処理中...' : mode === 'login' ? 'ログインする' : '新規登録する'}
              {!submitting && <ArrowRight size={18} />}
            </button>
          </form>

          {/* Divider */}
          <div className={styles.authDivider}>
            <span>または</span>
          </div>

          {/* Social Auth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className={`btn btn-secondary ${styles.socialBtn} ${submitting ? 'btn-disabled' : ''}`}
            disabled={submitting}
          >
            <svg style={{ marginRight: '8px' }} viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Googleでサインイン</span>
          </button>
        </div>
      </main>
    </>
  );
}
