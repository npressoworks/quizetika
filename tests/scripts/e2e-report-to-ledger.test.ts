import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT_PATH = resolve(__dirname, '../../scripts/e2e-report-to-ledger.mjs');
const FIXTURE_PATH = resolve(__dirname, 'fixtures/e2e-results-sample.json');

function runScript(resultsPath: string, ledgerPath: string) {
  return execFileSync('node', [SCRIPT_PATH, resultsPath, ledgerPath], {
    encoding: 'utf8',
  });
}

describe('e2e-report-to-ledger.mjs', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'e2e-ledger-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('既存Ledgerが無い場合、フィクスチャの失敗テスト2件をstatus: open のレコードとして生成する', () => {
    const ledgerPath = join(workDir, 'failure-ledger.md');

    const output = runScript(FIXTURE_PATH, ledgerPath);

    expect(output).toContain('2 failing test(s) detected');

    const ledgerContent = readFileSync(ledgerPath, 'utf8');
    expect(ledgerContent).toContain(
      '| e2e/admin-portal.spec.ts::非管理者ユーザーでのアクセス制限確認 | e2e/admin-portal.spec.ts | 非管理者ユーザーでのアクセス制限確認 | admin-portal |'
    );
    expect(ledgerContent).toContain(
      '| e2e/layout.spec.ts::Admin menu is visible and active | e2e/layout.spec.ts | Admin menu is visible and active | layout |'
    );
    expect(ledgerContent).not.toContain('ads.spec.ts');

    const openCount = ledgerContent.split('\n').filter((line) => line.includes('| open |')).length;
    expect(openCount).toBe(2);
  });

  it('既存Ledgerの調査済みフィールド(status等)を上書きせず、新規の失敗のみ追加する', () => {
    const ledgerPath = join(workDir, 'failure-ledger.md');
    const existingLedger = [
      '# Failure Ledger - e2e-suite-stabilization',
      '',
      '| id | specFile | testTitle | domain | category | rootCauseGroup | rootCauseSummary | sourceRefs | fixRef | regressionTestRef | flaky | status |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| e2e/admin-portal.spec.ts::非管理者ユーザーでのアクセス制限確認 | e2e/admin-portal.spec.ts | 非管理者ユーザーでのアクセス制限確認 | admin-portal | product-bug | admin-access-redirect | 調査済みの原因 | src/middleware.ts:10 | commit:abcdef | tests/middleware.test.ts | false | fixed |',
      '',
    ].join('\n');
    writeFileSync(ledgerPath, existingLedger);

    runScript(FIXTURE_PATH, ledgerPath);

    const ledgerContent = readFileSync(ledgerPath, 'utf8');
    // 既存レコードは調査済みフィールドを保持したまま(statusがfixedのまま)残る
    expect(ledgerContent).toContain(
      '| e2e/admin-portal.spec.ts::非管理者ユーザーでのアクセス制限確認 | e2e/admin-portal.spec.ts | 非管理者ユーザーでのアクセス制限確認 | admin-portal | product-bug | admin-access-redirect | 調査済みの原因 | src/middleware.ts:10 | commit:abcdef | tests/middleware.test.ts | false | fixed |'
    );
    // 新規の失敗(layout)のみopenスケルトンとして追加される
    expect(ledgerContent).toContain(
      '| e2e/layout.spec.ts::Admin menu is visible and active | e2e/layout.spec.ts | Admin menu is visible and active | layout |  |  |  |  |  |  |  | open |'
    );
  });
});
