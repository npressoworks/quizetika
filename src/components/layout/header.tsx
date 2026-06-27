'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase/config';
import { signOut } from '@/lib/firebase/auth';
import {
  AddCircleOutlineOutlined,
  PersonOutlined,
  LogoutOutlined,
  AssignmentOutlined,
  SettingsOutlined,
  AdminPanelSettingsOutlined,
} from '@mui/icons-material';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
    <header className="sticky top-0 z-[90] border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-between gap-5 px-4 py-3">
        <Link href="/" className="flex items-center text-xl font-extrabold tracking-tight">
          <span>Quiz</span>
          <span>eum</span>
        </Link>

        <div className="flex items-center gap-4">
          {loading ? (
            <Skeleton className="size-8 rounded-full" />
          ) : user ? (
            <div className="flex items-center gap-4">
              <Link
                href="/quiz/create"
                className="flex items-center justify-center text-muted-foreground transition-colors hover:text-primary"
                data-testid="mobile-header-create-btn"
                data-analytics="nav-create-quiz"
              >
                <AddCircleOutlineOutlined sx={{ fontSize: 20 }} />
              </Link>

              <DropdownMenu open={popupOpen} onOpenChange={setPopupOpen}>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="flex items-center rounded-full"
                      data-testid="header-profile-btn"
                    />
                  }
                >
                  <Avatar size="sm" className="size-8">
                    <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                    <AvatarFallback>{user.displayName.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={12}
                  className="w-[200px]"
                  data-testid="header-profile-popup"
                >
                  {isAdminUser(user) && (
                    <DropdownMenuItem
                      render={
                        <Link
                          href="/admin"
                          onClick={() => setPopupOpen(false)}
                          data-testid="header-admin-link"
                        />
                      }
                    >
                      <AdminPanelSettingsOutlined sx={{ fontSize: 18 }} />
                      <span>管理者メニュー</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    render={
                      <Link
                        href="/my-quiz"
                        onClick={() => setPopupOpen(false)}
                        data-testid="header-nav-my-quiz"
                      />
                    }
                  >
                    <AssignmentOutlined sx={{ fontSize: 18 }} />
                    <span>カスタムクイズ</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={
                      <Link href={`/profile/${user.id}`} onClick={() => setPopupOpen(false)} />
                    }
                  >
                    <PersonOutlined sx={{ fontSize: 18 }} />
                    <span>マイページ</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={
                      <Link
                        href="/settings"
                        onClick={() => setPopupOpen(false)}
                        data-testid="header-settings-link"
                      />
                    }
                  >
                    <SettingsOutlined sx={{ fontSize: 18 }} />
                    <span>設定</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={handleLogout} data-analytics="auth-logout">
                    <LogoutOutlined sx={{ fontSize: 18 }} />
                    <span>ログアウト</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Link href="/login" className={buttonVariants({ size: 'sm' })} data-analytics="nav-login">
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
