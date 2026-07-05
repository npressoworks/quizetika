import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const SCRIPT_PATH = resolve(__dirname, '../../scripts/e2e-baseline-diff.mjs');
const BASELINE_FIXTURE = resolve(__dirname, 'fixtures/e2e-results-sample.json');
const CURRENT_FIXTURE = resolve(__dirname, 'fixtures/e2e-results-current.json');

function runScript(baselinePath: string, currentPath: string) {
  try {
    const output = execFileSync('node', [SCRIPT_PATH, baselinePath, currentPath], {
      encoding: 'utf8',
    });
    return { output, exitCode: 0 };
  } catch (error) {
    const execError = error as { stdout: string; status: number };
    return { output: execError.stdout, exitCode: execError.status };
  }
}

describe('e2e-baseline-diff.mjs', () => {
  it('新規修正(admin-portal)・未修正(layout)・新規デグレード(ads)の3区分を判定する', () => {
    const { output, exitCode } = runScript(BASELINE_FIXTURE, CURRENT_FIXTURE);

    expect(output).toContain('新規修正: 1件');
    expect(output).toContain('  - e2e/admin-portal.spec.ts::非管理者ユーザーでのアクセス制限確認');

    expect(output).toContain('未修正: 1件');
    expect(output).toContain('  - e2e/layout.spec.ts::Admin menu is visible and active');

    expect(output).toContain('新規デグレード: 1件');
    expect(output).toContain('  - e2e/ads.spec.ts::動画広告モーダルが表示されること');

    // 新規デグレードが存在する場合は非0終了コードでゲートをブロックする
    expect(exitCode).toBe(1);
  });

  it('新規デグレードが無い場合は終了コード0になる', () => {
    // baseline=currentであれば差分は発生しない(fixed/newFailuresは0件)
    const { output, exitCode } = runScript(BASELINE_FIXTURE, BASELINE_FIXTURE);

    expect(output).toContain('新規デグレード: 0件');
    expect(exitCode).toBe(0);
  });
});
