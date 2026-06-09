'use client';

import React from 'react';
import { useTheme } from '@/context/theme-context';
import type { Theme } from '@/lib/theme';
import styles from './theme-toggle.module.css';

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'ダーク' },
  { value: 'light', label: 'ライト' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.toggleGroup} data-testid="settings-theme-toggle">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.toggleBtn} ${theme === opt.value ? styles.active : ''}`}
          onClick={() => setTheme(opt.value)}
          aria-pressed={theme === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
