'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { 
  Trophy, 
  Search, 
  BookOpen, 
  PlusCircle, 
  User as UserIcon, 
  LogOut, 
  ChevronDown, 
  Menu, 
  X 
} from 'lucide-react';
import styles from './header.module.css';

export const Header: React.FC = () => {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setDropdownOpen(false);
      setMobileMenuOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navLinks = [
    { href: '/', label: 'ホーム', icon: <Trophy size={18} /> },
    { href: '/explore', label: 'さがす', icon: <Search size={18} /> },
    { href: '/lists', label: '問題集', icon: <BookOpen size={18} /> },
  ];

  return (
    <header className={`${styles.header} glass-card`}>
      <div className={styles.container}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <span className="text-neon-primary">Quiz</span>
          <span className="text-neon-accent">eum</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className={styles.desktopNav}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.href} 
                href={link.href} 
                className={`${styles.navLink} ${isActive ? styles.activeNavLink : ''}`}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Desktop User Menu */}
        <div className={styles.desktopUser}>
          {loading ? (
            <div className={styles.skeletonAvatar} />
          ) : user ? (
            <div className={styles.userWrapper}>
              {/* クイズ作成ボタン */}
              <Link href="/quiz/create" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                <PlusCircle size={16} />
                <span>作問する</span>
              </Link>
              
              {/* アバタードロップダウン */}
              <div className={styles.avatarDropdownContainer}>
                <button 
                  className={styles.avatarButton}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <img 
                    src={user.avatarUrl} 
                    alt={user.displayName} 
                    className={styles.avatar} 
                  />
                  <ChevronDown size={14} className={dropdownOpen ? styles.rotateChevron : ''} />
                </button>

                {dropdownOpen && (
                  <>
                    <div className={styles.backdrop} onClick={() => setDropdownOpen(false)} />
                    <div className={`${styles.dropdownMenu} glass-card animate-fade-in`}>
                      <div className={styles.dropdownHeader}>
                        <div className={styles.dropdownName}>{user.displayName}</div>
                        <div className={styles.dropdownEmail}>{user.email}</div>
                      </div>
                      <hr className={styles.divider} />
                      <Link 
                        href={`/profile/${user.id}`} 
                        className={styles.dropdownItem}
                        onClick={() => setDropdownOpen(false)}
                      >
                        <UserIcon size={16} />
                        <span>マイページ</span>
                      </Link>
                      <Link 
                        href="/creator/dashboard" 
                        className={styles.dropdownItem}
                        onClick={() => setDropdownOpen(false)}
                      >
                        <BookOpen size={16} />
                        <span>ダッシュボード</span>
                      </Link>
                      <hr className={styles.divider} />
                      <button 
                        onClick={handleLogout} 
                        className={`${styles.dropdownItem} ${styles.logoutItem}`}
                      >
                        <LogOut size={16} />
                        <span>ログアウト</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <Link href="/login" className="btn btn-accent" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
              ログイン
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button 
          className={styles.mobileMenuButton}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation Panel */}
      {mobileMenuOpen && (
        <div className={`${styles.mobileMenu} glass-card animate-fade-in`}>
          <nav className={styles.mobileNav}>
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link 
                  key={link.href} 
                  href={link.href} 
                  className={`${styles.mobileNavLink} ${isActive ? styles.mobileActiveNavLink : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              );
            })}
            
            <hr className={styles.mobileDivider} />
            
            {user ? (
              <div className={styles.mobileUserData}>
                <div className={styles.mobileUserInfo}>
                  <img src={user.avatarUrl} alt={user.displayName} className={styles.mobileAvatar} />
                  <div>
                    <div className={styles.mobileName}>{user.displayName}</div>
                    <div className={styles.mobileEmail}>{user.email}</div>
                  </div>
                </div>
                
                <Link 
                  href="/quiz/create" 
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '10px' }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <PlusCircle size={18} />
                  <span>作問する</span>
                </Link>
                
                <Link 
                  href={`/profile/${user.id}`} 
                  className={styles.mobileDropdownItem}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <UserIcon size={18} />
                  <span>マイページ</span>
                </Link>
                
                <Link 
                  href="/creator/dashboard" 
                  className={styles.mobileDropdownItem}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <BookOpen size={18} />
                  <span>ダッシュボード</span>
                </Link>
                
                <button 
                  onClick={handleLogout} 
                  className={`${styles.mobileDropdownItem} ${styles.mobileLogoutItem}`}
                >
                  <LogOut size={18} />
                  <span>ログアウト</span>
                </button>
              </div>
            ) : (
              <Link 
                href="/login" 
                className="btn btn-accent" 
                style={{ width: '100%', marginTop: '10px' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                ログイン
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
