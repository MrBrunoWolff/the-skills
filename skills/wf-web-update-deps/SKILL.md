---
name: wf-web-update-deps
description: Non-interactive dependency + agent-skill refresh across a fleet of web repos — update to latest under a pinned supply-chain release-age cutoff, re-lock, prune, audit, dedupe-dry-run, refresh vendored agent skills, then run each repo's quality suite. Flags skills that failed because they were renamed or removed upstream and reconciles them. Reports a per-repo table and a cross-fleet common-dependency drift matrix. Leaves changes uncommitted.
---

# wf-web-update-deps — update deps + agent skills, then check quality

Refreshes dependencies and the vendored `.agents/skills/` bundle across the fleet, then runs each
repo's quality suite and reports.

**The dep, skill and quality passes run to completion without prompting.** The one exception is
reconciling stale skills (§2): if the updater reports confirmed upstream renames or removals,
that flow removes the dead references, then pauses once for review before installing successors.

Changes are left **uncommitted** in each working tree. This command only **reports** quality
findings — to also auto-fix them, use `[[wf-web-update-deps-fix]]`.

## The fleet

Resolved per `[[wf-web-list-fleet]]`. Per-repo handling is derived from the **detected profile**
— package manager, framework, monorepo, available scripts — not from a hardcoded table:

| Detected | Dep update |
|---|---|
| bun + app or library | `bun update --latest` → `bun install` → `bun prune` |
| **monorepo** (`workspaces` / `pnpm-workspace.yaml`) | per-workspace update, then **one** root install — see §1-mono |
| **Expo** (`expo` in deps) | `bunx expo install --check` → `--fix`. **Never** `bun update --latest` |
| pnpm / npm | the equivalent (`pnpm update --latest`, `npm update`) with that manager only |

Repo-name tokens in `$ARGUMENTS` scope the run. Missing repos are skipped silently.

## Preflight

Per repo, resolve the package manager from the lockfile and abort if it is unavailable. Never
substitute another — that writes a second lockfile, which is itself a health-check failure.

## Workflow

Process repos **one at a time, sequentially**. Concurrent installs across repos cause
per-directory lock collisions and produce failures that look like dependency problems.

### 1. Update dependencies

```bash
bun update --latest --minimum-release-age=$WF_RUN_AGE   # see §1e
bun install            # re-lock — `update --latest` leaves the lockfile drifted
bun prune              # drop packages in node_modules but not in the lockfile
bun run audit          # report advisories (§1c)
bun dedupe --dry-run   # REPORT ONLY — never apply blind (§1d)
```

> `bunfig.toml` sets `minimumReleaseAge`, so `--latest` may resolve a package **below** its npm
> `latest` tag. That is the supply-chain guard working — **not** a bug or a stale cache. Do not
> work around it. Scopes you publish yourself, listed under `scopes` in `wf-fleet.json`, belong
> in `minimumReleaseAgeExcludes` so your own releases are adopted immediately.

#### 1e. Pin ONE release-age cutoff for the whole run (MANDATORY)

`minimumReleaseAge` is evaluated against the wall clock **at each invocation**, and a fleet pass
takes tens of minutes. So a package whose gate expires *during* the run is invisible to the
repos processed before that instant and visible to every repo after it. The fleet ends the run
split across two versions of the same shared tool, with nothing misconfigured anywhere — which
is exactly the kind of drift that costs an afternoon to explain.

**A bigger fixed margin does not fix this** — raising the gate just moves the boundary; the run
can still straddle it. The cutoff has to stop moving. Capture the run's start once, then *grow*
the minimum age by the elapsed time at each repo, so the effective publish-time cutoff
(`run start − gate`) stays constant:

```bash
WF_RUN_START=$(date +%s)          # once, before the first repo
WF_GATE=259200                    # match bunfig's minimumReleaseAge
# immediately before each repo's update:
WF_RUN_AGE=$(( WF_GATE + ( $(date +%s) - WF_RUN_START ) ))
```

Every repo now resolves against the same instant, so the run is atomic with respect to versions.
The age only ever *increases*, so this is never weaker than the configured gate — a package
deferred this way is simply adopted, uniformly, by the next run.

