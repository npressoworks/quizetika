'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { BottomNav } from './bottom-nav';
import styles from './layout-wrapper.module.css';

export const LayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isPlayPage = pathname ? pathname.includes('/play') : false;

  if (isPlayPage) {
    return <div className={styles.playContainer}>{children}</div>;
  }

  return (
    <div className={styles.appContainer}>
      <Sidebar />
      <div className={styles.mainWrapper}>
        <Header />
        <main className={styles.content}>{children}</main>
      </div>
      <BottomNav />
    </div>
  );
};

export default LayoutWrapper;
