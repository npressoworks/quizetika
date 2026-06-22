'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase/config';
import { signOut } from '@/lib/firebase/auth';
import {
  Bell,
  Bookmark,
  PlusCircle,
  BookOpen,
  User as UserIcon,
  LogOut,
  ChevronUp,
  Home,
  Search,
  Sparkles,
  ClipboardList,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { isNavItemActive } from './nav-active';

const navLinkBase =
  'flex items-center gap-4 rounded-lg px-4 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:max-lg:justify-center md:max-lg:px-3';

const navLinkActive =
  'active border-l-2 border-primary bg-accent/10 font-semibold text-accent-foreground md:max-lg:rounded-lg md:max-lg:border-l-0 md:max-lg:border-primary';

export interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false, onToggle }) => {
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

  const menuItems = [
    { href: '/', label: 'ホーム', icon: <Home size={22} />, testId: 'nav-home' },
    { href: '/search', label: '検索', icon: <Search size={22} />, testId: 'nav-search' },
    { href: '/pricing', label: 'Proプラン', icon: <Sparkles size={22} /> },
  ];

  if (user) {
    menuItems.splice(2, 0, {
      href: '/my-quiz',
      label: 'マイクイズ',
      icon: <ClipboardList size={22} />,
      testId: 'nav-my-quiz',
    });
    menuItems.push(
      { href: '/notifications', label: '通知', icon: <Bell size={22} /> },
      { href: '/bookmarks', label: 'ブックマーク', icon: <Bookmark size={22} /> },
    );
  }

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 z-[90] box-border hidden h-screen flex-col border-r border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:flex max-md:hidden transition-all duration-200',
        isCollapsed
          ? 'md:w-[70px] md:px-2 lg:w-[70px] lg:p-4 lg:px-2'
          : 'md:w-[70px] md:px-2 lg:w-[275px] lg:p-6 lg:px-4'
      )}
    >
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-[-14px] top-6 z-[100] hidden lg:flex size-7 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted text-muted-foreground transition-colors"
          data-testid="sidebar-toggle-btn"
          aria-label="Toggle Sidebar"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      )}

      <div className="mb-8 px-2 md:max-lg:px-0">
        <Link href="/" className="flex items-center text-2xl font-extrabold tracking-tight lg:text-3xl">
          <span>Quiz</span>
          <span className={cn("lg:inline md:max-lg:hidden", isCollapsed && "lg:hidden")}>eum</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {menuItems.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(navLinkBase, isActive && navLinkActive)}
              {...(item.testId ? { 'data-testid': item.testId } : {})}
            >
              <span className="flex size-6 shrink-0 items-center justify-center">{item.icon}</span>
              <span className={cn("nav-label max-lg:hidden", isCollapsed && "lg:hidden")}>{item.label}</span>
            </Link>
          );
        })}

        {user && (
          <Link
            href="/creator/dashboard"
            className={cn(
              navLinkBase,
              pathname === '/creator/dashboard' && navLinkActive,
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center">
              <BookOpen size={22} />
            </span>
            <span className={cn("nav-label max-lg:hidden", isCollapsed && "lg:hidden")}>ダッシュボード</span>
          </Link>
        )}

        {user && isAdminUser(user) && (
          <Link
            href="/admin"
            className={cn(
              navLinkBase,
              (pathname === '/admin' || pathname?.startsWith('/admin/')) && navLinkActive,
            )}
            data-testid="nav-admin"
          >
            <span className="flex size-6 shrink-0 items-center justify-center">
              <Shield size={22} />
            </span>
            <span className={cn("nav-label max-lg:hidden", isCollapsed && "lg:hidden")}>管理者メニュー</span>
          </Link>
        )}

        {user && (
          <Link
            href="/quiz/create"
            className={cn(
              'mt-4 inline-flex items-center justify-center gap-2.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 md:max-lg:mx-auto md:max-lg:size-11 md:max-lg:rounded-full md:max-lg:p-0',
              isCollapsed
                ? 'lg:mx-auto lg:size-11 lg:rounded-full lg:p-0'
                : 'lg:px-6 lg:py-3 lg:w-full',
            )}
            data-analytics="nav-create-quiz"
          >
            <PlusCircle size={22} />
            <span className={cn("nav-label max-lg:hidden", isCollapsed && "lg:hidden")}>作問する</span>
          </Link>
        )}
      </nav>

      <div className="mt-auto border-t border-border pt-4">
        {loading ? (
          <Skeleton className="size-11 rounded-full" />
        ) : user ? (
          <Link
            href={`/profile/${user.id}`}
            className={cn(
              "flex w-full items-center gap-3 rounded-full p-2 text-left transition-colors hover:bg-muted/50 md:max-lg:mx-auto md:max-lg:size-11 md:max-lg:justify-center md:max-lg:p-0",
              isCollapsed && "lg:mx-auto lg:size-11 lg:justify-center lg:p-0"
            )}
            data-testid="sidebar-profile-btn"
          >
            <Avatar size="sm" className="size-10">
              <AvatarImage src={user.avatarUrl} alt={user.displayName} />
              <AvatarFallback>{user.displayName.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className={cn("min-w-0 flex-1 max-lg:hidden", isCollapsed && "lg:hidden")}>
              <span className="block truncate text-sm font-semibold">{user.displayName}</span>
            </div>
          </Link>
        ) : (
          <Link href="/login" className={cn(buttonVariants(), 'w-full justify-center')} data-analytics="nav-login">
            ログイン
          </Link>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