**Do not substitute `--minimum-release-age=0`.** That is the separate, deliberate prerelease
bypass in §1a, and using it here would disable the guard for the entire fleet.

This does not cover Expo repos (Expo resolves its own versions), your own excluded scopes, or
drift that predates the run — the **common-deps check** below is the backstop.

#### 1-mono. Monorepos: the root command updates ONLY the root manifest

`bun update --latest` rewrites **only the `package.json` in the current working directory**. In a
workspace monorepo that is the root manifest and nothing else — and `--filter '*'` does **not**
fix it: it re-resolves the lockfile but still leaves every workspace manifest untouched.

**The tell is a suspiciously small diff**: `git diff --stat -- '**/package.json' package.json`
showing only the root. If a monorepo's refresh touched one manifest, it did not do its job.

Iterate the workspaces explicitly, running the update from *inside* each:

```bash
for ws in $(node -e 'console.log((require("./package.json").workspaces||[]).join(" "))'); do
  for d in $ws; do
    [ -f "$d/package.json" ] || continue
    (cd "$d" && bun update --latest --minimum-release-age=$WF_RUN_AGE)
  done
done
bun install     # single re-lock at the root
```

Verify with `bun outdated --filter '*'` — the only view that proves the job is done.

**Hold these back; a blanket `--latest` gets them wrong:**

- **Lockstep package families** (a UI toolkit shipped as one release, `@next/*` alongside `next`)
  — move them together with their own upgrade command, never individually.
- **Deliberately pinned majors** — a package held at an older major on purpose. `--latest` drags
  it forward silently.
- **Majors in general** — surface them; do not take them silently in a routine refresh.
- **`workspace:*` specs and multi-range `peerDependencies`** — `bun update --latest` **rewrites
  both into something wrong.** A `"workspace:*"` spec gets replaced with a registry range
  (breaking monorepo linking), and a peer spec like `"^1.0.0 || ^2.0.0"` gets flattened to the
  literal string `"latest"` — which, in a *published* package, hands every consumer an unpinned
  peer. **Neither is caught by lint, typecheck, tests, or the build.**

  Always diff workspace manifests after a monorepo refresh:
  ```bash
  git diff -- '**/package.json' | grep -E '^[+-].*(workspace:|\|\||"latest")'
  ```
  If that prints anything, `--latest` mangled a spec. Restore the original string by hand, then
  re-lock.

Bun has no exclude flag, so enumerate the bump set explicitly per workspace when any hold-back
applies.

#### 1a. Repos pinned to a framework **preview / canary** release

A repo may deliberately pin its framework to a prerelease and rely on prerelease-only config
keys. A blanket `bun update --latest` **breaks these**: `--latest` targets the stable dist-tag,
so when every recent prerelease is still inside the age gate it silently **downgrades to
stable**. Stable drops the prerelease config keys → config type errors and a broken build.

**Detect before updating:**

```bash
committed=$(git -C "$repo" show HEAD:package.json | grep -m1 '"next"' | sed -E 's/.*: *"([^"]*)".*/\1/')
case "$committed" in *-preview*|*-canary*|*-rc*) IS_PRERELEASE=1 ;; *) IS_PRERELEASE=0 ;; esac
```

When `IS_PRERELEASE=1`, handle the framework **out** of the blanket update:

1. Bump everything **except** the pinned framework and any toolchain deliberately held with it.
   Enumerate the outdated set and pass it explicitly.
2. Move the framework to the **latest on its own channel** — never to stable:
   ```bash
   channel=$(printf '%s' "$committed" | grep -oE 'preview|canary|rc')
   target=$(npm view "next@$channel" version 2>/dev/null)
   ```
   - `target` **older than the gate** → a normal `bun add next@$target` installs it.
   - `target` **inside the gate** (usual for an active canary) → **bypass deliberately** and
     flag it:
     ```bash
     bun add "next@$target" --minimum-release-age=0
     ```
     This is an explicit, accepted exception. **You MUST record an alert** — the repo is now on
     a bypassed, un-aged prerelease that nobody has verified.
   - `target` **not newer** than the committed pin → leave it untouched. Do not re-resolve;
     re-resolving is what triggers the stable fallback.
