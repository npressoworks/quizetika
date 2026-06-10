import {
  isHomeActive,
  isNavItemActive,
  isSearchActive,
} from '../../src/components/layout/nav-active';

describe('nav-active', () => {
  describe('isNavItemActive', () => {
    test('home exact match', () => {
      expect(isNavItemActive('/', '/')).toBe(true);
      expect(isNavItemActive('/search', '/')).toBe(false);
    });

    test('search prefix', () => {
      expect(isNavItemActive('/search', '/search')).toBe(true);
      expect(isNavItemActive('/search/foo', '/search')).toBe(true);
      expect(isNavItemActive('/', '/search')).toBe(false);
    });

    test('my-quiz prefix', () => {
      expect(isNavItemActive('/my-quiz', '/my-quiz')).toBe(true);
      expect(isNavItemActive('/my-quiz/session', '/my-quiz')).toBe(true);
    });
  });

  describe('isHomeActive / isSearchActive', () => {
    test('mutually exclusive on root and search', () => {
      expect(isHomeActive('/')).toBe(true);
      expect(isSearchActive('/')).toBe(false);

      expect(isHomeActive('/search')).toBe(false);
      expect(isSearchActive('/search')).toBe(true);
    });
  });
});
