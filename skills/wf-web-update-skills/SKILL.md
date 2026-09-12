---
name: wf-web-update-skills
description: Skills-only refresh across a fleet of repos — npx skills update in each, detect skills that failed to update, distinguish transient failures from genuine upstream renames and removals, attempt fixes (retry, targeted re-update, resync, reinstall, lock restore), prune orphaned lock entries, then re-verify and report. No dependency changes. Leaves changes uncommitted.
---

# wf-web-update-skills — refresh agent skills, then fix what failed

Refreshes **only** the vendored `.agents/skills/` bundle across the fleet, detects skills that
failed, **attempts to fix them**, re-verifies and reports.

This is the skills-only counterpart to `[[wf-web-update-deps-fix]]` — it does **not** touch
`package.json`, the lockfile, or run the quality suite. **Runs to completion without prompting.**
Changes are left **uncommitted**.

## The fleet

Resolved per `[[wf-web-list-fleet]]`. Skills handling is identical for every repo — there are no
per-repo special cases here (those are deps-only). Repo-name tokens in `$ARGUMENTS` scope the run;
missing repos are skipped silently.

## Preflight

```bash
command -v npx >/dev/null 2>&1 || { echo "ERROR: npx (Node.js) is required for the skills CLI"; exit 1; }
```

Subcommands used: `update [skills...] -y` (alias `upgrade`), `list`/`ls`, `add <pkg>`,
`remove [skills]`, `experimental_sync` (re-sync installed skills into agent dirs),
`experimental_install` (restore from `skills-lock.json`). `-p`/`--project` scopes to project
skills, `-g`/`--global` to global; default `-y` auto-detects.

## Workflow

Process repos **one at a time, sequentially** — the CLI writes into shared agent directories and
concurrent runs race.

### 1. Update

```bash
npx skills@latest update -y
```

Capture the full output **and** the exit code. If it prompts despite `-y`, treat that as a failure
and record it — do not hand-answer.

### 2. Detect failures

Classify each line:

- **`✓ Updated <skill>`** → success.
- **`✗ Failed to check for deleted skills from <source>`** → a **soft** warning about the
  deletion-reconciliation probe for one source, usually a rate limit or network blip. The skill
  itself often still updates on the same run. It is only a real failure if it persists after a
  retry.
- **`✗ Failed to update <skill>`, a non-zero exit, a stack trace, or a hang** → a **hard** failure.

Track soft and hard separately. A repo with only `✓` lines and exit 0 is clean — skip the fix
phase for it.

> **Do not guess whether a failure is transient.** Re-run once. If the **same** skills fail both
> times, it is deterministic — a real upstream rename or removal. If the set **shifts**, it was
> transient. This one distinction decides whether you reconcile or wait.

### 3. Attempt fixes (only for repos with failures)

In order, re-checking after each; stop as soon as the repo is clean:

1. **Retry once** — soft warnings are usually transient:
   `npx skills@latest update -y`
2. **Targeted re-update** of just the failing skill(s):
   `npx skills@latest update <skill> -y`
3. **Re-sync agent dirs** — if a skill updated in `node_modules` but the agent-dir copy is stale:
   `npx skills@latest experimental_sync`
4. **Reinstall** a stubbornly broken skill — find its source via `npx skills@latest list`, then:
   ```bash
   npx skills@latest remove <skill>
   npx skills@latest add <owner/repo> -s <skill> -y
   ```
5. **Restore from lockfile** if the bundle is inconsistent:
   `npx skills@latest experimental_install`

⚠️ **`skills remove` leaves the entry in `skills-lock.json`.** That orphan is what makes `update`
keep retrying and re-reporting the failure. After any removal, prune every lock entry whose
directory no longer exists — this is the step that actually stops the failures:

```bash
node -e 'const fs=require("fs"),p=require("path");const f="./skills-lock.json";
  const j=JSON.parse(fs.readFileSync(f,"utf8"));
  for(const k of Object.keys(j.skills)) if(!fs.existsSync(p.join(".agents/skills",k))) delete j.skills[k];
  fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")'
```

**Never hand-edit files under `.agents/skills/` to force a pass** — that masks the failure and the
next update overwrites it anyway. If none of the above clears a hard failure, leave it and report
it: it is almost certainly an upstream skill-repo issue, not something to paper over locally.

**When reinstalling, three `skills add` rules apply** (full detail in `[[wf-web-update-deps]]` §2):
never `-a '*'` · repeated `-s` for multiple skills, never a comma list · `-s '*'` installs
everything the source ships, which may exceed what you tracked.

### 4. Re-verify

Re-run `npx skills@latest update -y` once per fixed repo and confirm only `✓` lines (or an
idempotent no-op) with exit 0.

## Final report

| Repo | Skills updated | Soft warnings | Hard failures | Fixed | Still needs you |

Short counts (`12 updated`, `1 soft (deletion probe)`, `0 hard`). For each repo that needed
fixing, one line on what cleared it (retry / targeted / resync / reinstall / lock restore).
Distinguish **soft transient** warnings from **hard** failures that persisted — collapsing the two
makes the report unreadable next time.

End with: **changes are uncommitted** — review per repo and open PRs with `[[wf-web-create-pr]]`.

## Cross-references

- `[[wf-web-update-deps]]` — deps + skills together, with the full reconciliation flow
- `[[wf-web-update-deps-fix]]` — that, plus auto-fixing quality findings

User intent / overrides: $ARGUMENTS
