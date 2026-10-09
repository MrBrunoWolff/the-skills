import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inScope, readSettings } from './router.mjs';

const settings = await readSettings();
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const output = args.includes('--output') ? resolve(args[args.indexOf('--output') + 1]) : join(here, '../private/workspace-prompts.json');
async function* files(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, item.name);
    if (item.isDirectory()) yield* files(p);
    else if (item.name.endsWith('.jsonl')) yield p;
  }
}
const cases = [], seen = new Set();
let workspaceSessions = 0, structuredSpawns = 0, skippedExcludedReferences = 0, skippedEncrypted = 0;
for await (const p of files(resolve(settings.codex_home, 'sessions'))) {
  const rows = (await readFile(p, 'utf8')).split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const meta = rows.find(row => row.type === 'session_meta')?.payload;
  if (!await inScope(meta?.cwd, settings.scope_root)) continue;
  workspaceSessions++;
  for (const row of rows) {
    const call = row.type === 'response_item' ? row.payload : null;
    if (call?.type !== 'function_call' || !['spawn_agent', 'collaboration.spawn_agent', 'functions.spawn_agent'].includes(call.name)) continue;
    structuredSpawns++;
    let input; try { input = JSON.parse(call.arguments); } catch { continue; }
    if (Object.hasOwn(input, 'model') || Object.hasOwn(input, 'reasoning_effort')) continue;
    if (input.agent_type && !['default', 'general-purpose'].includes(input.agent_type)) continue;
    const prompt = input.message ?? input.prompt;
    if (typeof prompt !== 'string' || !prompt.trim() || seen.has(prompt)) continue;
    // This Codex installation encrypts delegated message bodies in rollouts.
    // Ciphertext is not a task and must never be sent to a classifier.
    if (/^gAAAAA[A-Za-z0-9_-]+=*$/.test(prompt)) { skippedEncrypted++; continue; }
    if ((settings.excluded_roots ?? []).some(root => prompt.includes(root))) { skippedExcludedReferences++; continue; }
    seen.add(prompt); cases.push({ id: `workspace-${cases.length + 1}`, prompt, source: p, call_id: call.call_id });
  }
}
await mkdir(dirname(output), { recursive: true, mode: 0o700 });
await writeFile(output, JSON.stringify(cases, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ workspace_sessions: workspaceSessions, structured_spawns: structuredSpawns, eligible_unique_prompts: cases.length, skipped_excluded_references: skippedExcludedReferences, skipped_encrypted: skippedEncrypted, output }));
