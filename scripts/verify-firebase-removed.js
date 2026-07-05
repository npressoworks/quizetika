'use strict';

/**
 * supabase-cleanup の MigrationCompletionGate。
 * CommonJS で実装しているのは、Jest から require() で直接ユニットテストするため
 * （他の scripts/*.mjs と異なり、このファイルはテスト対象として import される）。
 *
 * Stage A: 依存する supabase-* スペックの spec.json.phase が implementation-complete か確認する
 * Stage B: ソースツリーに Firebase パッケージへの import/require が残っていないか確認する
 */

const { readFileSync, existsSync, readdirSync, statSync } = require('node:fs');
const { join, extname, resolve } = require('node:path');

const REQUIRED_SPECS = [
  'supabase-auth-migration',
  'supabase-core-data',
  'supabase-gameplay',
  'supabase-storage-migration',
  'supabase-governance',
];

const DEFAULT_SCAN_ROOTS = ['src', 'tests', 'e2e'];
const SCANNABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const IGNORED_DIR_NAMES = new Set(['node_modules', '.next', '.git']);

// from '...' / require('...') / import('...') の specifier のみを対象にする。
// 識別子名（例: firebaseUser, firebaseUid）は対象にならない。
const IMPORT_SPECIFIER_PATTERN = /(?:from\s+|require\(\s*|import\(\s*)['"]([^'"]+)['"]/g;
const FIREBASE_SPECIFIER_PATTERN = /^firebase(-admin)?(\/.*)?$|lib\/firebase(\/|$)/;

function checkSpecCompletion(specDir, specNames = REQUIRED_SPECS) {
  const complete = [];
  const incomplete = [];

  for (const name of specNames) {
    const specJsonPath = join(specDir, name, 'spec.json');
    if (!existsSync(specJsonPath)) {
      incomplete.push(`${name} (spec.json not found)`);
      continue;
    }

    const spec = JSON.parse(readFileSync(specJsonPath, 'utf8'));
    if (spec.phase === 'implementation-complete') {
      complete.push(name);
    } else {
      incomplete.push(`${name} (phase: ${spec.phase})`);
    }
  }

  return { complete, incomplete, pass: incomplete.length === 0 };
}

function extractSpecifiers(content) {
  const specifiers = [];
  IMPORT_SPECIFIER_PATTERN.lastIndex = 0;
  let match;
  while ((match = IMPORT_SPECIFIER_PATTERN.exec(content)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function isFirebaseSpecifier(specifier) {
  return FIREBASE_SPECIFIER_PATTERN.test(specifier);
}

function walkScannableFiles(root, files = []) {
  if (!existsSync(root)) return files;

  const rootStat = statSync(root);
  if (rootStat.isFile()) {
    if (SCANNABLE_EXTENSIONS.has(extname(root))) files.push(root);
    return files;
  }

  for (const entry of readdirSync(root)) {
    if (IGNORED_DIR_NAMES.has(entry)) continue;

    const fullPath = join(root, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walkScannableFiles(fullPath, files);
    } else if (SCANNABLE_EXTENSIONS.has(extname(entry))) {
      files.push(fullPath);
    }
  }

  return files;
}

function scanForFirebaseReferences(scanRoots = DEFAULT_SCAN_ROOTS) {
  const findings = [];

  for (const root of scanRoots) {
    for (const file of walkScannableFiles(root)) {
      const content = readFileSync(file, 'utf8');
      const firebaseSpecifiers = [...new Set(extractSpecifiers(content).filter(isFirebaseSpecifier))];

      if (firebaseSpecifiers.length > 0) {
        findings.push({ file, specifiers: firebaseSpecifiers });
      }
    }
  }

  return findings;
}

function runGate({
  specDir = resolve('.kiro/specs'),
  specNames = REQUIRED_SPECS,
  scanRoots = DEFAULT_SCAN_ROOTS,
} = {}) {
  const stageA = checkSpecCompletion(specDir, specNames);
  const findings = scanForFirebaseReferences(scanRoots);
  const stageB = { findings, pass: findings.length === 0 };

  return { stageA, stageB, pass: stageA.pass && stageB.pass };
}

function formatReport(result) {
  const lines = [];

  lines.push('=== MigrationCompletionGate: Stage A (依存スペック完了確認) ===');
  if (result.stageA.pass) {
    lines.push(`PASS: 全スペックが implementation-complete です (${result.stageA.complete.join(', ')})`);
  } else {
    lines.push('FAIL: 以下のスペックが未完了です:');
    for (const entry of result.stageA.incomplete) {
      lines.push(`  - ${entry}`);
    }
  }

  lines.push('');
  lines.push('=== MigrationCompletionGate: Stage B (残存 Firebase 参照検出) ===');
  if (result.stageB.pass) {
    lines.push('PASS: Firebase パッケージへの参照は検出されませんでした');
  } else {
    lines.push('FAIL: 以下のファイルに Firebase への参照が残っています:');
    for (const finding of result.stageB.findings) {
      lines.push(`  - ${finding.file} (${finding.specifiers.join(', ')})`);
    }
  }

  lines.push('');
  lines.push(result.pass ? 'RESULT: PASS' : 'RESULT: FAIL');

  return lines.join('\n');
}

function main() {
  const result = runGate();
  // eslint-disable-next-line no-console
  console.log(formatReport(result));
  process.exit(result.pass ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkSpecCompletion,
  scanForFirebaseReferences,
  runGate,
  formatReport,
};
