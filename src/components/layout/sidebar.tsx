'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase/config';
import { signOut } from '@/lib/firebase/auth';
import {
  Trophy,
  Bell,
  Bookmark,
  PlusCircle,
  BookOpen,
  User as UserIcon,
  LogOut,
  ChevronUp,
  Home
} from 'lucide-react';
import styles from './sidebar.module.css';

export const Sidebar: React.FC = () => {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [popupOpen, setPopupOpen] = useState(false);

  // クイズプレイ画面では非表示にする
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

  const menuItems = [
    { href: '/', label: 'ホーム', icon: <Home size={22} /> },
  ];

  if (user) {
    menuItems.push(
      { href: '/notifications', label: '通知', icon: <Bell size={22} /> },
      { href: '/bookmarks', label: 'ブックマーク', icon: <Bookmark size={22} /> }
    );
  }

  return (
    <aside className={`${styles.sidebar} glass-card`}>
      <div className={styles.topSection}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <span className="text-neon-primary">Quiz</span>
          <span className={`${styles.logoAccent} text-neon-accent`}>eum</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className={styles.navMenu}>
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.iconWrapper}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}

        {/* クリエイターダッシュボードへのリンク (ログイン時のみ) */}
        {user && (
          <Link
            href="/creator/dashboard"
            className={`${styles.navLink} ${pathname === '/creator/dashboard' ? styles.active : ''}`}
          >
            <span className={styles.iconWrapper}><BookOpen size={22} /></span>
            <span className={styles.label}>ダッシュボード</span>
          </Link>
        )}

        {/* 作問ボタン (ログイン時のみ) */}
        {user && (
          <Link href="/quiz/create" className={styles.createBtn}>
            <PlusCircle size={22} />
            <span className={styles.createBtnLabel}>作問する</span>
          </Link>
        )}
      </nav>

      {/* User Session Section at Footer */}
      <div className={styles.footerSection}>
        {loading ? (
          <div className={styles.skeletonAvatar} />
        ) : user ? (
          <div className={styles.profileContainer}>
            {popupOpen && (
              <>
                <div className={styles.backdrop} onClick={() => setPopupOpen(false)} />
                <div className={`${styles.popupMenu} glass-card animate-fade-in`}>
                  <Link
                    href={`/profile/${user.id}`}
                    className={styles.popupItem}
                    onClick={() => setPopupOpen(false)}
                  >
                    <UserIcon size={18} />
                    <span>マイページ</span>
                  </Link>
                  <hr className={styles.divider} />
                  <button
                    onClick={handleLogout}
                    className={`${styles.popupItem} ${styles.logoutItem}`}
                  >
                    <LogOut size={18} />
                    <span>ログアウト</span>
                  </button>
                </div>
              </>
            )}

            <button
              className={styles.profileBtn}
              onClick={() => setPopupOpen(!popupOpen)}
              data-testid="sidebar-profile-btn"
            >
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className={styles.avatar}
              />
              <div className={styles.profileDetails}>
                <span className={styles.profileName}>{user.displayName}</span>
              </div>
              <ChevronUp size={16} className={styles.chevron} />
            </button>
          </div>
        ) : (
          <Link href="/login" className={`${styles.loginBtn} btn btn-accent`}>
            <span>ログイン</span>
          </Link>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
