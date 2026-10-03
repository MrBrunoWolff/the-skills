# the-skills

Personal [agent skills](https://skills.tools) by [@MrBrunoWolff](https://github.com/MrBrunoWolff),
installable with the [`skills`](https://github.com/vercel-labs/skills) CLI — the same tool used for
`vercel-labs/agent-skills`, `mattpocock/skills`, etc.

[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

## Install

```bash
# a specific skill
npx skills@latest add MrBrunoWolff/the-skills --skill agent-setup

# list what's available
npx skills@latest add MrBrunoWolff/the-skills --list

# everything
npx skills@latest add MrBrunoWolff/the-skills --all
```

Works with `bunx` too (`bunx skills@latest add ...`). Skills install into every detected agent
directory (`.claude/`, `.agents/`, `.cursor/`, `.github/`) and are tracked in `skills-lock.json`.

## Skills

### Workspace setup

[`workspace-clone`](skills/workspace-clone/SKILL.md) clones missing repositories
from a caller-supplied manifest and checkout root. It preserves existing work,
checks origins, supports dry runs and subsets, and assumes no organization,
branch names, package manager, or application stack.

A small selection for multi-repository work is `workspace-clone`,
`wf-web-list-fleet`, and `wf-web-check-quality`. Install only the workflows you
need. The inventory skill accepts an explicit workspace manifest, so a private
workspace can supply its roster without copying it into these public skills.

```sh
npx skills@latest add MrBrunoWolff/the-skills --skill workspace-clone wf-web-list-fleet wf-web-check-quality
```

The clone helper needs only Git and Bun or Node 22.18+. Repository manifests and
credentials stay with the caller. Clone and application setup are separate:
after cloning, read each project's own instructions before installing its tools
or dependencies. Existing skills remain available for users who need them.

### Repo setup

| skill&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | what it does |
|---|---|
| [`agent&#8209;setup`](skills/agent-setup/SKILL.md) | Make a repo agent-ready in opt-in phases: stack-aware curated skill installs, a context-management playbook **and quality gates** (lint/typecheck/react-doctor/…) in `CLAUDE.md`, a permissions allowlist, deterministic hooks (incl. vendored-skill write protection), and supply-chain release-age guards. |
| [`update&#8209;setup`](skills/update-setup/SKILL.md) | Refresh a repo's setup: stack-aware dependency bumps under a minimum-release-age supply-chain guard (bun/pnpm/npm/uv/cargo) **and** vendored agent-skill updates via `npx skills update`. The maintenance counterpart to `agent-setup`. |


### Web fleet (`wf-web-*`)

A family for running a fleet of web repos — Next.js + React 19 + Tailwind 4 + bun, optionally with
a PWA and a password gate. Nothing is hardcoded to a particular repo: each skill **detects** the
package manager, framework, monorepo layout, deploy target, default branch and available scripts
from the repo itself, and reads deploy URLs and grouping from an optional
[`wf-fleet.json`](skills/wf-web-list-fleet/SKILL.md). Start with `wf-web-list-fleet` — it defines
the contracts the rest read.

| skill | what it does |
|---|---|
| [`wf&#8209;web&#8209;list&#8209;fleet`](skills/wf-web-list-fleet/SKILL.md) | The roster, **and the contracts** the rest of the family uses: fleet resolution, the optional `wf-fleet.json`, and the detected repo profile. Read this one first. |
| [`wf&#8209;web&#8209;check&#8209;quality`](skills/wf-web-check-quality/SKILL.md) | Run the repo's own gates — lint, format, dead-code, typecheck, tests, health, audit — resolving which exist rather than assuming, collecting every exit code, and printing one table. |
| [`wf&#8209;web&#8209;create&#8209;repo`](skills/wf-web-create-repo/SKILL.md) · [`wf&#8209;web&#8209;create`](skills/wf-web-create/SKILL.md) | Bootstrap a new web repo (action) from the canonical skeleton (knowledge) — supply-chain-hardened `bunfig.toml`, the four agent-dir exclusions, a composite `check` script, CI. |
| [`wf&#8209;web&#8209;setup&#8209;pwa`](skills/wf-web-setup-pwa/SKILL.md) · [`wf&#8209;web&#8209;pwa`](skills/wf-web-pwa/SKILL.md) | Install or refresh a PWA (action) from the canonical templates (knowledge) — manifest, service worker with build-time version injection, icon generation, layout wiring. |
| [`wf&#8209;web&#8209;create&#8209;pr`](skills/wf-web-create-pr/SKILL.md) · [`wf&#8209;web&#8209;code&#8209;reviewer`](skills/wf-web-code-reviewer/SKILL.md) | Open a PR behind a blocking quality gate, a PWA/auth diff audit and an interview-style review (the reviewer charter is its own skill). |
| [`wf&#8209;web&#8209;update&#8209;deps`](skills/wf-web-update-deps/SKILL.md) · [`&#8209;fix`](skills/wf-web-update-deps-fix/SKILL.md) · [`wf&#8209;web&#8209;update&#8209;skills`](skills/wf-web-update-skills/SKILL.md) | Fleet-wide dependency and vendored-skill refresh under the configured release-age guard, with a cross-repo drift matrix. `-fix` also repairs what the new tooling flags; `update-skills` is the skills-only pass. |
| [`wf&#8209;web&#8209;resync`](skills/wf-web-resync/SKILL.md) | Make local repos mirror remote — per-repo default branch, evidence-based branch classification, stray-remote detection behind its own gate. |
| [`wf&#8209;web&#8209;scan&#8209;security`](skills/wf-web-scan-security/SKILL.md) · [`wf&#8209;web&#8209;deepsec`](skills/wf-web-deepsec/SKILL.md) | On-demand [deepsec](https://github.com/vercel-labs/deepsec) vulnerability scan (action) plus the bun conversion and cost model (knowledge). Local matcher scan, then an authorized AI review of candidates. |
| [`wf&#8209;web&#8209;agentic`](skills/wf-web-agentic/SKILL.md) | Agentic readiness — `chrome-devtools-mcp` for verifying a running app, and the Lighthouse Agentic Browsing category. Advisory, never a gate. |

## Agents

Two subagents live in [`agents/`](agents/). The `skills` CLI installs **skills only**, so these are
a manual copy into `.claude/agents/`:

```bash
curl -sL https://raw.githubusercontent.com/MrBrunoWolff/the-skills/main/agents/wf-web-code-reviewer.md \
  -o .claude/agents/wf-web-code-reviewer.md
```

| agent | what it does |
|---|---|
| [`wf&#8209;web&#8209;code&#8209;reviewer`](agents/wf-web-code-reviewer.md) | Conducts the PR review as an interview — one finding per turn, recommended answer stated up front. Loads the charter skill. |
| [`wf&#8209;web&#8209;deps&#8209;fixer`](agents/wf-web-deps-fixer.md) | Fixes one repo's quality findings after a dependency bump, keeping typecheck green and deferring anything ambiguous. |

Both callers run inline when delegation is unavailable or not authorized. Agent definitions
inherit the caller’s model choice.

## Catalog

[`skill-sources.md`](skill-sources.md) — the vetted catalog of agent-skill source repos (general,
web, iOS, Android, …) that `agent-setup` consumes (live-fetched at run time, so catalog updates
reach installed copies without reinstalling). Not a skill itself — propose additions via PR.

## Layout

```
skills/
  <skill-name>/
    SKILL.md      # YAML frontmatter (name + description) + the skill body
agents/
  <agent-name>.md # subagent definitions — manual install, not served by the skills CLI
```

Each skill is a directory under `skills/` containing a `SKILL.md` with `name` and `description` in
its frontmatter — the format the `skills` CLI scans for.

[`wf-web-lighthouse`](skills/wf-web-lighthouse/SKILL.md) covers production Lighthouse scores, browser traces, reproducible budgets, Chrome DevTools MCP setup, and separate PWA checks.