3. Re-lock and confirm the installed version matches the intent and typecheck no longer errors
   on the prerelease config keys.

**Never let a prerelease-pinned repo end up on stable.** If no prerelease can be installed, keep
the committed pin and report it as blocked rather than downgrading.

#### 1a-expo. Expo repos

```bash
bun install                  # honour the committed lockfile
bunx expo install --check    # report deps that drifted from the installed SDK
bunx expo install --fix      # align them to SDK-compatible versions
```

- **Never `bun update --latest`** — Expo pins runtime deps to the installed SDK, so a blanket
  bump pulls SDK-incompatible versions. `expo install --check` / `--fix` is the only safe way to
  move Expo-managed deps. Leave non-Expo tooling bumps for a deliberate pass.
- **Never `npm install` / `npm ci` in a bun Expo repo** — it writes a `package-lock.json` that,
  alongside the real lockfile, makes the health checker report "multiple lock files" and drops
  the score. If you see that warning, delete the **stray** lockfile, never the tracked one.

#### 1b. Prune — clear the stale `node_modules` that install leaves behind

`bun install` adds and updates, but **does not remove** a package that dropped out of the
lockfile. Those orphans are not inert: a dangling `node_modules/.bin/<tool>` from a superseded
alias, or a nested second copy of `typescript`, produces failures that look like code problems.

Orphans also **distort the other reports**: a stale copy of a package alongside the real one
means audit and dedupe are reading a tree that does not match the lockfile. **Prune before you
audit or dedupe**, or the findings are noise.

- `bun prune --dry-run` lists without deleting. `--production` also drops devDependencies — for
  a Dockerfile, not for us; we need devDeps to lint and build.
- **Skip a repo where prune mis-reports.** A workspace monorepo may refuse with `lockfile does
  not match package.json` while `--frozen-lockfile` exits 0 on the same tree, or propose
  removing most of the installed packages. That is a tooling bug in nested workspaces, not real
  drift. Do not act on it and **do not hand-edit the lockfile**.
- Not a CI step — CI installs into an empty tree. This is local hygiene.

#### 1c. Audit — the advisory surface (report only)

Free and instant, so run it every refresh. **Report the counts; do not run `audit fix` as part
of this command.** Most findings are transitive, so a "fix" either does nothing within the
declared ranges or needs to cross a major — a deliberate decision, not a routine refresh.

Two things to know when reading the output:

- **Privately-hosted scopes are never audited.** A registry answering the audit endpoint with a
  404 gets skipped with a `warn:` line. Your own published packages have no coverage here —
  which is the gap `[[wf-web-scan-security]]` fills.
- **The routine refresh clears most of it.** Audit *after* the update; auditing first
  over-reports things the bump already fixed.
- **An SDK-pinned repo may stay red** — advisories inside transitive trees that the SDK pins and
  `expo install --check` reports as already up to date. Not fixable from this command; report it
  and move on rather than forcing a bump that breaks the build.

#### 1d. Dedupe — REPORT ONLY, never applied

`bun dedupe` collapses duplicate versions by re-resolving ranges onto a version already present.
It picks *a* satisfying version — **not necessarily the newer one** — so it happily downgrades,
sometimes by several majors, because the older copy satisfies some dependent's declared range.
Bun is behaving correctly; collapsing onto the older copy is still a behaviour risk with no
upside.

- Run `bun dedupe --dry-run` and **report** the count plus any proposed **downgrade** explicitly
  (package, from → to).
- Never run a bare `bun dedupe` here, and **never wire `bun dedupe --check` into CI** — it would
  pressure the fleet toward exactly those downgrades.
- The routine refresh does most of the work anyway; duplicates fall sharply after
  `update --latest` + `prune`.

### 2. Update agent skills

```bash
npx skills@latest update -y 2>&1 | tee /tmp/skills_update.log
```

`-y` is mandatory (non-interactive). If it prompts despite `-y`, treat that as a failure and
record it — do not hand-answer.

**Capture both failure shapes**, which the summary line hides:

