import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync, lstatSync, copyFileSync } from 'node:fs';
import { resolve, dirname, join, relative, isAbsolute, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const quote = value => JSON.stringify(value);
function canonical(path) {
  path = resolve(path);
  return existsSync(path) ? realpathSync(path) : join(canonical(dirname(path)), relative(dirname(path), path));
}
function inRoot(root, target) {
  const rel = relative(root, target);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel));
}
function stat(path) { try { return lstatSync(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
export function parseArguments(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    if (['--dry-run', '--status', '--help'].includes(name)) options[name.slice(2).replaceAll('-', '_')] = true;
    else if (['--root', '--manifest', '--settings', '--codex-home', '--models-file', '--codex-bin'].includes(name)) {
      const value = args[++i]; if (!value || value.startsWith('--')) throw Error(`${name} requires a value.`);
      options[name.slice(2).replaceAll('-', '_')] = value;
    } else throw Error(`Unknown option: ${name}`);
  }
  return options;
}
export function locations(options) {
  if (!options.root || !options.manifest) throw Error('--root and --manifest are required.');
  const root = canonical(options.root);
  if (!existsSync(root)) throw Error('Checkout root must exist.');
  const manifest = json(options.manifest);
  if (manifest.version !== 1 || !Array.isArray(manifest.repositories)) throw Error('Invalid workspace manifest.');
  const preferences = options.settings ? json(options.settings) : {};
  const profile = preferences.profile ?? manifest.name ?? 'workspace';
  if (!/^[a-z][a-z0-9-]*$/.test(profile) || profile.length > 48) throw Error('Profile name must use lowercase letters, digits and hyphens.');
  for (const member of manifest.repositories) {
    if (typeof member.path !== 'string' || !member.path || isAbsolute(member.path) || !inRoot(root, canonical(join(root, member.path)))) throw Error('Manifest checkout paths must stay inside root.');
  }
  const codexHome = canonical(options.codex_home ?? process.env.CODEX_HOME ?? join(homedir(), '.codex'));
  const runtime = join(codexHome, profile + '-model-routing');
  return { root, codexHome, runtime, profile, preferences };
}
export function installationStatus(options) {
  const paths = locations(options);
  const marker = join(paths.runtime, 'install-state.json');
  if (!existsSync(marker)) return { installed: false, profile: paths.profile, reason: 'not_managed' };
  let state; try { state = json(marker); } catch { return { installed: false, profile: paths.profile, reason: 'invalid_state' }; }
  const installed = state.version === 1 && state.scope_root === paths.root && Array.isArray(state.files) && state.files.length > 0 && state.files.every(file => typeof file === 'string' && inRoot(paths.codexHome, resolve(paths.codexHome, file)) && existsSync(resolve(paths.codexHome, file)));
  return { installed, profile: paths.profile, reason: installed ? 'installed' : 'incomplete' };
}
export function buildPlan(options) {
  const paths = locations(options);
  const modelsFile = resolve(options.models_file ?? join(paths.codexHome, 'models_cache.json'));
  if (!existsSync(modelsFile)) throw Error('No Codex model catalog found. Sign in and start Codex once before installing routing.');
  const models = json(modelsFile).models?.filter(model => model.visibility !== 'hide' && typeof model.slug === 'string');
  if (!models?.length) throw Error('The Codex model catalog has no selectable models.');
  const base = existsSync(join(paths.codexHome, 'config.toml')) ? readFileSync(join(paths.codexHome, 'config.toml'), 'utf8').split(/^\s*\[/m)[0] : '';
  const baseValue = key => { const match = new RegExp('^\\s*' + key + '\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")', 'm').exec(base); return match ? JSON.parse(match[1]) : undefined; };
  const byId = id => models.find(model => model.slug === id);
  const main = byId(baseValue('model')) ?? models[0];
  const fast = models.find(model => /luna|mini|nano/i.test(model.slug)) ?? main;
  const deep = models.find(model => /astra/i.test(model.slug)) ?? main;
  const requested = paths.preferences.models ?? {};
  function select(role, fallback, effort) {
    const model = requested[role]?.model ? byId(requested[role].model) : fallback;
    if (!model) throw Error(`Requested ${role} model is not in this account's selectable catalog.`);
    const levels = model.supported_reasoning_levels?.map(level => level.effort) ?? [];
    const desired = requested[role]?.effort ?? effort;
    if (requested[role]?.effort && !levels.includes(desired)) throw Error(`Requested ${role} effort is unsupported by its model.`);
    const chosen = levels.includes(desired) ? desired : model.default_reasoning_level;
    if (!levels.includes(chosen)) throw Error(`No supported reasoning effort for ${role}.`);
    return { model: model.slug, reasoning_effort: chosen };
  }
  const roles = { main: select('main', main, baseValue('model_reasoning_effort') ?? 'medium'), fast: select('fast', fast, 'low'), deep: select('deep', deep, 'high'), mechanical: select('mechanical', fast, 'medium') };
  const tiers = { search: roles.fast, implementation: roles.main, judgment: roles.deep };
  const prefix = paths.profile.replaceAll('-', '_');
  const names = { explorer: prefix + '_explorer', mechanical: prefix + '_mechanical', advisor: prefix + '_advisor' };
  const instructions = `These optional routing conventions apply only within ${paths.root}. Outside that root use normal behavior and do not consult this workspace's router.
Read repository instructions and inspect Git status before editing; preserve unrelated work. Never commit or push unless explicitly requested. Use direct tools for simple tasks; avoid delegation overhead.
When delegation is warranted by the task, you may use bounded subagents under this profile. Use ${names.explorer} for factual broad searches, ${names.mechanical} for small fully specified edits, and ${names.advisor} for a scoped independent opinion on architecture, correctness or recurring unexplained failures. Give the adviser evidence and validate its conclusions; do not consult it routinely before every action or completion.
Before an already-planned default/general-purpose delegation without explicit model or effort, consult choose_model once if available, supplying the current absolute cwd and every original intended spawn argument. Only for outcome recommended, add the returned model and reasoning_effort. Keep all other fields unchanged. For unchanged, absent tool or failure, send the original spawn without heuristics or overrides. Skip routing for typed agents, explicit settings and full-history forks; do not change fork mode to obtain a recommendation. Never change approvals, permissions or the main-session model based on routing.
Jev receives up to 6000 characters of the brief. Omit credentials and material outside the selected workspace. Missing key or AGENT_ROUTER=off disables Jev; custom-agent roles remain available.`;
  const files = new Map();
  const add = (target, text) => files.set(target, text);
  const serverId = paths.profile + '-model-router';
  for (const [suffix, role] of [['', 'main'], ['-fast', 'fast'], ['-deep', 'deep']]) {
    add(join(paths.codexHome, paths.profile + suffix + '.config.toml'), `model = ${quote(roles[role].model)}\nmodel_reasoning_effort = ${quote(roles[role].reasoning_effort)}\ndeveloper_instructions = ${quote(instructions)}\n\n[mcp_servers.${serverId}]\ncommand = ${quote(process.execPath)}\nargs = [${quote(join(paths.runtime, 'scripts/server.mjs'))}]\nenv_vars = ["TYPESAFE_API_KEY", "JEV_API_KEY", "AGENT_ROUTER", "AGENT_ROUTER_MIN_CONFIDENCE", "AGENT_ROUTER_LOG"]\nstartup_timeout_sec = 10\ntool_timeout_sec = 5\n`);
  }
  const agentInstructions = {
    explorer: 'Read only: no edits, installs, publishing, commits, external mutations or delegated agents. Shell commands may only read. Skip dependencies, generated trees and build output. Match quick, medium or very thorough breadth as requested. Locate and summarise code without reviewing correctness. Return the answer, path:line evidence, searched scope and anything not found.',
    mechanical: 'Read repository instructions and inspect Git status. Follow the supplied recipe in assigned files only. If a fix requires guessing behavior or choosing an architecture, report it for judgment. Never commit, push, publish or delegate. Run appropriate documented validation and report changes, checks and unresolved issues.',
    advisor: 'Give an independent opinion on the assigned decision using the supplied evidence and relevant files. Do not edit, install, publish, commit, push or delegate. State assumptions, compare credible approaches and identify concrete risks. Separate facts from inference; support review findings with path:line evidence. Return a concise recommendation and evidence that could change it.',
  };
  for (const [name, role, readOnly] of [['explorer', 'fast', true], ['mechanical', 'mechanical', false], ['advisor', 'deep', true]]) {
    add(join(paths.codexHome, 'agents', paths.profile + '-' + name + '.toml'), `name = ${quote(names[name])}\ndescription = ${quote({ explorer: 'Read-only factual searches at the requested breadth.', mechanical: 'Small mechanical changes with a fully specified recipe.', advisor: 'Scoped independent judgment for architecture, debugging and review.' }[name])}\nmodel = ${quote(roles[role].model)}\nmodel_reasoning_effort = ${quote(roles[role].reasoning_effort)}\n${readOnly ? 'sandbox_mode = "read-only"\n' : ''}developer_instructions = ${quote('Operate only in the assigned repository within ' + paths.root + '. ' + agentInstructions[name])}\n`);
  }
  for (const name of ['router.mjs', 'server.mjs', 'benchmark.mjs', 'extract-prompts.mjs']) add(join(paths.runtime, 'scripts', name), readFileSync(join(SOURCE, 'scripts', name), 'utf8'));
  add(join(paths.runtime, 'assets/cases.json'), readFileSync(join(SOURCE, 'assets/cases.json'), 'utf8'));
  add(join(paths.runtime, 'scripts/routing.json'), JSON.stringify({ scope_root: paths.root, codex_home: paths.codexHome, models_cache: modelsFile, tiers, excluded_roots: (paths.preferences.excluded_roots ?? []).map(path => canonical(resolve(paths.root, path))) }, null, 2) + '\n');
  add(join(paths.runtime, 'install-state.json'), JSON.stringify({ version: 1, scope_root: paths.root, files: [...files.keys()].map(file => relative(paths.codexHome, file)) }, null, 2) + '\n');
  return { ...paths, roles, files };
}
export function install(plan, dry = false) {
  // Check every destination before writing anything; never follow config symlinks.
  for (const target of plan.files.keys()) {
    let part = target;
    while (inRoot(plan.codexHome, part)) {
      if (stat(part)?.isSymbolicLink()) throw Error('Managed destination is a symlink; left untouched.');
      if (part === plan.codexHome) break;
      part = dirname(part);
    }
    if (existsSync(target) && !lstatSync(target).isFile()) throw Error('Managed destination is not a file; left untouched.');
  }
  const changes = [];
  const stamp = new Date().toISOString().replaceAll(':', '-');
  for (const [target, content] of plan.files) {
    const previous = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (previous === content) continue;
    changes.push(target);
    console.log(`${dry ? 'Would ' : ''}${previous === null ? 'create' : 'update'} ${target}`);
    if (dry) continue;
    mkdirSync(dirname(target), { recursive: true });
    if (previous !== null) {
      const backup = target + '.bak.' + stamp; copyFileSync(target, backup); console.log(`Backup: ${backup}`);
    }
    writeFileSync(target, content, { mode: 0o600 });
    if (previous !== null) {
      // Use diff's filename arguments, never shell interpolation of file contents.
      try { execFileSync('diff', ['-u', target + '.bak.' + stamp, target], { stdio: 'inherit' }); }
      catch (error) { if (error.status !== 1) console.log('Diff unavailable; compare the backup with the updated file.'); }
    }
  }
  if (!dry) mkdirSync(join(plan.runtime, 'private'), { recursive: true, mode: 0o700 });
  console.log(changes.length ? `${changes.length} managed files ${dry ? 'would change' : 'changed'}.` : 'Model-routing setup is already current.');
  return changes;
}
export function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.help) { console.log('install.mjs --manifest FILE --root DIR [--settings FILE] [--codex-home DIR] [--models-file FILE] [--codex-bin BIN] [--dry-run|--status]'); return; }
  if (options.status) { console.log(JSON.stringify(installationStatus(options))); return; }
  const bin = options.codex_bin ?? 'codex';
  let version, help;
  try { version = execFileSync(bin, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); help = execFileSync(bin, ['--help'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { throw Error('Install Codex CLI and make it available on PATH before installing routing.'); }
  const match = /codex-cli (\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match || (Number(match[1]) === 0 && Number(match[2]) < 161) || !help.includes('--profile') || !help.includes('--strict-config')) throw Error('This installer needs Codex CLI 0.161.0 or later with file profiles; check current Codex docs before porting to another format.');
  const plan = buildPlan(options);
  install(plan, options.dry_run);
  console.log(`Launch: codex -p ${plan.profile}; codex -p ${plan.profile}-fast; codex -p ${plan.profile}-deep`);
  console.log('No key is stored. Jev uses the existing TYPESAFE_API_KEY or JEV_API_KEY environment variable.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`Error: ${error.message}`); process.exitCode = 1; }
}
