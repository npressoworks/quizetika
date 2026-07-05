import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkSpecCompletion,
  scanForFirebaseReferences,
  runGate,
} from '../../scripts/verify-firebase-removed.js';

function makeTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

// フィクスチャの specifier 文字列は実行時に組み立てる。このテストファイル自身が
// verify-firebase-removed の Stage B スキャン対象になった際に、フィクスチャの
// リテラル文字列を「残存 Firebase 参照」として誤検知しないようにするため。
const FIRESTORE_SPECIFIER = ['firebase', 'firestore'].join('/');
const FIREBASE_ADMIN_LIB_SPECIFIER = ['@/lib/firebase', 'admin'].join('/');
const FIREBASE_APP_SPECIFIER = ['firebase', 'app'].join('/');

describe('checkSpecCompletion', () => {
  let specDir: string;

  afterEach(() => {
    rmSync(specDir, { recursive: true, force: true });
  });

  it('全スペックの phase が implementation-complete の場合、pass=true で incomplete が空になる', () => {
    specDir = makeTempDir('verify-firebase-specs-complete-');
    for (const name of ['spec-a', 'spec-b']) {
      mkdirSync(join(specDir, name), { recursive: true });
      writeFileSync(
        join(specDir, name, 'spec.json'),
        JSON.stringify({ phase: 'implementation-complete' })
      );
    }

    const result = checkSpecCompletion(specDir, ['spec-a', 'spec-b']);

    expect(result.pass).toBe(true);
    expect(result.complete).toEqual(['spec-a', 'spec-b']);
    expect(result.incomplete).toEqual([]);
  });

  it('一部のスペックが implementation-complete でない場合、該当スペック名を incomplete に含め pass=false になる', () => {
    specDir = makeTempDir('verify-firebase-specs-partial-');
    mkdirSync(join(specDir, 'spec-a'), { recursive: true });
    writeFileSync(
      join(specDir, 'spec-a', 'spec.json'),
      JSON.stringify({ phase: 'implementation-complete' })
    );
    mkdirSync(join(specDir, 'spec-b'), { recursive: true });
    writeFileSync(join(specDir, 'spec-b', 'spec.json'), JSON.stringify({ phase: 'implementation' }));

    const result = checkSpecCompletion(specDir, ['spec-a', 'spec-b']);

    expect(result.pass).toBe(false);
    expect(result.complete).toEqual(['spec-a']);
    expect(result.incomplete).toEqual(['spec-b (phase: implementation)']);
  });

  it('spec.json が存在しないスペックは未検出として incomplete に含める', () => {
    specDir = makeTempDir('verify-firebase-specs-missing-');
    mkdirSync(specDir, { recursive: true });

    const result = checkSpecCompletion(specDir, ['spec-missing']);

    expect(result.pass).toBe(false);
    expect(result.incomplete).toEqual(['spec-missing (spec.json not found)']);
  });
});

describe('scanForFirebaseReferences', () => {
  let scanDir: string;

  afterEach(() => {
    rmSync(scanDir, { recursive: true, force: true });
  });

  it('firebase パッケージまたは lib/firebase を import するファイルを検出する', () => {
    scanDir = makeTempDir('verify-firebase-scan-hits-');
    writeFileSync(join(scanDir, 'a.ts'), `import { db } from '${FIRESTORE_SPECIFIER}';\n`);
    writeFileSync(
      join(scanDir, 'b.ts'),
      `import { getAdminFirestore } from '${FIREBASE_ADMIN_LIB_SPECIFIER}';\n`
    );
    writeFileSync(
      join(scanDir, 'e.ts'),
      `async function f() {\n  const { doc } = await import('${FIRESTORE_SPECIFIER}');\n}\n`
    );

    const findings = scanForFirebaseReferences([scanDir]);
    const foundFiles = findings.map((f) => f.file).sort();

    expect(foundFiles).toEqual(
      [join(scanDir, 'a.ts'), join(scanDir, 'b.ts'), join(scanDir, 'e.ts')].sort()
    );
  });

  it('firebase を import しないファイルは検出しない（識別子名のみの一致を誤検知しない）', () => {
    scanDir = makeTempDir('verify-firebase-scan-misses-');
    writeFileSync(
      join(scanDir, 'c.ts'),
      `const firebaseUser = getUser();\nconsole.log(firebaseUser.uid);\n`
    );
    writeFileSync(join(scanDir, 'd.ts'), `import { z } from 'zod';\n`);

    const findings = scanForFirebaseReferences([scanDir]);

    expect(findings).toEqual([]);
  });

  it('実際のリポジトリ内の既知ファイル（firebaseUser 識別子名のみ）を誤検知しない', () => {
    // Firebase 完全削除後は実リポジトリ内に正例（生きた firebase import）が存在しないため、
    // 負例（識別子名のみで誤検知しないこと）のみを実ファイルで検証する。正例は他テストの合成フィクスチャで検証済み。
    const noFindings = scanForFirebaseReferences([
      join(process.cwd(), 'src', 'context', 'auth-context.tsx'),
    ]);
    expect(noFindings).toEqual([]);
  });

  it('node_modules ディレクトリはスキャン対象から除外する', () => {
    scanDir = makeTempDir('verify-firebase-scan-node-modules-');
    mkdirSync(join(scanDir, 'node_modules', 'firebase'), { recursive: true });
    writeFileSync(
      join(scanDir, 'node_modules', 'firebase', 'index.js'),
      `module.exports = require('${FIREBASE_APP_SPECIFIER}');\n`
    );

    const findings = scanForFirebaseReferences([scanDir]);

    expect(findings).toEqual([]);
  });
});

describe('runGate', () => {
  let specDir: string;
  let scanDir: string;

  afterEach(() => {
    rmSync(specDir, { recursive: true, force: true });
    rmSync(scanDir, { recursive: true, force: true });
  });

  it('Stage A と Stage B の両方が Pass の場合のみ全体で pass=true になる', () => {
    specDir = makeTempDir('verify-firebase-gate-specs-');
    mkdirSync(join(specDir, 'spec-a'), { recursive: true });
    writeFileSync(
      join(specDir, 'spec-a', 'spec.json'),
      JSON.stringify({ phase: 'implementation-complete' })
    );
    scanDir = makeTempDir('verify-firebase-gate-scan-');
    writeFileSync(join(scanDir, 'clean.ts'), `import { z } from 'zod';\n`);

    const result = runGate({ specDir, specNames: ['spec-a'], scanRoots: [scanDir] });

    expect(result.pass).toBe(true);
    expect(result.stageA.pass).toBe(true);
    expect(result.stageB.pass).toBe(true);
  });

  it('Stage B で残存参照が見つかった場合は全体が pass=false になる', () => {
    specDir = makeTempDir('verify-firebase-gate-specs-');
    mkdirSync(join(specDir, 'spec-a'), { recursive: true });
    writeFileSync(
      join(specDir, 'spec-a', 'spec.json'),
      JSON.stringify({ phase: 'implementation-complete' })
    );
    scanDir = makeTempDir('verify-firebase-gate-scan-');
    writeFileSync(join(scanDir, 'dirty.ts'), `import { db } from '${FIRESTORE_SPECIFIER}';\n`);

    const result = runGate({ specDir, specNames: ['spec-a'], scanRoots: [scanDir] });

    expect(result.pass).toBe(false);
    expect(result.stageA.pass).toBe(true);
    expect(result.stageB.pass).toBe(false);
    expect(result.stageB.findings).toHaveLength(1);
  });
});
