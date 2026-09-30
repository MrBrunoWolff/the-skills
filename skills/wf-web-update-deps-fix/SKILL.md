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

Re-run the failing check in a separate checkout of the starting committed
baseline. Install that baseline's dependencies and reconcile its installed tree
before checking. Preserve the author's working tree; do not stash or reset it.

| Bucket | Test | What to do |
|---|---|---|
| **Local drift** | The failure disappears after `prune` alone | Neither pre-existing nor introduced. **No fixer agent** — pruning was the fix. Report it as drift so nobody goes looking for a code cause. |
| **Pre-existing** | It **also fails on the clean baseline** | Not caused by the update. **Do not delegate** and **do not attribute it to the bump.** Report it in its own column so the user decides separately. |
| **Introduced** | Green on the baseline, red after the bump | This is what the fixer agents are for. |

Check installed-tree reconciliation with the selected manager rather than assuming
all frozen installs leave orphaned packages. If the supported prune command finds orphans,
a stale `node_modules` can be the entire cause of a failure that looks like a code problem.

If a framework update rejects a config key, first confirm the intended stable or
prerelease channel. Preserve deliberate pins. Then inspect the entire affected
config section against the installed schema: a key may have been removed or
become the default. Do not delete only the first failing key without checking
the others. A failure that reproduces on the baseline is pre-existing.

### 3. Delegate fixing — one agent per affected repo

For each repo with **introduced** failures, launch the **`wf-web-deps-fixer`** agent. Repos are
independent working directories, so delegation can run per repo when available
and permitted by the session. Keep the parent's model choice. Otherwise fix
each repo inline; do not require an agent definition to complete the task.

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

After repairs, use `wf-web-check-quality` once per affected repo. Run the
detected manager and script names; inspect prune before using it in nested
workspaces. Reuse results and compare health scores as well as exit codes.

```bash
bun prune # only when supported and appropriate for this layout
bun run check     # or the repo's individual gates
bun test
bun run doctor
```

### 5. Final report

| Repo | Before (failing) | After | Auto-fixed | Pre-existing | Local drift | Still needs you |

Per repo, summarise what the agent fixed and what it deferred for human judgment (ambiguous
removals, behaviour-changing refactors). Keep the sections from `[[wf-web-update-deps]]`:

- **Prerelease holds** — unchanged pins and any channel move explicitly requested
  by the user. State whether the guard remained active.
- **Common-deps matrix** — cross-fleet drift, or a one-line "all in sync".
- **Advisories** — counts by severity, criticals named. Report-only.
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
