'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Home, Search, Bell, Bookmark, User as UserIcon } from 'lucide-react';
import styles from './bottom-nav.module.css';

function isHomeActive(pathname: string | null): boolean {
  return pathname === '/';
}

function isSearchActive(pathname: string | null): boolean {
  return pathname === '/search' || (pathname?.startsWith('/search/') ?? false);
}

export const BottomNav: React.FC = () => {
  const { user } = useAuth();
  const pathname = usePathname();

  // クイズプレイ画面では非表示にする
  if (pathname && pathname.includes('/play')) {
    return null;
  }

  return (
    <nav className={`${styles.bottomNav} glass-card`}>
      <Link
        href="/"
        className={`${styles.navLink} ${isHomeActive(pathname) ? styles.active : ''}`}
        data-testid="bottom-nav-home"
      >
        <Home size={22} />
      </Link>

      <Link
        href="/search"
        className={`${styles.navLink} ${isSearchActive(pathname) ? styles.active : ''}`}
        data-testid="bottom-nav-search"
      >
        <Search size={22} />
      </Link>

      {user ? (
        <>
          <Link
            href="/notifications"
            className={`${styles.navLink} ${pathname === '/notifications' ? styles.active : ''}`}
            data-testid="bottom-nav-notifications"
          >
            <Bell size={22} />
          </Link>

          <Link
            href="/bookmarks"
            className={`${styles.navLink} ${pathname === '/bookmarks' ? styles.active : ''}`}
            data-testid="bottom-nav-bookmarks"
          >
            <Bookmark size={22} />
          </Link>

          <Link
            href={`/profile/${user.id}`}
            className={`${styles.navLink} ${pathname && pathname.includes(`/profile/${user.id}`) ? styles.active : ''}`}
            data-testid="bottom-nav-profile"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName} className={styles.avatar} />
            ) : (
              <UserIcon size={22} />
            )}
          </Link>
        </>
      ) : null}
    </nav>
  );
};

export default BottomNav;
