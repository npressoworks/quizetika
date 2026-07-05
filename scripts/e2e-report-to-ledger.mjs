import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_RESULTS_PATH = 'playwright-report/results.json';
const DEFAULT_LEDGER_PATH = '.kiro/specs/e2e-suite-stabilization/failure-ledger.md';

const LEDGER_COLUMNS = [
  'id',
  'specFile',
  'testTitle',
  'domain',
  'category',
  'rootCauseGroup',
  'rootCauseSummary',
  'sourceRefs',
  'fixRef',
  'regressionTestRef',
  'flaky',
  'status',
];

function domainFromSpecFile(specFile) {
  return basename(specFile).replace(/\.spec\.ts$/, '');
}

function buildId(specFile, testTitle) {
  return `${specFile}::${testTitle}`;
}

function collectSpecs(suite, specs) {
  for (const spec of suite.specs ?? []) {
    specs.push({ ...spec, file: spec.file ?? suite.file });
  }
  for (const child of suite.suites ?? []) {
    collectSpecs(child, specs);
  }
}

function isFailingSpec(spec) {
  return (spec.tests ?? []).some((test) => test.status === 'unexpected');
}

export function extractFailures(resultsJson) {
  const specs = [];
  for (const suite of resultsJson.suites ?? []) {
    collectSpecs(suite, specs);
  }

  return specs.filter(isFailingSpec).map((spec) => ({
    id: buildId(spec.file, spec.title),
    specFile: spec.file,
    testTitle: spec.title,
    domain: domainFromSpecFile(spec.file),
  }));
}

function toSkeletonRecord(failure) {
  return {
    id: failure.id,
    specFile: failure.specFile,
    testTitle: failure.testTitle,
    domain: failure.domain,
    category: '',
    rootCauseGroup: '',
    rootCauseSummary: '',
    sourceRefs: '',
    fixRef: '',
    regressionTestRef: '',
    flaky: '',
    status: 'open',
  };
}

function escapeCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
}

export function renderLedgerMarkdown(records) {
  const header = `| ${LEDGER_COLUMNS.join(' | ')} |`;
  const divider = `| ${LEDGER_COLUMNS.map(() => '---').join(' | ')} |`;
  const rows = records.map(
    (record) => `| ${LEDGER_COLUMNS.map((col) => escapeCell(record[col])).join(' | ')} |`
  );
  return ['# Failure Ledger - e2e-suite-stabilization', '', header, divider, ...rows, ''].join(
    '\n'
  );
}

export function parseLedgerMarkdown(content) {
  if (!content) return [];
  const lines = content.split('\n').filter((line) => line.trim().startsWith('|'));
  if (lines.length < 2) return [];

  // 先頭2行(ヘッダー行・区切り線)を除いたデータ行のみを対象にする
  return lines.slice(2).map((line) => {
    const cells = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
    const record = {};
    LEDGER_COLUMNS.forEach((col, index) => {
      record[col] = cells[index] ?? '';
    });
    return record;
  });
}

export function mergeLedger(existingRecords, currentFailures) {
  const existingIds = new Set(existingRecords.map((record) => record.id));
  const newRecords = currentFailures
    .filter((failure) => !existingIds.has(failure.id))
    .map(toSkeletonRecord);
  return [...existingRecords, ...newRecords];
}

export function buildLedgerFromResults(resultsJson, existingLedgerContent) {
  const failures = extractFailures(resultsJson);
  const existingRecords = parseLedgerMarkdown(existingLedgerContent);
  const merged = mergeLedger(existingRecords, failures);
  return { failures, merged, markdown: renderLedgerMarkdown(merged) };
}

function main() {
  const resultsPath = process.argv[2] ?? DEFAULT_RESULTS_PATH;
  const ledgerPath = process.argv[3] ?? DEFAULT_LEDGER_PATH;

  const resultsJson = JSON.parse(readFileSync(resultsPath, 'utf8'));
  const existingLedgerContent = existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : '';

  const { failures, markdown } = buildLedgerFromResults(resultsJson, existingLedgerContent);

  writeFileSync(ledgerPath, markdown);
  console.log(
    `Failure Ledger updated: ${failures.length} failing test(s) detected (${ledgerPath})`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
