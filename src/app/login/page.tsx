'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getSafeRedirectPath } from '@/lib/safe-redirect-path';
import { auth } from '@/lib/firebase/config';
import {
  signInWithPopup,
  GoogleAuthProvider,
  TwitterAuthProvider,
  createMicrosoftAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from '@/lib/firebase/auth';
import type { AuthProvider } from 'firebase/auth';
import { ErrorOutlined } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const isMockAuthEnabled = process.env.NEXT_PUBLIC_ENV === 'test';

function LoginLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <CircularProgress size={32} className="text-muted-foreground" />
    </div>
  );
}

function LoginPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = getSafeRedirectPath(searchParams.get('redirect'));

  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push(redirectPath);
    }
  }, [user, loading, router, redirectPath]);

  const getFriendlyErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/popup-closed-by-user':
        return 'ログインがキャンセルされました。もう一度お試しください。';
      case 'auth/cancelled-popup-request':
        return '他のポップアップが開いているため処理を中断しました。';
      case 'auth/popup-blocked':
        return 'ポップアップがブラウザにブロックされました。ポップアップを許可してください。';
      case 'auth/operation-not-allowed':
        return 'このログイン方法は現在利用できません。管理者にお問い合わせください。';
      case 'auth/account-exists-with-different-credential':
        return '同じメールアドレスで別の方法で登録済みです。別のログイン方法をお試しください。';
      default:
        return 'エラーが発生しました。時間をおいて再度お試しください。';
    }
  };

  const handleSocialLogin = async (provider: AuthProvider, providerLabel: string) => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      await signInWithPopup(auth, provider);
      router.push(redirectPath);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      console.error(`${providerLabel} auth error:`, err);
      setErrorMsg(getFriendlyErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = () => handleSocialLogin(new GoogleAuthProvider(), 'Google');
  const handleXLogin = () => handleSocialLogin(new TwitterAuthProvider(), 'X');
  const handleAzureAdLogin = () => handleSocialLogin(createMicrosoftAuthProvider(), 'Azure AD');

  const handleE2ETestLogin = isMockAuthEnabled ? async () => {
    setErrorMsg('');
    setSubmitting(true);
    const email = 'e2e-test-user@example.com';
    const password = 'e2e-test-password-999';
    try {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email') {
          await createUserWithEmailAndPassword(auth, email, password);
        } else if (error.code === 'auth/operation-not-allowed' || error.message?.includes('operation-not-allowed')) {
          console.warn('Firebase Email Auth is disabled. Falling back to local storage mock login.');
          const mockUser = {
            uid: 'e2e-test-uid-123456',
            email: email,
            displayName: 'テストユーザー',
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=e2e-test-uid-123456',
            emailVerified: true
          };
          localStorage.setItem('quizeum_mock_user', JSON.stringify(mockUser));
          window.location.href = '/';
          return;
        } else {
          throw err;
        }
      }
      router.push(redirectPath);
    } catch (err: unknown) {
      const message = (err as Error)?.message ?? 'unknown';
      console.error('E2E login error:', err);
      setErrorMsg('E2Eログインに失敗しました: ' + message);
    } finally {
      setSubmitting(false);
    }
  } : undefined;

  if (loading || user) {
    return <LoginLoading />;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">quizeumへようこそ！</CardTitle>
          <CardDescription>
            Google、X、または Azure AD（Microsoft）アカウントでログイン・新規登録し、クイズに挑戦しましょう。
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {errorMsg && (
            <Alert variant="destructive">
              <ErrorOutlined sx={{ fontSize: 16 }} className="size-4" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-center gap-3 text-base font-semibold"
              onClick={handleGoogleLogin}
              disabled={submitting}
              data-analytics="auth-login-google"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>{submitting ? 'サインイン中...' : 'Googleアカウントでログイン'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-center gap-3 text-base font-semibold"
              onClick={handleXLogin}
              disabled={submitting}
              data-analytics="auth-login-x"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>{submitting ? 'サインイン中...' : 'Xアカウントでログイン'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-center gap-3 text-base font-semibold"
              onClick={handleAzureAdLogin}
              disabled={submitting}
              data-analytics="auth-login-azure"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path fill="#F25022" d="M1 1h10v10H1z"/>
                <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                <path fill="#FFB900" d="M13 13h10v10H13z"/>
              </svg>
              <span>{submitting ? 'サインイン中...' : 'Azure ADでログイン'}</span>
            </Button>
          </div>

          {isMockAuthEnabled && handleE2ETestLogin && (
            <Button
              id="e2e-test-login-btn"
              type="button"
              className="h-12 w-full text-base font-semibold"
              onClick={handleE2ETestLogin}
              disabled={submitting}
            >
              E2Eテスト用ログイン (開発用)
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginPageContent />
    </Suspense>
  );
}
