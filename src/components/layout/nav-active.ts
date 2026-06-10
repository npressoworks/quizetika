export function isNavItemActive(pathname: string | null, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/search') {
    return pathname === '/search' || (pathname?.startsWith('/search/') ?? false);
  }
  if (href === '/my-quiz') {
    return pathname === '/my-quiz' || (pathname?.startsWith('/my-quiz/') ?? false);
  }
  return pathname === href;
}

export function isHomeActive(pathname: string | null): boolean {
  return pathname === '/';
}

export function isSearchActive(pathname: string | null): boolean {
  return pathname === '/search' || (pathname?.startsWith('/search/') ?? false);
}
