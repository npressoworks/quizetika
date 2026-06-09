'use client';

import React from 'react';
import { Search } from 'lucide-react';
import styles from './lists.module.css';

interface ListsSearchBarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
}

export function ListsSearchBar({ keyword, onKeywordChange }: ListsSearchBarProps) {
  return (
    <div className={styles.searchBar}>
      <Search size={18} className={styles.searchIcon} />
      <input
        type="search"
        className={styles.searchInput}
        placeholder="リストをキーワード検索..."
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        data-testid="lists-search-input"
      />
    </div>
  );
}
