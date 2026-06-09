'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase/config';
import { signOut } from '@/lib/firebase/auth';
import {
  PlusCircle,
  User as UserIcon,
  LogOut,
  List,
  ClipboardList,
  Settings,
} from 'lucide-react';
import styles from './header.module.css';

export const Header: React.FC = () => {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [popupOpen, setPopupOpen] = useState(false);

  if (pathname && pathname.includes('/play')) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setPopupOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className={`${styles.header} glass-card`}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <span className="text-neon-primary">Quiz</span>
          <span className="text-neon-accent">eum</span>
        </Link>

        <div className={styles.actions}>
          {loading ? (
            <div className={styles.skeletonAvatar} />
          ) : user ? (
            <div className={styles.userWrapper}>
              <Link
                href="/quiz/create"
                className={styles.createBtn}
                data-testid="mobile-header-create-btn"
                data-analytics="nav-create-quiz"
              >
                <PlusCircle size={20} />
              </Link>

              <div className={styles.profileContainer}>
                {popupOpen && (
                  <>
                    <div className={styles.backdrop} onClick={() => setPopupOpen(false)} />
                    <div
                      className={`${styles.popupMenu} glass-card animate-fade-in`}
                      data-testid="header-profile-popup"
                    >
                      <Link
                        href="/lists"
                        className={styles.popupItem}
                        onClick={() => setPopupOpen(false)}
                        data-testid="header-nav-lists"
                      >
                        <List size={18} />
                        <span>リスト</span>
                      </Link>
                      <Link
                        href="/my-quiz"
                        className={styles.popupItem}
                        onClick={() => setPopupOpen(false)}
                        data-testid="header-nav-my-quiz"
                      >
                        <ClipboardList size={18} />
                        <span>マイクイズ</span>
                      </Link>
                      <Link
                        href={`/profile/${user.id}`}
                        className={styles.popupItem}
                        onClick={() => setPopupOpen(false)}
                      >
                        <UserIcon size={18} />
                        <span>マイページ</span>
                      </Link>
                      <Link
                        href="/settings"
                        className={styles.popupItem}
                        onClick={() => setPopupOpen(false)}
                        data-testid="header-settings-link"
                      >
                        <Settings size={18} />
                        <span>設定</span>
                      </Link>
                      <hr className={styles.divider} />
                      <button
                        onClick={handleLogout}
                        className={`${styles.popupItem} ${styles.logoutItem}`}
                        data-analytics="auth-logout"
                      >
                        <LogOut size={18} />
                        <span>ログアウト</span>
                      </button>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  className={styles.profileBtn}
                  onClick={() => setPopupOpen(!popupOpen)}
                  data-testid="header-profile-btn"
                >
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className={styles.avatar}
                  />
                </button>
              </div>
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
