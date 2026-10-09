import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { route, readSettings } from './router.mjs';

export function keywordRule(prompt) {
  if (/review|design|architect|security|diagnos|trade.off|root.cause|audit/i.test(prompt)) return 'judgment';
  if (/implement|fix|rename|refactor|update|change|add|replace|edit|test|lint/i.test(prompt)) return 'implementation';
  return 'search';
}
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const source = resolve(value('--input', resolve(here, '../assets/cases.json')));
const output = resolve(value('--output', resolve(here, '../private/synthetic-benchmark.json')));
const runs = Number(value('--runs', '3'));
if (!Number.isInteger(runs) || runs < 1 || runs > 10) throw Error('runs must be 1..10');
if (!process.env.TYPESAFE_API_KEY && !process.env.JEV_API_KEY) throw Error('A TypeSafe key is required for a live benchmark.');
const cases = JSON.parse(await readFile(source, 'utf8'));
if (!Array.isArray(cases)) throw Error('Input must be a case array.');
if (cases.some(item => /^gAAAAA[A-Za-z0-9_-]+=*$/.test(item.prompt ?? ''))) throw Error('Encrypted task messages are not benchmark inputs.');
if (cases.length === 0) {
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  const summary = { cases: 0, calls: 0, status: 'skipped', reason: 'No readable eligible delegation briefs are available.' };
  await writeFile(output, JSON.stringify({ created_at: new Date().toISOString(), summary }, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(summary));
  process.exit(0);
}
const settings = await readSettings();
const records = [];
for (let run = 1; run <= runs; run++) {
  for (const item of cases) {
    const result = await route({ cwd: settings.scope_root, tool_name: 'spawn_agent', tool_input: { message: item.prompt, description: item.id } });
    records.push({ id: item.id, run, expected: item.expected ?? null, keyword: keywordRule(item.prompt), ...result });
  }
  process.stderr.write(`Completed run ${run}/${runs}: ${cases.length} cases\n`);
}
const labelled = records.filter(r => r.expected);
const valid = records.filter(r => r.tier);
const recommended = records.filter(r => r.outcome === 'recommended');
const matrix = {};
for (const row of labelled) { matrix[row.expected] ??= {}; const predicted = row.tier ?? 'error'; matrix[row.expected][predicted] = (matrix[row.expected][predicted] ?? 0) + 1; }
const latencies = records.map(r => r.ms).filter(Number.isFinite).sort((a, b) => a - b);
const accuracy = fn => labelled.length ? labelled.filter(fn).length / labelled.length : null;
const summary = {
  cases: cases.length, runs, calls: records.length, labelled_calls: labelled.length,
  jev_accuracy: accuracy(r => r.tier === r.expected), keyword_accuracy: accuracy(r => r.keyword === r.expected),
  recommended: recommended.length, unchanged: records.length - recommended.length,
  confidence_threshold: Number(process.env.AGENT_ROUTER_MIN_CONFIDENCE ?? 0.8),
  valid_answers: valid.length, errors: records.filter(r => r.reason === 'error').length,
  recommended_accuracy: recommended.filter(r => r.expected).length ? recommended.filter(r => r.expected && r.tier === r.expected).length / recommended.filter(r => r.expected).length : null,
  confusion_matrix: matrix,
  jev_tiers: Object.fromEntries(['search', 'implementation', 'judgment'].map(t => [t, valid.filter(r => r.tier === t).length])),
  keyword_tiers: Object.fromEntries(['search', 'implementation', 'judgment'].map(t => [t, records.filter(r => r.keyword === t).length])),
  recommended_tiers: Object.fromEntries(['search', 'implementation', 'judgment'].map(t => [t, recommended.filter(r => r.tier === t).length])),
  latency_ms: { median: latencies[Math.floor(latencies.length / 2)] ?? null, p95: latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] ?? null },
};
await mkdir(dirname(output), { recursive: true, mode: 0o700 });
await writeFile(output, JSON.stringify({ created_at: new Date().toISOString(), summary, records }, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(summary, null, 2));
