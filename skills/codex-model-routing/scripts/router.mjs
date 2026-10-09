import { appendFile, readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function readSettings() {
  return JSON.parse(await readFile(new URL('routing.json', import.meta.url), 'utf8'));
}
// Examples deliberately use tasks excluded from the benchmark fixture.
export const CRITERIA = {
  search: { what: 'Finding, listing, counting, reading or summarising code, files, docs or command output; the answer is a location or a fact; nothing is changed and nothing needs judging.', examples: ['Locate the enum declaring supported payment currencies.'] },
  implementation: { what: 'Making or checking a change whose shape is already decided: edits that follow clear instructions, running a test or quality suite and fixing what it reports, mechanical refactors and renames, docs updates.', examples: ['Replace the specified log prefix in the named command handlers.'] },
  judgment: { what: 'Work where the approach itself is the open question: design and architecture, diagnosing a cause nobody has found yet, reviewing for correctness, security or regressions, weighing trade-offs.', not_for: 'A task that only sounds important but has a clear recipe.', examples: ['Determine which consistency guarantees an offline ledger requires.'] },
};

export async function inScope(cwd, root) {
  if (typeof cwd !== 'string' || !isAbsolute(cwd)) return false;
  try {
    const [canonicalRoot, canonicalCwd] = await Promise.all([realpath(root), realpath(cwd)]);
    const suffix = relative(canonicalRoot, canonicalCwd);
    return suffix === '' || (!suffix.startsWith('..') && !isAbsolute(suffix));
  } catch { return false; }
}

export async function route(input, dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const unchanged = reason => ({ outcome: 'unchanged', reason });
  const key = env.TYPESAFE_API_KEY || env.JEV_API_KEY;
  if (!key) return unchanged('no_key');
  if (env.AGENT_ROUTER === 'off') return unchanged('off');
  let settings;
  try { settings = dependencies.settings ?? await readSettings(); } catch { return unchanged('not_configured'); }
  if (!(await inScope(input?.cwd, settings.scope_root))) return unchanged('outside_scope');
  if (input?.tool_name !== 'spawn_agent' && input?.tool_name !== 'Agent') return unchanged('other_tool');
  const task = input?.tool_input;
  if (!task || typeof task !== 'object' || Array.isArray(task)) return unchanged('invalid_input');
  if (Object.hasOwn(task, 'model') || Object.hasOwn(task, 'reasoning_effort') || Object.hasOwn(task, 'model_reasoning_effort')) return unchanged('explicit_setting');
  if (task.fork_turns === 'all') return unchanged('full_history_fork');
  const type = task.agent_type ?? task.subagent_type;
  if (type !== undefined && type !== 'default' && type !== 'general-purpose') return unchanged('typed_agent');
  const message = task.message ?? task.prompt;
  if (typeof message !== 'string' || !message.trim()) return unchanged('empty_task');
  if (/^gAAAAA[A-Za-z0-9_-]+=*$/.test(message)) return unchanged('encrypted_task');
  const threshold = env.AGENT_ROUTER_MIN_CONFIDENCE === undefined ? 0.8 : Number(env.AGENT_ROUTER_MIN_CONFIDENCE);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) return unchanged('invalid_threshold');
  const started = performance.now();
  let result;
  try {
    const response = await (dependencies.fetch ?? fetch)('https://api.typesafe.ai/v1/systemone', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({ model: 'jev-latest', state: { task: `${task.description ?? ''}\n\n${message}`.slice(0, 6000) }, questions: { tier: { type: 'choice', instructions: 'A coding agent is delegating this task to a subagent. Which model tier does the task need? Judge the work the task asks for, not how long the instructions are.', criteria: CRITERIA } } }),
    });
    if (!response.ok) throw new Error('api_error');
    const answer = (await response.json())?.answers?.tier;
    if (!answer || !Object.hasOwn(settings.tiers, answer.choice) || typeof answer.confidence !== 'number' || !Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) throw new Error('invalid_answer');
    const choice = settings.tiers[answer.choice];
    const models = dependencies.availableModels ?? JSON.parse(await readFile(settings.models_cache, 'utf8')).models.map(m => m.slug);
    if (!models.includes(choice.model)) return unchanged('unavailable_model');
    result = { outcome: answer.confidence >= threshold ? 'recommended' : 'unchanged', reason: answer.confidence >= threshold ? 'confident' : 'low_confidence', tier: answer.choice, confidence: answer.confidence, ms: Math.round(performance.now() - started) };
    if (result.outcome === 'recommended') result.recommendation = { ...choice };
  } catch { result = { outcome: 'unchanged', reason: 'error', ms: Math.round(performance.now() - started) }; }
  if (env.AGENT_ROUTER_LOG) {
    // Never log message bodies or API errors (which can contain credentials).
    try { await appendFile(env.AGENT_ROUTER_LOG, JSON.stringify({ ...result, description: String(task.description ?? '').slice(0, 200) }) + '\n', { mode: 0o600 }); } catch { /* Logging must not affect delegation. */ }
  }
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    let text = ''; for await (const part of process.stdin) text += part;
    const result = await route(JSON.parse(text));
    if (result.outcome === 'recommended') process.stdout.write(JSON.stringify(result) + '\n');
  } catch { /* Clean no-op for invalid stdin and all unexpected errors. */ }
}
