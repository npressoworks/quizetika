'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase/config';
import { getUser, createUser } from '../services/user';
import { User } from '../types';

interface AuthContextType {
  user: User | null; // Firestore 内のユーザー詳細情報
  firebaseUser: FirebaseUser | null; // Firebase Auth の生ユーザーオブジェクト
  loading: boolean; // ローディングフラグ
  refreshUser: () => Promise<void>; // プロフィール更新時などの手動リロード用
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  refreshUser: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Firestoreから最新のユーザー情報を再取得する
  const refreshUser = async () => {
    if (firebaseUser) {
      const dbUser = await getUser(firebaseUser.uid);
      setUser(dbUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);

      if (fUser) {
        try {
          // 1. Firestore からユーザー情報を取得
          let dbUser = await getUser(fUser.uid);

          // 2. 存在しない場合 (新規会員登録直後など) は初期ドキュメントを作成
          if (!dbUser) {
            const tempUser: Omit<User, 'createdAt' | 'updatedAt'> = {
              id: fUser.uid,
              email: fUser.email || '',
              displayName: fUser.displayName || fUser.email?.split('@')[0] || 'ユーザー',
              avatarUrl: fUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${fUser.uid}`,
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
            dbUser = await getUser(fUser.uid);
          }
          setUser(dbUser);
        } catch (error) {
          console.error('Failed to sync user to Firestore:', error);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
