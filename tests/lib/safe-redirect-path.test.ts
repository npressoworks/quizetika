import { getSafeRedirectPath } from '@/lib/safe-redirect-path';

describe('getSafeRedirectPath', () => {
  it('有効な相対パスを返す', () => {
    expect(getSafeRedirectPath('/community/genres')).toBe('/community/genres');
  });

  it('外部 URL や不正な値は fallback を返す', () => {
    expect(getSafeRedirectPath('https://evil.example')).toBe('/');
    expect(getSafeRedirectPath('//evil.example')).toBe('/');
    expect(getSafeRedirectPath(null)).toBe('/');
    expect(getSafeRedirectPath(undefined)).toBe('/');
  });
});
