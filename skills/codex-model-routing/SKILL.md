---
name: codex-model-routing
description: Install or refresh opt-in Codex profiles, scoped model-role agents and a Jev routing adviser for a caller-supplied workspace. Use for reproducible model-routing setup; leave keys, personal preferences and session data with the caller.
---

# Set up Codex model routing

Use the caller's workspace manifest, checkout root and optional model preferences.
This public skill carries no workspace roster, personal settings, keys or history.
Requires Node 22.18+ or Bun, and Codex CLI with file profiles and standalone TOML
agents. The installer checks the CLI version/help and the local account model
catalog; the current format was verified with CLI 0.161.0.

```sh
node scripts/install.mjs --manifest /path/to/workspace.json --root /path/to/checkouts --dry-run
node scripts/install.mjs --manifest /path/to/workspace.json --root /path/to/checkouts
```

Run relative to this skill, or resolve its helper path. `--settings FILE` accepts
caller-owned preferences. `--codex-home DIR` overrides `CODEX_HOME`/`~/.codex`.
If the model catalog is missing, sign in and start Codex once, then rerun setup.
The helper uses only standard-library APIs; no package installation is needed.

Installing a skill alone does not activate its configuration. An authorized
routing-setup request covers this installer. It writes only named profiles,
prefixed custom agents, and their runtime directory under the Codex home. It
backs up differing existing files and prints their diffs; identical files are
left alone. It rejects managed destinations that are symlinks. It never edits
the base config, permissions, repository files or authentication. Model choices
and reasoning efforts must exist in the caller's account catalog.

Profiles are explicit launch choices. Ordinary sessions keep their original
defaults. The installed roles support bounded read-only exploration, prescribed
mechanical edits and scoped independent judgment. The Jev MCP tool recommends
a model before an eligible default-agent spawn; the parent must honor the advice.
It is not enforced interception or a native advisor feature.

Without a key, with `AGENT_ROUTER=off`, or outside the configured root, the MCP
server advertises no routing tool. Explicit models/efforts, typed agents and
full-history forks are skipped. API errors, invalid answers, unavailable models,
three-second timeouts and confidence below 0.8 preserve the original spawn input.
There is no production keyword fallback or approval override. Eligible briefs
up to 6000 characters go to TypeSafe. Never include credentials in those briefs.

Read [configuration and verification](references/configuration.md) when selecting
models, maintaining an installation, or running benchmarks. Keep real prompts,
logs and reports private; the bundled cases are synthetic. Do not automatically
benchmark session history during setup.

Validate with the bundled offline tests:

```sh
node --test tests/*.test.mjs
```
