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
} from 'lucide-react';
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

export const Sidebar: React.FC = () => {
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
        'fixed top-0 left-0 z-[90] box-border hidden h-screen flex-col border-r border-border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:flex md:w-[70px] md:px-2 lg:w-[275px] lg:p-6 lg:px-4 max-md:hidden',
      )}
    >
      <div className="mb-8 px-2 md:max-lg:px-0">
        <Link href="/" className="flex items-center text-2xl font-extrabold tracking-tight lg:text-3xl">
          <span>Quiz</span>
          <span className="lg:inline md:max-lg:hidden">eum</span>
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
              <span className="nav-label max-lg:hidden">{item.label}</span>
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
            <span className="nav-label max-lg:hidden">ダッシュボード</span>
          </Link>
        )}

        {user && (
          <Link
            href="/quiz/create"
            className={cn(
              'mt-4 inline-flex items-center justify-center gap-2.5 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 md:max-lg:mx-auto md:max-lg:size-11 md:max-lg:rounded-full md:max-lg:p-0',
            )}
            data-analytics="nav-create-quiz"
          >
            <PlusCircle size={22} />
            <span className="nav-label max-lg:hidden">作問する</span>
          </Link>
        )}
      </nav>

      <div className="mt-auto border-t border-border pt-4">
        {loading ? (
          <Skeleton className="size-11 rounded-full" />
        ) : user ? (
          <DropdownMenu open={popupOpen} onOpenChange={setPopupOpen}>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-full p-2 text-left transition-colors hover:bg-muted/50 md:max-lg:mx-auto md:max-lg:size-11 md:max-lg:justify-center md:max-lg:p-0"
                  data-testid="sidebar-profile-btn"
                />
              }
            >
              <Avatar size="sm" className="size-10">
                <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                <AvatarFallback>{user.displayName.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 max-lg:hidden">
                <span className="block truncate text-sm font-semibold">{user.displayName}</span>
              </div>
              <ChevronUp size={16} className="text-muted-foreground max-lg:hidden" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="end"
              sideOffset={12}
              className="z-[100] w-[220px]"
            >
              <DropdownMenuItem
                render={
                  <Link href={`/profile/${user.id}`} onClick={() => setPopupOpen(false)} />
                }
              >
                <UserIcon size={18} />
                <span>マイページ</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings"
                    onClick={() => setPopupOpen(false)}
                    data-testid="sidebar-settings-link"
                  />
                }
              >
                <Settings size={18} />
                <span>設定</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout} data-analytics="auth-logout">
                <LogOut size={18} />
                <span>ログアウト</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
