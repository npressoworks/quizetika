'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { getUser, createUser, getUserProfileByEmail, updateUserUid } from '../services/user';
import { User } from '../types';
import {
  clearMiddlewareAuthCookies,
  syncMiddlewareAuthCookies,
} from '@/lib/middleware-auth-cookies';

const supabaseClient = createClient();

// 既存のフロントエンド・コード（authUser.uid や authUser.getIdToken()）との
// 互換性を保つためのアダプター型定義
interface CompatibleUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  getIdToken: () => Promise<string | null>;
}

interface AuthContextType {
  user: User | null; // Supabase 内のユーザー詳細情報
  authUser: CompatibleUser | null; // 互換性を持たせた Supabase ユーザーオブジェクト
  loading: boolean; // ローディングフラグ
  refreshUser: () => Promise<void>; // プロフィール更新時などの手動リロード用
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  authUser: null,
  loading: true,
  refreshUser: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<CompatibleUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 互換ユーザーオブジェクトを作成するファクトリ
  const createCompatibleUser = (sUser: SupabaseUser): CompatibleUser => {
    return {
      uid: sUser.id,
      email: sUser.email ?? null,
      displayName: sUser.user_metadata?.full_name ?? sUser.email?.split('@')[0] ?? 'ユーザー',
      photoURL: sUser.user_metadata?.avatar_url ?? null,
      getIdToken: async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        return session?.access_token ?? null;
      },
    };
  };

  // Supabaseから最新のユーザー情報を再取得する
  const refreshUser = useCallback(async () => {
    if (authUser) {
      const dbUser = await getUser(authUser.uid);

      if (dbUser && dbUser.isBanned === true) {
        await supabaseClient.auth.signOut();
        setUser(null);
        setAuthUser(null);
        if (typeof document !== 'undefined') {
          const secure = window.location.protocol === 'https:' ? '; Secure' : '';
          document.cookie = `quizetika_banned=true; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
          clearMiddlewareAuthCookies();
        }
        return;
      }

      setUser(dbUser);
      syncMiddlewareAuthCookies(dbUser, authUser.uid);
    }
  }, [authUser]);

  useEffect(() => {
    // 認証状態の変化を監視（購読開始時に INITIAL_SESSION イベントで
    // 現在のセッションも即座に通知されるため、初回マウント時の
    // getSession() 呼び出しは不要かつ二重実行の原因になるので行わない）
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        const sUser = session?.user ?? null;
        if (sUser) {
          const compatUser = createCompatibleUser(sUser);
          setAuthUser(compatUser);
          await syncUserProfile(compatUser);
        } else {
          setAuthUser(null);
          setUser(null);
          clearMiddlewareAuthCookies();
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ユーザーのプロフィール同期および初期作成
  const syncUserProfile = async (compatUser: CompatibleUser) => {
    try {
      let dbUser = await getUser(compatUser.uid);

      // BANチェック
      if (dbUser && dbUser.isBanned === true) {
        await supabaseClient.auth.signOut();
        setUser(null);
        setAuthUser(null);
        if (typeof document !== 'undefined') {
          const secure = window.location.protocol === 'https:' ? '; Secure' : '';
          document.cookie = `quizetika_banned=true; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
          clearMiddlewareAuthCookies();
        }
        setLoading(false);
        return;
      }

      // 存在しない場合は初期プロフィールを作成
      if (!dbUser) {
        const userEmail = compatUser.email || '';
        let existingUserByEmail = null;
        if (userEmail) {
          existingUserByEmail = await getUserProfileByEmail(userEmail);
        }

        if (existingUserByEmail) {
          // メールアドレスが重複する古いレコードがある場合、現在のUIDに更新して不整合を自己修復
          console.log(`[auth-context] Email duplicate detected for ${userEmail}. Self-healing UID from ${existingUserByEmail.id} to ${compatUser.uid}`);
          await updateUserUid(existingUserByEmail.id, compatUser.uid);
          dbUser = await getUser(compatUser.uid);
        } else {
          // 本当に新規ユーザーの場合は作成
          const tempUser: Omit<User, 'createdAt' | 'updatedAt'> = {
            id: compatUser.uid,
            email: userEmail,
            displayName: compatUser.displayName || 'ユーザー',
            avatarUrl: compatUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${compatUser.uid}`,
            bio: 'クイズ大好き！よろしくお願いします。',
            followedGenres: [],
            badges: [],
            createdQuizzesCount: 0,
            totalPlayCount: 0,
            followersCount: 0,
            followingCount: 0,
            reputationScore: 0,
            moderationTier: 'newcomer',
            reputationHistory: [],
            lastReputationCalculatedAt: null,
            totalFailedQuestionsCount: 0,
            deleteStatus: 'active',
          };
          await createUser(tempUser);
          dbUser = await getUser(compatUser.uid);
        }
      }
      setUser(dbUser);
      syncMiddlewareAuthCookies(dbUser, compatUser.uid);
    } catch (error) {
      console.error('Failed to sync user to Supabase:', error);
      syncMiddlewareAuthCookies(null, compatUser.uid);
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({ user, authUser, loading, refreshUser }),
    [user, authUser, loading, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