```bash
grep -E 'Failed to update |Failed to check for deleted skills from ' /tmp/skills_update.log
```

- `✗ Failed to update <skill>` — still tracked locally but no longer resolvable at the source's
  expected path. **This almost always means the skill was renamed or removed upstream**, not a
  network blip.
- `✗ Failed to check for deleted skills from <owner/repo>` — the prune probe failed, so stale
  entries are never auto-removed and the tool retries the missing skill on every run.

**Distinguish upstream removal from a transient error — do not guess.** Re-run once. If the
**same** skills fail both times, it is a real upstream change (deterministic). If the set
**shifts**, it was transient and can be ignored.

When it is a stable upstream change, confirm the successor before recommending it:

```bash
gh api repos/<owner>/<repo>/contents/skills --jq '.[].name'   # some repos nest one level
```

**Reconcile stale skills** (only for confirmed renames/removals):

1. **Remove the failing skills** — the reference is dead either way:
   ```bash
   npx skills remove <old-skill> -y
   ```
   ⚠️ **`skills remove` deletes the files but leaves the entry in `skills-lock.json`.** That
   orphaned entry is exactly what makes `update` keep retrying. Prune every lock entry whose
   directory no longer exists — this is the step that actually stops the failures:
   ```bash
   node -e 'const fs=require("fs"),p=require("path");const f="./skills-lock.json";
     const j=JSON.parse(fs.readFileSync(f,"utf8"));
     for(const k of Object.keys(j.skills)) if(!fs.existsSync(p.join(".agents/skills",k))) delete j.skills[k];
     fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")'
   ```
2. **Generate the replacement list WITHOUT installing** (`-l` lists only):
   ```bash
   npx skills add <owner/repo> -l
   ```
   Build a table — **old name → successor (or "removed, no successor") → source repo**.
3. **Present that table and wait for confirmation.** Do not auto-install; a rename is only a
   *likely* match until the user confirms.
4. **After approval, install the confirmed successors**, then prune orphans again:
   ```bash
   npx skills add <owner/repo> -s <new-skill> -y
   ```

**`skills add` — three rules that will bite you:**

- **Never pass `-a '*'`.** It targets every agent type the tool knows, not the repo's configured
  agents, and silently creates stray root directories. **Omit `-a` entirely** — the tool
  auto-detects. Clean up strays with a *targeted* `git clean -fd <stray-dir>`; never a blanket
  one, since `data/` can be real source.
- **Multi-skill selection = repeated `-s`.** `-s a -s b -s c` works; `-s a,b,c` and `-s "a b"` do
  **not** — they match nothing and fall back to an empty result. In zsh an unquoted `$LIST` is
  passed as one arg; use `${=LIST}` or a real array.
- **`-s '*'` installs everything the source currently ships**, which can exceed what you tracked
  before. Enumerate names explicitly when you want a subset.

Re-run `update -y` afterwards and confirm `Failed to update` is 0. (`Failed to check for deleted
skills` probe warnings may persist — cosmetic once the lock is pruned.)

### 3. Quality suite

Run the repo's gates via `[[wf-web-check-quality]]`, which resolves the script surface rather
than assuming it. **Do not stop on first failure** — capture each exit code.

**Vendored skill folders must be ignored by every tool separately — each reads only its own
config.** A skill that ships `.js`/`.ts`/`.mjs` will tank lint, format, dead-code and health
unless excluded in all four:

| Tool | Config | Key |
|---|---|---|
| oxlint | `.oxlintrc.json` | `ignorePatterns` |
| oxfmt | `.oxfmtrc.json` | `ignorePatterns` |
| knip | `knip.json` | negated `project` globs |
| react-doctor | `doctor.config.json` | `ignore.files` |

Exclude `.agents/**`, `.claude/**`, `.cursor/**`, `.github/skills/**`. **A repo missing
`doctor.config.json` entirely will score badly** the moment a skill ships linty code; the tell
is that every deduction points inside `.agents/skills/…`. Do not blanket-ignore `agent/**` or
`data/**` (no dot) — those are not skill dirs, and `data/` may be real source.

If a script is genuinely absent, warn and skip — never substitute another tool.

