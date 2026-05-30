'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase/config';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from '@/lib/firebase/auth';
import { AlertCircle } from 'lucide-react';
import styles from './login.module.css';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // エラーとステータス
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 既にログインしている場合は自動的にホームにリダイレクト
  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Firebaseエラーを日本語のメッセージに変換
  const getFriendlyErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/popup-closed-by-user':
        return 'Googleログインがキャンセルされました。もう一度お試しください。';
      case 'auth/cancelled-popup-request':
        return '他のポップアップが開いているため処理を中断しました。';
      case 'auth/popup-blocked':
        return 'ポップアップがブラウザにブロックされました。ポップアップを許可してください。';
      default:
        return 'エラーが発生しました。時間をおいて再度お試しください。';
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

  // E2Eテスト用の簡易ログイン (開発環境のみ有効)
  const handleE2ETestLogin = async () => {
    setErrorMsg('');
    setSubmitting(true);
    const email = 'e2e-test-user@example.com';
    const password = 'e2e-test-password-999';
    try {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-email') {
          // ユーザーが存在しないかクレデンシャルが無効な場合は作成を試みる
          await createUserWithEmailAndPassword(auth, email, password);
        } else {
          throw err;
        }
      }
      router.push('/');
    } catch (err: any) {
      console.error('E2E login error:', err);
      setErrorMsg('E2Eログインに失敗しました: ' + err.message);
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
    <main className={styles.main}>
      <div className={`${styles.authCard} glass-card animate-fade-in`}>
        <div className={styles.cardHeader}>
          <h1 className={styles.title}>
            quizeumへようこそ！
          </h1>
          <p className={styles.subtitle}>
            Googleアカウントでログインまたは新規登録を行い、クイズに挑戦しましょう。
          </p>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className={`${styles.errorAlert} animate-fade-in`}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Social Auth */}
        <div className={styles.socialContainer} style={{ marginTop: '24px', width: '100%' }}>
          <button
            type="button"
            onClick={handleGoogleLogin}
            className={`btn btn-secondary ${styles.socialBtn} ${submitting ? 'btn-disabled' : ''}`}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '12px',
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: '8px',
              transition: 'all 0.2s ease-in-out'
            }}
            disabled={submitting}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>{submitting ? 'サインイン中...' : 'Googleアカウントでログイン'}</span>
          </button>
        </div>

        {/* E2E Test Auth (開発環境のみ) */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ marginTop: '12px', width: '100%' }}>
            <button
              id="e2e-test-login-btn"
              type="button"
              onClick={handleE2ETestLogin}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                fontWeight: 600,
                borderRadius: '8px',
                backgroundColor: '#10B981',
                borderColor: '#10B981',
                color: 'white',
              }}
              disabled={submitting}
            >
              <span>E2Eテスト用ログイン (開発用)</span>
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
