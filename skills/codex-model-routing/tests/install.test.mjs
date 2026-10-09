import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildPlan, install, installationStatus } from '../scripts/install.mjs';

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'routing install ')); t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, 'checkouts with spaces'); const codexHome = join(base, 'codex home');
  mkdirSync(join(root, 'example'), { recursive: true }); mkdirSync(codexHome);
  const manifest = join(base, 'manifest.json'); writeFileSync(manifest, JSON.stringify({ version: 1, name: 'sample', repositories: [{ name: 'example', path: 'example' }] }));
  const levels = ['low', 'medium', 'high'].map(effort => ({ effort }));
  writeFileSync(join(codexHome, 'models_cache.json'), JSON.stringify({ models: ['account-main', 'account-luna', 'account-astra'].map(slug => ({ slug, visibility: 'list', supported_reasoning_levels: levels, default_reasoning_level: 'medium' })) }));
  const baseConfig = 'model = "account-main"\nmodel_reasoning_effort = "medium"\napproval_policy = "on-request"\n';
  writeFileSync(join(codexHome, 'config.toml'), baseConfig);
  const options = { root, manifest, codex_home: codexHome };
  return { base, root, codexHome, manifest, options, baseConfig };
}
test('fresh install discovers paths and models without changing base config or storing a key', t => {
  const f = fixture(t); const plan = buildPlan(f.options);
  assert.equal(plan.roles.main.model, 'account-main'); assert.equal(plan.roles.fast.model, 'account-luna'); assert.equal(plan.roles.deep.model, 'account-astra');
  const previous = process.env.TYPESAFE_API_KEY; process.env.TYPESAFE_API_KEY = 'fixture-secret-must-not-be-stored';
  try { install(plan); } finally { if (previous === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = previous; }
  assert.equal(readFileSync(join(f.codexHome, 'config.toml'), 'utf8'), f.baseConfig);
  for (const [file, content] of plan.files) { assert.equal(readFileSync(file, 'utf8'), content); assert.ok(!content.includes('fixture-secret-must-not-be-stored')); }
  assert.equal(installationStatus(f.options).installed, true);
  const runtime = JSON.parse(readFileSync(join(plan.runtime, 'scripts/routing.json'), 'utf8'));
  assert.equal(runtime.scope_root, f.root); assert.equal(runtime.codex_home, f.codexHome);
});
test('dry run creates no profiles, runtime files or backups', t => {
  const f = fixture(t); install(buildPlan(f.options), true);
  assert.deepEqual(readdirSync(f.codexHome).sort(), ['config.toml', 'models_cache.json']);
});
test('repeat install is a no-op; changed preferences back up only changed managed files', t => {
  const f = fixture(t); const plan = buildPlan(f.options); install(plan);
  assert.deepEqual(install(buildPlan(f.options)), []);
  const profile = join(f.codexHome, 'sample.config.toml'); const before = readFileSync(profile, 'utf8');
  const settings = join(f.base, 'preferences.json'); writeFileSync(settings, JSON.stringify({ models: { main: { model: 'account-main', effort: 'high' } } }));
  const changed = install(buildPlan({ ...f.options, settings })); assert.ok(changed.includes(profile));
  const backups = readdirSync(f.codexHome).filter(name => name.startsWith('sample.config.toml.bak.')); assert.equal(backups.length, 1);
  assert.equal(readFileSync(join(f.codexHome, backups[0]), 'utf8'), before);
  assert.equal(readFileSync(join(f.codexHome, 'config.toml'), 'utf8'), f.baseConfig);
});
test('unsupported account model or effort fails before configuration writes', t => {
  const f = fixture(t); const settings = join(f.base, 'preferences.json');
  writeFileSync(settings, JSON.stringify({ models: { fast: { model: 'not-in-account' } } }));
  assert.throws(() => buildPlan({ ...f.options, settings }), /not in this account/);
  writeFileSync(settings, JSON.stringify({ models: { fast: { model: 'account-luna', effort: 'unsupported' } } }));
  assert.throws(() => buildPlan({ ...f.options, settings }), /unsupported/);
  assert.equal(existsSync(join(f.codexHome, 'sample.config.toml')), false);
});
test('manifest traversal and escaped symlinks are rejected', t => {
  const f = fixture(t);
  writeFileSync(f.manifest, JSON.stringify({ version: 1, repositories: [{ path: '../outside' }] })); assert.throws(() => buildPlan(f.options), /stay inside/);
  symlinkSync(f.codexHome, join(f.root, 'escape'), 'dir');
  writeFileSync(f.manifest, JSON.stringify({ version: 1, repositories: [{ path: 'escape' }] })); assert.throws(() => buildPlan(f.options), /stay inside/);
});
test('managed destination symlinks are rejected before any profiles are written', t => {
  const f = fixture(t); mkdirSync(join(f.codexHome, 'agents')); const victim = join(f.base, 'victim'); writeFileSync(victim, 'keep');
  symlinkSync(victim, join(f.codexHome, 'agents/sample-advisor.toml'));
  assert.throws(() => install(buildPlan(f.options)), /symlink/);
  assert.equal(readFileSync(victim, 'utf8'), 'keep'); assert.equal(existsSync(join(f.codexHome, 'sample.config.toml')), false);
});
test('status is read-only and recognizes missing installation pieces', t => {
  const f = fixture(t); assert.equal(installationStatus(f.options).installed, false);
  assert.deepEqual(readdirSync(f.codexHome).sort(), ['config.toml', 'models_cache.json']);
  const plan = buildPlan(f.options); install(plan); rmSync(join(f.codexHome, 'sample-fast.config.toml'));
  assert.equal(installationStatus(f.options).installed, false);
});
test('dangling managed symlinks cannot redirect new config writes', t => {
  const f = fixture(t); const absent = join(f.base, 'must-not-create');
  symlinkSync(absent, join(f.codexHome, 'sample.config.toml'));
  assert.throws(() => install(buildPlan(f.options)), /symlink/);
  assert.equal(existsSync(absent), false);
});
