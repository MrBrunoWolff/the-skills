---
name: wf-web-check-quality
description: Run a web repo's full code-quality suite — lint, format check, dead-code (knip), typecheck, tests, react-doctor and dependency audit — using whichever of those scripts the repo actually declares. Detects the package manager and script surface from the repo rather than assuming a fixed set, collects every exit code instead of stopping at the first failure, and prints one summary table.
---

# wf-web-check-quality — run the repo's own quality gates

Runs the code-quality scripts a web repo ships. **Which scripts exist is detected, not
assumed** — see the repo profile in `[[wf-web-list-fleet]]`. The suite never invents a gate the
repo chose not to have, and never substitutes a different tool for a missing script.

## Preflight

Detect the package manager from the lockfile:

```bash
if   [ -f bun.lock ];          then PM=bun;  X=bunx
elif [ -f pnpm-lock.yaml ];    then PM=pnpm; X="pnpm dlx"
elif [ -f package-lock.json ]; then PM=npm;  X=npx
elif [ -f yarn.lock ];         then PM=yarn; X="yarn dlx"
else echo "No lockfile — is this a JS project?"; exit 1
fi
command -v "$PM" >/dev/null 2>&1 || { echo "ERROR: $PM is required (this repo's lockfile is ${PM}'s)."; exit 1; }
```

**Do not fall back to another package manager.** A repo's lockfile is the contract; installing
with the wrong one writes a second lockfile, and "multiple lock files" is itself a health-check
failure. If the declared manager is missing, abort with its install instructions:

```
bun   → curl -fsSL https://bun.sh/install | bash   (macOS: brew install oven-sh/bun/bun)
pnpm  → corepack enable pnpm
```

> **Multiple lockfiles.** If more than one lockfile is present, stop and report it before
> running anything. The fix is to delete the stray one — the one that is **not** committed —
> never to touch the tracked lockfile.

## Canonical CI contract

Prefer `check:ci` when the repository defines it. Read the script and any stage configuration,
run the matching frozen install, then execute the contract once and collect every stage result.
Do not substitute a mutating `check` for validation or re-run gates already covered by the
contract. For repositories without an aggregate, use the script discovery below.

Require zero lint warnings/errors and zero Knip findings/configuration hints where installed.
A React Doctor score must be measured at 100/100 after a complete scan; a missing score is not
success. Keep stack-specific diagnostics and package-age policy. Report whether a failure also
exists on the default branch so dependency maintenance is distinguishable from feature regressions.

## The script surface

Look each of these up **by name in `package.json`**. Run the ones that exist, in this order —
cheapest first, so a fast failure surfaces early:

| Concern | Conventional name | Near-neighbours to accept |
|---|---|---|
| Aggregate gate | `check` | `check:ci`, `check:all` |
| Lint | `lint` | — (`lint:fix` only under `--fix`) |
| Format | `format:check` | `fmt:check` |
| Dead code | `knip` | `knip:check` |
| Types | `typecheck` | `type-check`, `typecheck:only` |
| Tests | `test` | — |
| Health | `doctor` | — |
| Advisories | `audit` | — |

Two notes on that table, both learned the hard way:

- **A `check` script usually composes several of the others.** If the repo has one, read what
  it runs (`node -e 'console.log(require("./package.json").scripts.check)'`) and **do not
  re-run its constituents separately** — you would double the wall time and report the same
  failure twice. Run `check`, then only the gates it does not cover.
- **A script named exactly like a binary in `node_modules/.bin` can collide** — which is why
  some repos name the dead-code gate `knip:check` rather than `knip`. Accept the neighbour;
  do not "fix" the repo's naming as a side effect of running its tests.

Resolve the surface once, up front:

```bash
has() { node -e 'const s=require("./package.json").scripts||{};process.exit(s[process.argv[1]]?0:1)' "$1"; }
```

## Install, then prune

```bash
$PM install --frozen-lockfile     # npm: npm ci
```

