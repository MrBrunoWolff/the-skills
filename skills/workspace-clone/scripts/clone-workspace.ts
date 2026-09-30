#!/usr/bin/env bun
import { existsSync, realpathSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function canonical(value: string): string {
  const path = resolve(value === '~' ? homedir() : value.startsWith('~/') ? homedir() + value.slice(1) : value);
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  return parent === path ? path : resolve(canonical(parent), relative(parent, path));
}
export function inside(root: string, value: string): string {
  if (typeof value !== 'string' || !value || isAbsolute(value)) throw new Error('Expected a relative checkout path.');
  const target = canonical(resolve(root, value));
  const rel = relative(root, target);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('Checkout path must stay inside its root.');
  return target;
}
export function identity(value: string): string {
  const ssh = /^(?:[^/@:]+@)?([^/:]+):(.+)$/.exec(value);
  if (ssh && !value.includes('://')) return ssh[1].toLowerCase() + '/' + ssh[2].replace(/\/$/, '').replace(/\.git$/, '');
  try { const url = new URL(value); return url.hostname.toLowerCase() + '/' + url.pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\.git$/, ''); }
  catch { return 'local:' + canonical(value); }
}
function validURL(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.startsWith('-') || /^[A-Za-z][A-Za-z0-9+.-]*::/.test(value)) return false;
  if (value.includes('://')) {
    try { const url = new URL(value); return ['https:', 'http:', 'ssh:', 'git:', 'file:'].includes(url.protocol) && !url.password && !url.search && !url.hash && !(['http:', 'https:'].includes(url.protocol) && url.username); }
    catch { return false; }
  }
  return true;
}
export function loadEntries(manifest: string, root: string, selected: string[] = []) {
  const data = JSON.parse(readFileSync(manifest, 'utf8'));
  if (data?.version !== 1 || !Array.isArray(data.repositories) || !data.repositories.length) throw new Error('Manifest requires version: 1 and a nonempty repositories list.');
  const names = new Set<string>(); const paths: string[] = [];
  const entries = data.repositories.map((entry: {name: string; path: string; url: string}) => {
    if (!entry || typeof entry.name !== 'string' || !entry.name || names.has(entry.name)) throw new Error('Repository names must be nonempty and unique.');
    const path = inside(root, entry.path);
    if (paths.some(other => path === other || path.startsWith(other + sep) || other.startsWith(path + sep))) throw new Error('Repository paths must not overlap.');
    if (!validURL(entry.url)) throw new Error(`${entry.name}: use a credential-free Git URL.`);
    names.add(entry.name); paths.push(path); return {name: entry.name, path, url: entry.url};
  });
  if (selected.some(name => !names.has(name))) throw new Error('Unknown selected repository.');
  return entries.filter((entry: {name: string}) => !selected.length || selected.includes(entry.name));
}
export function run(manifest: string, root: string, selected: string[] = [], dryRun = false): number {
  root = canonical(root);
  const entries = loadEntries(manifest, root, selected);
  if (spawnSync('git', ['--version']).status !== 0) throw new Error('Git must be available on PATH.');
  let failed = false;
  for (const {name, path, url} of entries) {
    try {
      if (existsSync(path)) {
        if (!existsSync(resolve(path, '.git'))) throw new Error('destination exists but is not a Git checkout');
        const remote = spawnSync('git', ['-C', path, 'remote', 'get-url', 'origin'], {encoding: 'utf8'});
        if (remote.status !== 0) throw new Error('Cannot read existing origin.');
        if (identity(remote.stdout.trim()) !== identity(url)) throw new Error('existing origin does not match manifest; left untouched');
        console.log(`SKIP ${name}: existing checkout`); continue;
      }
      if (dryRun) { console.log(`CLONE ${name}: ${JSON.stringify(['git', 'clone', '--', url, path])}`); continue; }
      mkdirSync(dirname(path), {recursive: true});
      const result = spawnSync('git', ['clone', '--', url, path], {stdio: 'inherit'});
      if (result.status !== 0) throw new Error('Git clone failed.');
      console.log(`CLONED ${name}: ${path}`);
    } catch (error) { console.error(`FAIL ${name}: ${(error as Error).message}`); failed = true; }
  }
  return failed ? 1 : 0;
}
export function main(args = process.argv.slice(2)): number {
  let manifest = ''; let root = ''; let dry = false; const selected: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') dry = true;
    else if (['--manifest', '--root', '--repo'].includes(arg)) {
      const value = args[++i]; if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
      if (arg === '--manifest') manifest = value; else if (arg === '--root') root = value; else selected.push(value);
    } else if (arg === '--help') { console.log('clone-workspace.ts --manifest FILE --root DIRECTORY [--repo NAME] [--dry-run]'); return 0; }
    else throw new Error('Unknown argument.');
  }
  if (!manifest || !root) throw new Error('--manifest and --root are required.');
  return run(canonical(manifest), root, selected, dry);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); } catch (error) { console.error(`Error: ${(error as Error).message}`); process.exitCode = 1; }
}
