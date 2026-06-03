import {
  validateGenreIconFile,
  GENRE_ICON_MAX_BYTES,
  GENRE_ICON_ALLOWED_MIME_TYPES,
} from '@/lib/genre-icon-upload';

function mockFile(type: string, size: number): File {
  return { type, size } as File;
}

describe('validateGenreIconFile', () => {
  it('PNG/JPEG/GIF を許可する', () => {
    for (const type of GENRE_ICON_ALLOWED_MIME_TYPES) {
      expect(validateGenreIconFile(mockFile(type, 1000))).toEqual({ ok: true });
    }
  });

  it('SVG を拒否する', () => {
    const result = validateGenreIconFile(mockFile('image/svg+xml', 500));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/PNG, JPEG, GIF/);
    }
  });

  it('2MB 超過を拒否する', () => {
    const result = validateGenreIconFile(
      mockFile('image/png', GENRE_ICON_MAX_BYTES + 1)
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/2MB/);
    }
  });

  it('空 MIME を拒否する', () => {
    const result = validateGenreIconFile(mockFile('', 100));
    expect(result.ok).toBe(false);
  });
});
