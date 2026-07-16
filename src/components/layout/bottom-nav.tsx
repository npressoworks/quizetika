'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import {
  HomeOutlined,
  Home,
  SearchOutlined,
  Search,
  NotificationsOutlined,
  Notifications,
  BookmarkBorderOutlined,
  Bookmark,
  PersonOutlined,
} from '@mui/icons-material';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { isHomeActive, isSearchActive } from './nav-active';

const bottomNavLinkBase =
  'flex h-full flex-1 items-center justify-center text-muted-foreground transition-colors hover:bg-white hover:text-foreground dark:hover:bg-white/10';

const bottomNavLinkActive = 'active text-primary';

export const BottomNav: React.FC = () => {
  const { user } = useAuth();
  const pathname = usePathname();

  if (pathname && pathname.includes('/play')) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[90] flex h-[60px] items-center justify-around border-t border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <Link
        href="/"
        className={cn(bottomNavLinkBase, isHomeActive(pathname) && bottomNavLinkActive)}
        data-testid="bottom-nav-home"
      >
        {isHomeActive(pathname) ? (
          <Home sx={{ fontSize: 22 }} />
        ) : (
          <HomeOutlined sx={{ fontSize: 22 }} />
        )}
      </Link>

      <Link
        href="/search"
        className={cn(bottomNavLinkBase, isSearchActive(pathname) && bottomNavLinkActive)}
        data-testid="bottom-nav-search"
      >
        {isSearchActive(pathname) ? (
          <Search sx={{ fontSize: 22 }} />
        ) : (
          <SearchOutlined sx={{ fontSize: 22 }} />
        )}
      </Link>

      {user ? (
        <>
          <Link
            href="/notifications"
            className={cn(bottomNavLinkBase, pathname === '/notifications' && bottomNavLinkActive)}
            data-testid="bottom-nav-notifications"
          >
            {pathname === '/notifications' ? (
              <Notifications sx={{ fontSize: 22 }} />
            ) : (
              <NotificationsOutlined sx={{ fontSize: 22 }} />
            )}
          </Link>

          <Link
            href="/bookmarks"
            className={cn(bottomNavLinkBase, pathname === '/bookmarks' && bottomNavLinkActive)}
            data-testid="bottom-nav-bookmarks"
          >
            {pathname === '/bookmarks' ? (
              <Bookmark sx={{ fontSize: 22 }} />
            ) : (
              <BookmarkBorderOutlined sx={{ fontSize: 22 }} />
            )}
          </Link>

          <Link
            href={`/profile/${user.id}`}
            className={cn(
              bottomNavLinkBase,
              pathname?.includes(`/profile/${user.id}`) && bottomNavLinkActive,
            )}
            data-testid="bottom-nav-profile"
          >
            {user.avatarUrl ? (
              <Avatar size="sm" className="size-6">
                <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                <AvatarFallback>
                  <PersonOutlined sx={{ fontSize: 16 }} />
                </AvatarFallback>
              </Avatar>
            ) : (
              <PersonOutlined sx={{ fontSize: 22 }} />
            )}
          </Link>
        </>
      ) : null}
    </nav>
  );
};

export default BottomNav;
