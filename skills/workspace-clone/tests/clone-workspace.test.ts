import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const helper = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts/clone-workspace.ts');
function fixture(t: any) {
  const base = mkdtempSync(join(tmpdir(), 'workspace clone ')); t.after(() => rmSync(base, {recursive: true, force: true}));
  const origin = join(base, 'origin'); const root = join(base, 'checkouts'); const manifest = join(base, 'workspace.json');
  function git(...args: string[]) { const result = spawnSync('git', args, {encoding: 'utf8'}); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); }
  git('init', '-q', '-b', 'trunk', origin); writeFileSync(join(origin, 'README.md'), 'example\n'); git('-C', origin, 'add', 'README.md');
  git('-C', origin, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'initial');
  const entries = [{name: 'example', path: 'example', url: origin}];
  function run(...args: string[]) { writeFileSync(manifest, JSON.stringify({version: 1, repositories: entries})); const result = spawnSync(process.execPath, [helper, '--manifest', manifest, '--root', root, ...args], {encoding: 'utf8'}); assert.ifError(result.error); return result; }
  return {base, origin, root, entries, git, run};
}
test('dry run does not create checkout root', t => { const f = fixture(t); assert.equal(f.run('--dry-run').status, 0); assert.equal(existsSync(f.root), false); });
test('clone retains remote default; retry preserves dirty and untracked files', t => {
  const f = fixture(t); assert.equal(f.run().status, 0); const checkout = join(f.root, 'example'); assert.equal(f.git('-C', checkout, 'branch', '--show-current'), 'trunk');
  writeFileSync(join(checkout, 'README.md'), 'local change\n'); writeFileSync(join(checkout, 'untracked.txt'), 'keep\n'); const before = f.git('-C', checkout, 'status', '--porcelain');
  assert.equal(f.run().status, 0); assert.equal(readFileSync(join(checkout, 'README.md'), 'utf8'), 'local change\n'); assert.equal(f.git('-C', checkout, 'status', '--porcelain'), before);
});
test('mismatched origin leaves checkout untouched', t => {
  const f = fixture(t); assert.equal(f.run().status, 0); f.entries[0].url = join(f.base, 'different-origin'); const result = f.run();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /origin does not match/); assert.equal(f.git('-C', join(f.root, 'example'), 'remote', 'get-url', 'origin'), f.origin);
});
test('escaping, overlapping and symlink paths rejected before cloning', t => {
  const f = fixture(t); f.entries[0].path = '../escape'; assert.notEqual(f.run().status, 0); assert.equal(existsSync(f.root), false);
  f.entries[0].path = 'example'; f.entries.push({name: 'nested', path: 'example/nested', url: f.origin}); assert.notEqual(f.run().status, 0); assert.equal(existsSync(f.root), false);
  f.entries.pop(); mkdirSync(f.root); symlinkSync(f.origin, join(f.root, 'escape')); f.entries[0].path = 'escape/nested'; assert.notEqual(f.run().status, 0); assert.equal(existsSync(join(f.origin, 'nested')), false);
});
test('one failed clone does not prevent other members', t => { const f = fixture(t); f.entries.unshift({name: 'missing', path: 'missing', url: join(f.base, 'absent')}); assert.notEqual(f.run().status, 0); assert.equal(existsSync(join(f.root, 'example', '.git')), true); });
test('selected members and unknown selection', t => { const f = fixture(t); f.entries.push({name: 'other', path: 'other', url: f.origin}); assert.equal(f.run('--repo', 'example').status, 0); assert.equal(existsSync(join(f.root, 'other')), false); assert.notEqual(f.run('--repo', 'unknown').status, 0); });
test('credentials rejected without disclosure or checkout writes', t => {
  const f = fixture(t); f.entries[0].url = 'https://user:secret@example.invalid/repo.git'; const result = f.run(); assert.notEqual(result.status, 0); assert.doesNotMatch(result.stderr, /secret/); assert.equal(existsSync(f.root), false);
});

test('Git remote-helper execution URLs rejected', t => { const f = fixture(t); f.entries[0].url = 'ext::sh -c echo'; const result = f.run(); assert.notEqual(result.status, 0); assert.equal(existsSync(f.root), false); });