`--frozen-lockfile` proves the lockfile is honoured, but it **does not clean up**: it never
removes a package that has dropped out of the lockfile. Those orphans are not inert — a
dangling `node_modules/.bin/<tool>` from a superseded alias, or a nested second copy of
`typescript`, produces failures that look like code problems and are not.

```bash
[ "$PM" = bun ]  && bun prune
[ "$PM" = pnpm ] && pnpm prune
```

**If a finding disappears after pruning, it was local drift** — report it as such and do not
change source code for it.

> **Monorepo caveat.** In a workspace monorepo, prune and dedupe can mis-report against nested
> workspaces (proposing to remove most of the installed tree) while `--frozen-lockfile` exits
> 0 on the same tree. That is a tooling bug, not real drift. If prune's proposal is
> implausibly large, skip it for that repo, say so, and never hand-edit the lockfile.

## Workflow

1. Preflight: lockfile → package manager → availability.
2. Confirm this is a web repo: `package.json` at cwd. If the cwd is the fleet root rather than
   a repo, ask which repo to run against rather than guessing.
3. Resolve the script surface (above). Warn once, listing any conventional gate the repo does
   not declare — that is information, not an error.
4. Install, then prune.
5. Run each resolved script **in the foreground, one at a time**, capturing its exit code.
   **Do not stop on the first failure** — the point is one complete picture.
6. Print a single summary table:
   ```
   lint       ✓
   format     ✓
   knip       ✗  (12 unused exports)
   typecheck  ✓
   test       ✓  (48 tests)
   doctor     ✗  (score 78)
   audit      ✓
   ```
7. Exit non-zero if any step failed. The user can then ask you to fix specific findings.

## Framework-specific notes

Derived from the profile, not from a repo name:

- **Library (no framework dep)** — typically ships only `lint` + `typecheck` + `test`. A
  missing `knip`/`doctor` is normal here; skip and move on.
- **Expo / React Native** — health checkers run extra rules. A `package-lock.json` sitting
  beside the repo's real lockfile trips the "multiple lock files" rule and drops the score;
  delete the stray, never the tracked one.
- **Cloudflare Workers** — a `cf-typegen` (or `typegen`) script generates the binding types
  that `typecheck` depends on. **Run it before `typecheck`** or the typecheck fails on missing
  generated types in a fresh checkout.
- **Monorepo** — run the suite at the root if the root scripts fan out to the workspaces
  (`--filter '*'` or similar); otherwise iterate the workspace globs. A root-only run on a
  monorepo whose scripts do not fan out checks almost nothing.

## E2E tests are not part of this suite

If the repo ships `test:e2e` (Playwright, Cypress), **do not run it here**. E2E needs a running
dev server and often live data or credentials; it is a separate, slower, flakier gate. Mention
that it exists and was skipped.

## Flags / arguments

| Token | Effect |
|---|---|
| `--fix` | Use `lint:fix` instead of `lint`, and `format` instead of `format:check`, where those exist. |
| `--no-doctor` | Skip the health step (usually the slowest). |
| `--no-test` | Skip tests. |
| `--only=lint,knip` | Run only the listed concerns (comma list, names from the table above). |
| `--no-install` | Skip install + prune — for a rapid re-run when the tree is known good. |

Default (no args): every gate the repo declares.

## Agentic readiness (live, INFO — not part of this static suite)

This suite is static; it does not measure how well the app can be driven by an AI browser
agent, which only shows up against a running page. For that — Lighthouse's Agentic Browsing
pass-ratio, CLS on the primary routes, accessibility-tree names and roles, `/llms.txt`
presence, WebMCP tools — use `chrome-devtools-mcp` against a deployed preview, per
`[[wf-web-agentic]]`. It is experimental and advisory: surface it as INFO, never block this
suite on it.

## Cross-references

- `[[wf-web-list-fleet]]` — the repo-profile contract this skill reads
- `[[wf-web-create-pr]]` — runs this suite as its blocking gate
- `[[wf-web-update-deps]]` — runs this suite after a bump
- `[[wf-web-agentic]]` — the live counterpart

User intent / overrides: $ARGUMENTS
