'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { PlusCircle } from 'lucide-react';
import styles from './header.module.css';

export const Header: React.FC = () => {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // クイズプレイ画面では共通ヘッダーを表示しない
  if (pathname && pathname.includes('/play')) {
    return null;
  }

  return (
    <header className={`${styles.header} glass-card`}>
      <div className={styles.container}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <span className="text-neon-primary">Quiz</span>
          <span className="text-neon-accent">eum</span>
        </Link>

        {/* Mobile Actions */}
        <div className={styles.actions}>
          {loading ? (
            <div className={styles.skeletonAvatar} />
          ) : user ? (
            <div className={styles.userWrapper}>
              {/* クイズ作成ボタン */}
              <Link 
                href="/quiz/create" 
                className={styles.createBtn}
                data-testid="mobile-header-create-btn"
                data-analytics="nav-create-quiz"
              >
                <PlusCircle size={20} />
              </Link>
              
              {/* アバター (クリックでプロフィール画面へ遷移) */}
              <Link href={`/profile/${user.id}`}>
                <img 
                  src={user.avatarUrl} 
                  alt={user.displayName} 
                  className={styles.avatar} 
                />
              </Link>
            </div>
          ) : (
            <Link href="/login" className={`${styles.loginBtn} btn btn-accent`} data-analytics="nav-login">
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
