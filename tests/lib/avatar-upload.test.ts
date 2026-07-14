import {
  validateAvatarFile,
  assertAvatarFileValid,
  AVATAR_MAX_BYTES,
  AVATAR_ALLOWED_MIME_TYPES,
} from '@/lib/avatar-upload';

function mockFile(type: string, size: number): File {
  return { type, size } as File;
}

describe('validateAvatarFile', () => {
  it('PNG/JPEG/GIF を許可する', () => {
    for (const type of AVATAR_ALLOWED_MIME_TYPES) {
      expect(validateAvatarFile(mockFile(type, 1000))).toEqual({ ok: true });
    }
  });

  it('SVG を拒否する', () => {
    const result = validateAvatarFile(mockFile('image/svg+xml', 500));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/PNG, JPEG, GIF/);
    }
  });

  it('5MB 超過を拒否する', () => {
    const result = validateAvatarFile(mockFile('image/png', AVATAR_MAX_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/5MB/);
    }
  });

  it('5MB 以下は許可する', () => {
    expect(validateAvatarFile(mockFile('image/png', AVATAR_MAX_BYTES))).toEqual({ ok: true });
  });

  it('空 MIME を拒否する', () => {
    const result = validateAvatarFile(mockFile('', 100));
    expect(result.ok).toBe(false);
  });
});

describe('assertAvatarFileValid', () => {
  it('検証OKなら例外を投げない', () => {
    expect(() => assertAvatarFileValid(mockFile('image/png', 1000))).not.toThrow();
  });

  it('検証NGなら理由付きで例外を投げる', () => {
    expect(() => assertAvatarFileValid(mockFile('image/svg+xml', 500))).toThrow(/PNG, JPEG, GIF/);
  });
});
