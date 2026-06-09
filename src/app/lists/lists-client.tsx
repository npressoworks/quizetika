'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useListsSearch, type ListsVisibility } from '@/hooks/useListsSearch';
import { ListsVisibilityTabs } from '@/components/lists/lists-visibility-tabs';
import { ListsSearchBar } from '@/components/lists/lists-search-bar';
import { ListsGrid } from '@/components/lists/lists-grid';
import listStyles from '@/components/lists/lists.module.css';

export function ListsClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [visibility, setVisibility] = useState<ListsVisibility>('public');
  const { keyword, setKeyword, lists, loading, error, retry } = useListsSearch(
    user?.id,
    visibility
  );

  useEffect(() => {
    if (!authLoading && visibility === 'private' && !user) {
      router.push('/login?redirect=/lists');
    }
  }, [authLoading, visibility, user, router]);

  if (authLoading) {
    return <div data-testid="lists-skeleton">読み込み中...</div>;
  }

  if (visibility === 'private' && !user) {
    return null;
  }

  return (
    <div data-testid="lists-page-container">
      <Link href="/list/create" className={`btn btn-accent ${listStyles.createLink}`}>
        リストを作成
      </Link>
      <ListsSearchBar keyword={keyword} onKeywordChange={setKeyword} />
      <ListsVisibilityTabs activeTab={visibility} onTabChange={setVisibility} />
      <ListsGrid lists={lists} loading={loading} error={error} onRetry={retry} />
    </div>
  );
}
