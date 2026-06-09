/**
 * @jest-environment jsdom
 */

import {
  parseTheme,
  readStoredTheme,
  writeStoredTheme,
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
} from '../../src/lib/theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('parseTheme: valid values', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
  });

  test('parseTheme: invalid falls back to default', () => {
    expect(parseTheme(null)).toBe(DEFAULT_THEME);
    expect(parseTheme('invalid')).toBe(DEFAULT_THEME);
  });

  test('read/write stored theme', () => {
    writeStoredTheme('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(readStoredTheme()).toBe('light');
  });
});
