---
name: agent-setup
description: Set up a repository for effective agent-assisted development. Orchestrates opt-in phases — curated skill recommendations based on the detected stack (web, React Native, iOS, Android, Python, …), a context-management playbook and stack-aware quality gates (lint/typecheck/react-doctor/…) written into CLAUDE.md, a permissions allowlist, deterministic hooks (including write-protection for vendored third-party skills), and supply-chain guards (minimum-release-age for bun/pnpm/uv). Use when the user asks to "set up this repo for agents", "agent setup", "what skills should I add", "recommend skills", "set up quality gates / guardrails", or is bootstrapping agent tooling in a new or existing project.
metadata:
  author: MrBrunoWolff
  version: "1.0.0"
---

# agent-setup — make a repo agent-ready

Run an opt-in, phase-by-phase setup. **Present each phase's plan, get confirmation, then apply.**
The user may skip any phase. Never apply anything unconfirmed.

## Phase 0 — Assess current state

Before proposing anything, read what exists:

- `CLAUDE.md` (root and `.claude/`) — does it exist? Does it already have `## Context management`
  or `## Quality gates` sections?
- Quality tooling — `package.json` lint/typecheck/test/doctor scripts, `ruff`/`mypy`/`clippy` configs.
- `.claude/settings.json` / `.claude/settings.local.json` — existing permissions and hooks?
- `skills-lock.json` — which skills are already installed?
- Package-manager config (`bunfig.toml`, `pnpm-workspace.yaml`, `[tool.uv]`) — release-age guard present?
- Stack markers (see [recommend.md](recommend.md) step 2).

On re-runs, every phase below outputs a **diff against current state**, not a fresh dump.
"Everything already configured" is a valid, common outcome.

## Phase 1 — Skills

Follow [recommend.md](recommend.md) end-to-end: load the vetted catalog (live-fetched from
the-skills) → detect stack(s) → diff against installed skills → compose one-skill-per-concern
within budget → present plan → confirm → install. This phase also runs standalone when the user
only asks for skill recommendations.

## Phase 2a — Context-management playbook → CLAUDE.md

Insert the playbook from [context-playbook.md](context-playbook.md) into the repo's `CLAUDE.md`
under a `## Context management` heading (create `CLAUDE.md` if absent; replace the section if it
already exists from a previous run).

**Be honest about enforcement tiers when presenting this phase:**

| Tier | Mechanism | Reliability |
|------|-----------|-------------|
| Convention | CLAUDE.md instruction | Soft — followed most of the time |
| Automation | Hook in settings.json | Hard — harness-executed, always fires |
| Impossible | e.g. "at exactly N% context, do X" | No context-% hook event exists — do not write fake-precision rules |

Tailor the playbook lightly to the repo (e.g. reference the repo's actual test command, mention
`/handoff` only if the handoff skill is installed or was accepted in Phase 1).

## Phase 2b — Quality gates → CLAUDE.md

Write a `## Quality gates` section into `CLAUDE.md` so **every future agent** runs the repo's
quality checks before committing — this is the durable, standing guardrail, not a one-time scan.

Procedure (see [quality-gates.md](quality-gates.md) for the per-stack reference):

1. Detect the stack(s) and which gate tools the repo **actually has** — `package.json` scripts and
   dev-deps, config files (`tsconfig.json`, `ruff.toml`, `.golangci.*`, …).
2. Compose the **fast core loop** (lint → typecheck → react-doctor for web; the stack's core gates
   otherwise), using the repo's real script names. List heavier gates (knip, build, full test
   suite) separately as "before push/PR".
3. **Flag missing core gates** — e.g. a Next.js repo with no typecheck script: offer to add
   `"typecheck": "tsc --noEmit"`. Suggest; don't silently inject.
4. Write the section (template in [quality-gates.md](quality-gates.md)) with the rule: never commit
   on a failing gate; fix the rule/config, don't weaken or skip it.

These gate commands should also be **allowlisted in Phase 3a** so they run prompt-free, and may be
**enforced by a hook in Phase 3b** for teams that want hard rather than soft enforcement.

## Phase 3a — Permissions allowlist

Propose pre-approving common **safe, read-only** commands in `.claude/settings.json` to reduce
permission-prompt fatigue. Baseline (tailor to the detected stack):

```json
{
  "permissions": {
    "allow": [
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git branch:*)",
      "Bash(ls:*)",
      "Bash(rg:*)",
      "Bash(find:*)"
    ]
  }
}
```

Add the **Phase 2b quality-gate commands** as allowlist entries (e.g. `Bash(bun run lint:*)`,
`Bash(bunx tsc --noEmit:*)`, `Bash(bun run doctor:*)`, `Bash(pytest:*)`) **only** if the user opts
in — gate runners execute project code, so they're a step up in trust from read-only git/ls/rg.
Allowlisting them is what makes the gates run prompt-free. Never propose allowlisting
write/network/destructive commands (`rm`, `curl`, `git push`, deploy commands).

Merge into existing `settings.json` — never clobber existing permissions or other keys.

## Phase 3b — Hooks (deterministic automations)

Offer a **modest** set — hooks run on every matching event, so each one must earn its place:

1. **PreCompact snapshot** — before any compaction, append a one-line state marker to a scratch
   file so post-compact sessions can recover intent:

   ```json
   {
     "hooks": {
       "PreCompact": [
         {
           "matcher": "",
           "hooks": [
             {
               "type": "command",
               "command": "mkdir -p .claude/state && date '+%Y-%m-%d %H:%M compacted' >> .claude/state/session-log.txt"
             }
           ]
         }
       ]
     }
   }
   ```

2. **SessionStart todo surfacing** — if the repo keeps a `TODO.md` or handoff doc, cat it at
   session start so resumed sessions begin with state:

   ```json
   {
     "hooks": {
       "SessionStart": [
         {
           "matcher": "",
           "hooks": [
             {
               "type": "command",
               "command": "test -f .claude/state/handoff.md && cat .claude/state/handoff.md || true"
             }
           ]
         }
       ]
     }
   }
   ```

3. **Vendored-skill write protection** (recommended whenever `skills-lock.json` exists) — a
   PreToolUse hook that **blocks** any Edit/Write to installed third-party skill files. This is
   the hard-tier enforcement of the "vendored skills are read-only" convention — it stops agents,
   reviewers, and refactor sweeps from modifying files that `npx skills update` will clobber:

   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Edit|Write",
           "hooks": [
             {
               "type": "command",
               "command": "jq -r '.tool_input.file_path // empty' | { read -r f; if [ -f skills-lock.json ] && printf '%s' \"$f\" | grep -qE '\\.(claude|agents|cursor|github)/skills/'; then echo 'Blocked: vendored third-party skill (tracked in skills-lock.json). Edits are overwritten by npx skills update — write your own skill or PR upstream instead.' >&2; exit 2; fi; exit 0; }"
             }
           ]
         }
       ]
     }
   }
   ```

   Exit code 2 blocks the tool call and feeds the message back to the agent. Escape hatch: the
   user edits manually outside the agent, or temporarily disables the hook.

4. **Quality-gate enforcement** (optional — hard enforcement of the Phase 2b gates) — a Stop hook
   that runs the fast core gate loop and blocks the turn from ending if it fails, so an agent can't
   wrap up on a red lint/typecheck. Only offer when the gates are fast (seconds); never wire a full
   build or slow test suite into a Stop hook — it punishes every turn. Example (web):

   ```json
   {
     "hooks": {
       "Stop": [
         {
           "matcher": "",
           "hooks": [
             {
               "type": "command",
               "command": "bun run lint && bunx tsc --noEmit || { echo 'Quality gate failed — fix lint/typecheck before finishing.' >&2; exit 2; }"
             }
           ]
         }
       ]
     }
   }
   ```

   Default to **soft** (the CLAUDE.md guide from Phase 2b) unless the user explicitly wants the hook
   — Stop hooks fire on every turn end and slow the loop.

Present each hook individually; merge into existing `settings.json` hooks without clobbering.
If `.claude/state/` is introduced, add it to `.gitignore` (ask first — some teams want handoff
docs committed).

## Phase 4 — Supply-chain guards

Check (and on opt-in, fix) **minimum-release-age** protection for the repo's package manager, so
freshly published — possibly compromised — package versions can't be installed for N days:

| Manager | Detected by | Guard | Mechanism |
|---------|-------------|-------|-----------|
| bun | `bunfig.toml` / `bun.lock` | `[install] minimumReleaseAge = 259200` (3 days, seconds) in `bunfig.toml` | **Rolling** — enforced on every install, including CI/Vercel |
| pnpm | `pnpm-lock.yaml` | `minimumReleaseAge: 4320` (3 days, minutes) in `pnpm-workspace.yaml` | **Rolling** |
| npm | `package-lock.json` | none rolling — `before` config is a static timestamp | Flag the limitation; suggest migrating to bun/pnpm if the user cares |
| uv | `uv.lock` | `exclude-newer` in `[tool.uv]` — static RFC3339 date | Static — note it must be refreshed periodically (e.g. by the update routine) |
| cargo / others | `Cargo.lock` etc. | no native equivalent | Mention; nothing to apply |

Procedure:

1. Detect the manager(s); read the existing config — if a guard is already set, report and move on.
2. If missing, propose the guard with a 3-day default (user may pick another window).
3. **Pair with the update flow**: a release-age guard means routine `update` commands must respect
   it or builds break later. This is exactly what the `update-setup` skill handles (per-manager
   guarded bumps + `npx skills update`) — install it in Phase 1 if not already.
4. Remind that the guard only protects installs that go through the lockfile path — `npx`/`bunx`
   one-offs (including `npx skills` itself) execute fresh packages outside it. Prefer pinned
   versions for recurring scripted `npx` use.

## Final report

End with a summary table: phase → applied / skipped / already configured, plus exact files touched.
Remind the user that `settings.json` changes take effect on the next session.

## Out of scope

- Anything destructive or that weakens safety (allowlisting write/network commands, auto-approve modes).
- CI/CD, git hooks (husky etc.), or editor config — different concern, different tools.
- Modifying the user's global `~/.claude/` config beyond suggesting global-scope skill installs.
