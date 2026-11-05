import { readFileSync } from 'node:fs';

/**
 * Compares a Playwright JSON report against tests/expected-failures.json.
 *
 * The main branch fails on purpose, so a plain exit code can't say whether a run is
 * healthy. This passes only when exactly the recorded tests fail. A new failure fails the
 * build, and so does a recorded failure that starts passing, because that means the
 * record is out of date or a seeded defect has stopped being caught.
 *
 * Usage: node scripts/check-expected-failures.mjs <results.json> <main|clean>
 */
const [resultsPath, mode] = process.argv.slice(2);
const manifest = JSON.parse(readFileSync('tests/expected-failures.json', 'utf8'));
const expected = manifest[mode];

if (!resultsPath || !expected) {
  console.error('Usage: node scripts/check-expected-failures.mjs <results.json> <main|clean>');
  process.exit(2);
}

const report = JSON.parse(readFileSync(resultsPath, 'utf8'));
const failed = new Set();
let total = 0;

function visit(suite) {
  for (const spec of suite.specs ?? []) {
    total += 1;
    const statuses = spec.tests.flatMap((test) => test.results.map((result) => result.status));
    if (statuses.includes('failed') || statuses.includes('timedOut')) {
      failed.add(`${spec.file} :: ${spec.title}`);
    }
  }
  for (const child of suite.suites ?? []) visit(child);
}
for (const suite of report.suites ?? []) visit(suite);

const unexpectedFailures = [...failed].filter((name) => !expected.includes(name));
const unexpectedPasses = expected.filter((name) => !failed.has(name));

for (const name of unexpectedFailures) console.error(`Unexpected failure: ${name}`);
for (const name of unexpectedPasses) console.error(`Expected to fail but did not: ${name}`);
console.error(`${mode}: ${total} specs, ${failed.size} failed, ${expected.length} expected.`);

if (total === 0 || unexpectedFailures.length > 0 || unexpectedPasses.length > 0) process.exit(1);
