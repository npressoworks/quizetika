import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { extractFailures } from './e2e-report-to-ledger.mjs';

export function diffBaseline(baselineResultsJson, currentResultsJson) {
  const baselineFailures = extractFailures(baselineResultsJson);
  const currentFailures = extractFailures(currentResultsJson);

  const baselineById = new Map(baselineFailures.map((failure) => [failure.id, failure]));
  const currentById = new Map(currentFailures.map((failure) => [failure.id, failure]));

  const fixed = [...baselineById.values()].filter((failure) => !currentById.has(failure.id));
  const stillFailing = [...baselineById.values()].filter((failure) => currentById.has(failure.id));
  const newFailures = [...currentById.values()].filter((failure) => !baselineById.has(failure.id));

  return { fixed, stillFailing, newFailures };
}

export function formatDiffReport(diff) {
  const lines = [];

  lines.push(`新規修正: ${diff.fixed.length}件`);
  for (const failure of diff.fixed) lines.push(`  - ${failure.id}`);

  lines.push(`未修正: ${diff.stillFailing.length}件`);
  for (const failure of diff.stillFailing) lines.push(`  - ${failure.id}`);

  lines.push(`新規デグレード: ${diff.newFailures.length}件`);
  for (const failure of diff.newFailures) lines.push(`  - ${failure.id}`);

  return lines.join('\n');
}

function main() {
  const [, , baselinePath, currentPath] = process.argv;
  if (!baselinePath || !currentPath) {
    console.error(
      'Usage: node scripts/e2e-baseline-diff.mjs <baseline-results.json> <current-results.json>'
    );
    process.exit(1);
  }

  const baselineResultsJson = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const currentResultsJson = JSON.parse(readFileSync(currentPath, 'utf8'));

  const diff = diffBaseline(baselineResultsJson, currentResultsJson);
  console.log(formatDiffReport(diff));
  process.exit(diff.newFailures.length > 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