## Common-deps drift check (ALWAYS — across the full fleet)

After the per-repo work, compare shared dependency versions across **every** repo — including
ones excluded from this run's scope. The goal is to catch a repo that has drifted on a common
package, so drift surfaces early rather than one repo at a time.

Read each repo's `package.json` (**and every workspace manifest in a monorepo** — a monorepo
root often declares none of the shared deps, so a root-only reading reports `—` as a **false
negative**). Skip `workspace:*` specs. Group by package name:

- Every repo agreeing → in sync (✓).
- Two or more distinct specs → drift. List the repos and versions.

Check the `exempt` table in `wf-fleet.json` before reporting: divergences recorded there are
deliberate. **When a divergence turns out to be intentional, add it to `exempt` with its
reason** — a checker people learn to ignore is worse than none.

Render as a matrix so mismatches are obvious:

| Package | repo-a | repo-b | repo-c | In sync? |

Use `—` where a repo does not declare the package, and label monorepo cells by workspace.

**Aligning drift is a deliberate act, not part of the routine pass.** Report it; align only when
the user asks or the divergence is plainly accidental. And **never auto-align an exact pin** — an
exact pin is a hold mechanism, and "fixing" it forward is precisely the bug the hold exists to
prevent.

Two drift causes worth naming, because they look like carelessness and are not:

- **The mid-run age-gate race** (§1e) — fixed at source by the pinned cutoff; this check is the
  backstop.
- **A package that must match a shared library's exact pin.** If an internal package declares an
  exact dependency, an app that drifts off it gets a second nested copy and two incompatible
  type trees — `tsc` then fails on structurally identical types. `bun why <pkg>` diagnoses it in
  one command (two version headers = duplication); the fix is to restore the exact spec, then
  install **and prune** — prune is what deletes the nested copy.

## Final report

| Repo | Deps changed | Pruned | Advisories | Dupes | Skills | lint | knip | typecheck | test | doctor |

✓ / ✗ with a short count on failures (`✗ (12 unused)`, `✗ (score 78)`). In the Skills column show
both counts when any fail (`20 ✓ / 7 stale`).

If any skills were confirmed stale, add a **Stale skills** section: skill, source repo, upstream
status (renamed → successor, or removed). Note that these are vendored-reference issues only —
they do not affect the app or the quality suite.

Then, below the table:

- **⚠️ Prerelease alerts** — one line per repo moved to or held on a prerelease pin, with the
  exact version and **whether the age gate was bypassed**. Bypassed prereleases are un-aged and
  must be re-verified manually — call this out explicitly.
- **Common-deps matrix** — with drift rows highlighted, or a one-line "all in sync". For any
  drift, say which cause it is; "drift" with no cause is not actionable.
- **Pre-existing vs. introduced** — if a check fails, note whether it **also fails on the clean
  committed baseline** (stash, or a pristine checkout + install + **prune**). A failure
  reproducible on `HEAD` is **pre-existing** — label it so, and do not attribute it to the bump.
  Include the prune: a stale `node_modules` can itself be the cause, in which case the failure is
  neither pre-existing nor introduced — it is **local drift**.
- **🔒 Advisories** — per-repo counts by severity, naming every critical with its dependency
  path. Say which are fixable here and which are locked behind an SDK pin. Report-only.
- **Proposed dupes** — per-repo dry-run count, with any proposed **downgrade** listed explicitly.
- **Workspace-spec integrity** (monorepos only) — confirm the post-refresh diff contains no
  `workspace:` → registry rewrite and no peer range flattened to `"latest"`. One line either way.

End with: **changes are uncommitted** — review per repo and open PRs with
`[[wf-web-create-pr]]`.

## Flags / arguments

Repo-name tokens in `$ARGUMENTS` scope the run. Default = the whole fleet.

## Cross-references

- `[[wf-web-update-deps-fix]]` — this, plus auto-fixing what it surfaces
- `[[wf-web-update-skills]]` — the skills-only counterpart
- `[[wf-web-check-quality]]` — the suite in §3
- `[[wf-web-list-fleet]]` — fleet resolution, `scopes` and `exempt`

User intent / overrides: $ARGUMENTS
