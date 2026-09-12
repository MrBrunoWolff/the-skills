---
name: wf-web-update-deps-fix
description: Everything /wf-web-update-deps does (update deps + agent skills + quality scan across the fleet), then auto-fixes the lint, dead-code and health findings the new tooling surfaces by delegating each affected repo to the wf-web-deps-fixer agent. Separates failures the bump introduced from ones that already existed and from local node_modules drift, so only real regressions get fixed. Leaves changes uncommitted.
---

# wf-web-update-deps-fix — update, then fix what the new tooling flags

Runs the full `[[wf-web-update-deps]]` pipeline, then **fixes** the findings that freshly-bumped
lint / dead-code / health packages surface. Per-repo triage is delegated so it does not flood the
main conversation. Changes are left **uncommitted**.

## Workflow

### 1. Run the full update + scan

Execute the entire `[[wf-web-update-deps]]` workflow verbatim — preflight, per-repo dep update and
re-lock, prune, audit, dedupe dry-run, skills update, and the quality scan. Keep the captured
per-tool results; they are the input to the fix phase.

### 2. Collect repos with findings — and triage each one

Build the set of repos where any gate came back non-clean. Fully green repos need nothing.

**Before delegating, classify each failure into one of three buckets.** This command's remit is
fixing what the *bump* surfaced — not repairing breakage that already existed, and not chasing
ghosts.

Re-run the failing check on the clean committed baseline — stash or a pristine checkout, then
install, then **prune**, then the check:

| Bucket | Test | What to do |
|---|---|---|
| **Local drift** | The failure disappears after `prune` alone | Neither pre-existing nor introduced. **No fixer agent** — pruning was the fix. Report it as drift so nobody goes looking for a code cause. |
| **Pre-existing** | It **also fails on the clean baseline** | Not caused by the update. **Do not delegate** and **do not attribute it to the bump.** Report it in its own column so the user decides separately. |
| **Introduced** | Green on the baseline, red after the bump | This is what the fixer agents are for. |

The prune step matters: `bun install` never removes a package that dropped out of the lockfile, so
a stale `node_modules` can be the entire cause of a failure that looks like a code problem.

Note the prerelease case from `[[wf-web-update-deps]]` §1a: a typecheck error complaining that a
config key "does not exist in type" usually means the framework landed on a version whose type
defs lack a prerelease key. Reconcile the pin per §1a rather than editing the config — and if it
reproduces on the baseline, it is pre-existing.

### 3. Delegate fixing — one agent per affected repo

For each repo with **introduced** failures, launch the **`wf-web-deps-fixer`** agent. Repos are
independent working directories, so spawn the agents **in parallel** (one message, multiple
calls) — no worktree isolation is needed since no two agents touch the same repo.

> If that agent is not installed (agents are a manual install — see the repo README), do the
> triage inline per repo, following the same boundaries. Say which mode you used.

Pass each agent:

- the absolute repo path,
- the captured findings for that repo (which gates failed, with counts and output),
- a reminder to operate **only** inside that repo and to **never commit, branch or push**,
- a note that `bun why <pkg>` answers "what pulls this in" directly — it replaces hand-walking
  `node_modules` when triaging a dead-code finding or an advisory path
  (`bun why '@types/*' --depth 2` and `--top` narrow a noisy tree).

### 4. Re-verify

After the agents return, re-run the suite **once** per fixed repo, pruning first so orphans do not
distort the result:

```bash
bun prune
bun run check     # or the repo's individual gates
bun test
bun run doctor
```

### 5. Final report

| Repo | Before (failing) | After | Auto-fixed | Pre-existing | Local drift | Still needs you |

Per repo, summarise what the agent fixed and what it deferred for human judgment (ambiguous
removals, behaviour-changing refactors). Keep the sections from `[[wf-web-update-deps]]`:

- **⚠️ Prerelease alerts** — repos on a prerelease pin, the exact version, and whether the age
  gate was **bypassed** (un-aged → verify manually).
- **Common-deps matrix** — cross-fleet drift, or a one-line "all in sync".
- **🔒 Advisories** — counts by severity, criticals named. Report-only.
- **Proposed dupes** — dry-run counts, any proposed **downgrade** spelled out. Never applied.
- **Workspace-spec integrity** (monorepos) — no `workspace:` → registry rewrite, no peer range
  flattened to `"latest"`.

End with: **changes are uncommitted** — review and open PRs with `[[wf-web-create-pr]]`.

## Flags / arguments

Repo-name tokens in `$ARGUMENTS` scope both the update and the fix. Default = the whole fleet.

## Cross-references

- `[[wf-web-update-deps]]` — the pipeline this wraps
- `[[wf-web-check-quality]]` — the gates being re-verified
- `[[wf-web-create-pr]]` — where the uncommitted changes go next

User intent / overrides: $ARGUMENTS
