import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const playwrightConfigSource = readFileSync(join(process.cwd(), 'playwright.config.ts'), 'utf8');

describe('playwright.config.ts の Firebase Emulator 依存除去', () => {
  it('Firebase Emulator 関連の環境変数・コメントを含まない', () => {
    expect(playwrightConfigSource).not.toMatch(/firebase/i);
  });
});
