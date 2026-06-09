export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'quizeum-theme';
export const DEFAULT_THEME: Theme = 'dark';

const VALID_THEMES = new Set<Theme>(['dark', 'light']);

export function parseTheme(value: string | null): Theme {
  if (value && VALID_THEMES.has(value as Theme)) {
    return value as Theme;
  }
  return DEFAULT_THEME;
}

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage errors
  }
}

export function getThemeInitScript(): string {
  return `(function(){try{var k='${THEME_STORAGE_KEY}';var v=localStorage.getItem(k);var t=(v==='light'||v==='dark')?v:'${DEFAULT_THEME}';document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='${DEFAULT_THEME}';}})();`;
}
