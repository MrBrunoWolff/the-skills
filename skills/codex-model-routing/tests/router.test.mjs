import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { route } from '../scripts/router.mjs';

const cwd = tmpdir();
const TIERS = { search: { model: 'test-fast', reasoning_effort: 'low' }, implementation: { model: 'test-main', reasoning_effort: 'medium' }, judgment: { model: 'test-deep', reasoning_effort: 'high' } };
const settings = { scope_root: cwd, tiers: TIERS };
const input = { cwd, tool_name: 'spawn_agent', tool_input: { message: 'Enumerate the exported symbols.', description: 'Symbol inventory', fork_context: false, opaque: { keep: [1, 2] } } };
const options = extra => ({ settings, availableModels: Object.values(TIERS).map(t => t.model), env: { TYPESAFE_API_KEY: 'test-key' }, fetch: async () => ({ ok: true, json: async () => ({ answers: { tier: { choice: 'search', confidence: 0.95 } } }) }), ...extra });
const script = fileURLToPath(new URL('../scripts/router.mjs', import.meta.url));
test('real script without either key exits zero with empty stdout and no log', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'router-test-'));
  try {
    const env = { ...process.env, AGENT_ROUTER_LOG: join(dir, 'absent.jsonl') }; delete env.TYPESAFE_API_KEY; delete env.JEV_API_KEY;
    const child = spawnSync(process.execPath, [script], { input: JSON.stringify(input), env, encoding: 'utf8' });
    assert.equal(child.status, 0); assert.equal(child.stdout, ''); assert.equal(child.stderr, '');
    await assert.rejects(readFile(env.AGENT_ROUTER_LOG), { code: 'ENOENT' });
  } finally { await rm(dir, { recursive: true }); }
});
for (const [name, change, env] of [
  ['off', {}, { TYPESAFE_API_KEY: 'test', AGENT_ROUTER: 'off' }],
  ['explicit model', { tool_input: { ...input.tool_input, model: 'explicit-model' } }],
  ['explicit effort', { tool_input: { ...input.tool_input, reasoning_effort: 'high' } }],
  ['full-history fork', { tool_input: { ...input.tool_input, fork_turns: 'all' } }],
  ['encrypted task', { tool_input: { ...input.tool_input, message: 'gAAAAAencrypted_message==' } }],
  ['typed explorer', { tool_input: { ...input.tool_input, agent_type: 'explorer' } }],
  ['typed worker', { tool_input: { ...input.tool_input, agent_type: 'worker' } }],
  ['custom agent', { tool_input: { ...input.tool_input, agent_type: 'custom_advisor' } }],
  ['other tool', { tool_name: 'exec_command' }],
  ['outside workspace', { cwd: '/' }],
  ['invalid threshold', {}, { TYPESAFE_API_KEY: 'test', AGENT_ROUTER_MIN_CONFIDENCE: 'NaN' }],
]) test(name + ' makes no network request', async () => {
  let called = false;
  const result = await route({ ...input, ...change }, options({ ...(env ? { env } : {}), fetch: async () => { called = true; throw Error(); } }));
  assert.equal(result.outcome, 'unchanged'); assert.equal(called, false); assert.equal(result.recommendation, undefined);
});
test('low confidence preserves inheritance', async () => {
  const result = await route(input, options({ fetch: async () => ({ ok: true, json: async () => ({ answers: { tier: { choice: 'judgment', confidence: 0.79 } } }) }) }));
  assert.equal(result.outcome, 'unchanged'); assert.equal(result.recommendation, undefined);
});
for (const [name, fetch] of [
  ['error', async () => { throw Error('secret'); }],
  ['timeout', async () => { throw new DOMException('timed out', 'TimeoutError'); }],
  ['http error', async () => ({ ok: false })],
  ['unknown tier', async () => ({ ok: true, json: async () => ({ answers: { tier: { choice: 'unapproved', confidence: 1 } } }) })],
  ['invalid confidence', async () => ({ ok: true, json: async () => ({ answers: { tier: { choice: 'search', confidence: 2 } } }) })],
]) test(name + ' fails to unchanged', async () => {
  const result = await route(input, options({ fetch })); assert.equal(result.outcome, 'unchanged'); assert.equal(result.recommendation, undefined); assert.ok(!JSON.stringify(result).includes('secret'));
});
test('confident answer leaves every original field untouched and has no permission decision', async () => {
  const original = structuredClone(input); let body;
  const result = await route(input, options({ fetch: async (url, init) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone'); assert.ok(init.signal instanceof AbortSignal); body = JSON.parse(init.body);
    return { ok: true, json: async () => ({ answers: { tier: { choice: 'search', confidence: 0.8 } } }) };
  } }));
  assert.deepEqual(input, original); assert.deepEqual(result.recommendation, TIERS.search);
  assert.equal(result.outcome, 'recommended'); assert.ok(!JSON.stringify(result).includes('permissionDecision')); assert.ok(!JSON.stringify(result).includes('updatedInput'));
  assert.equal(body.questions.tier.type, 'choice');
});
test('brief is capped at 6000 characters', async () => {
  await route({ ...input, tool_input: { message: 'x'.repeat(9000), description: 'test' } }, options({ fetch: async (_, init) => {
    assert.equal(JSON.parse(init.body).state.task.length, 6000); throw Error();
  } }));
});
test('three-second deadline aborts a stalled request', async () => {
  const started = performance.now();
  const result = await route(input, options({ fetch: async (_, init) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(() => reject(Error('deadline did not abort')), 4500);
    init.signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(init.signal.reason); }, { once: true });
  }) }));
  assert.equal(result.outcome, 'unchanged'); assert.equal(result.reason, 'error');
  assert.ok(performance.now() - started < 4000);
});
test('unavailable account model is not recommended', async () => {
  assert.equal((await route(input, options({ availableModels: [] }))).reason, 'unavailable_model');
});
test('custom confidence threshold and alternate key', async () => {
  assert.equal((await route(input, options({ env: { JEV_API_KEY: 'test', AGENT_ROUTER_MIN_CONFIDENCE: '0.99' } }))).reason, 'low_confidence');
});
test('symlink escaping scope is rejected', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'router-scope-'));
  try { await symlink('/', join(dir, 'escape')); assert.equal((await route({ ...input, cwd: join(dir, 'escape') }, options({ settings: { ...settings, scope_root: dir } }))).reason, 'outside_scope'); }
  finally { await rm(dir, { recursive: true }); }
});
test('MCP server initializes and exposes no tools without a key', async () => {
  const env = { ...process.env }; delete env.TYPESAFE_API_KEY; delete env.JEV_API_KEY;
  const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/server.mjs', import.meta.url))], { env });
  let output = ''; child.stdout.on('data', chunk => { output += chunk; });
  const done = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  child.stdin.end([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ].map(JSON.stringify).join('\n') + '\n');
  assert.equal(await done, 0); const messages = output.trim().split('\n').map(JSON.parse);
  assert.equal(messages.length, 2); assert.deepEqual(messages[1].result.tools, []);
});
