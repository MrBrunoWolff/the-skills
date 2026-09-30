---
name: update-setup
description: Refresh one repository's dependencies and installed agent skills using its declared tools, release-age guards, intentional pins, and quality checks. Use for routine maintenance; leave changes uncommitted unless the user requests a commit.
metadata:
  author: MrBrunoWolff
  version: "2.4.0"
---

# Refresh a repository's setup

This is the single-repository maintenance counterpart to `agent-setup`. Read the
repo's instructions, status, declared tool versions, lockfiles, setup manifest,
and scripts first. Preserve unrelated work. A skills-only repo needs no application
package manifest; a dependency-only repo needs no skills install.

## Dependencies

Use the repo's declared package manager and requested update scope. Preserve exact
pins, held majors, prerelease channels, workspace links, and coupled tool families.
Use current supported commands rather than assuming flags from an older version.

Keep the configured release-age guard active during resolution. Read its value,
units, and exclusions; do not overwrite it with a fixed default. For a multi-step
run, keep the effective cutoff fixed by adding elapsed time to the configured age.
An absent guard is a limitation to report, not permission to add one during refresh.

- Bun: update selected packages with its configured minimum age, reconcile the
  install, and verify a frozen install. For monorepos, cover every declared workspace
  with a supported recursive/filter mode or explicit per-workspace updates.
- pnpm: honor the workspace's minimum-age configuration and version holds.
- npm: use the requested within-range or explicit version-update workflow. Do not
  claim it enforces a rolling age guard without evidence from the installed version.
- uv: honor `exclude-newer`; refresh a static cutoff only when that policy is part
  of the requested maintenance. Lock and sync with the repo's supported modes.
- Cargo and other managers: use the repo's documented update workflow and describe
  any unsupported age-policy requirement rather than inventing an equivalent.

Do not bypass a guard or move a prerelease pin merely to turn a failed install green.
Use Expo's SDK compatibility workflow for Expo-managed runtime dependencies. Inspect
manifest and lockfile diffs for changed workspace links, peer ranges, overrides,
lockfile formats, and deployment-tool compatibility before treating the update as done.

## Installed skills

If the repo has a skills lock, refresh project skills with its supported CLI:

```sh
npx skills@latest update --project --yes
```

Use a pinned CLI when the repository declares one. Capture failures and retry once
when appropriate. Verify source access and the current skill list before calling
anything renamed or removed; repeated errors and private-repo 404s are not proof.
Keep uncertain skills and lock entries. Show concrete successor mappings and apply
only replacements covered by the user's request. Do not hand-edit vendored content.

Reconcile the declared selection with the repo's documented setup helper if one
exists. Report source collisions and preserve unrelated MCP, permissions, and hooks.
Workspace-managed source links should be refreshed through their workspace helper.
See `wf-web-update-skills` when installed for the detailed repair procedure.

## Verify and report

Prove the install matches the resulting lockfile, then run only the checks the repo
actually declares. Do not assume a passing root command covered nested workspaces
or that an aggregate gate needs its constituents run again. Report audit findings;
do not run automatic vulnerability fixes during a routine update.

Compare failures with the starting baseline in a separate checkout. Distinguish
pre-existing failures, introduced failures, and installed-tree drift. Preserve the
working tree during that comparison.

Report dependency changes, skill changes, held versions, guard behavior, checks,
and unresolved work in plain English. Leave changes uncommitted by default. If a
commit was requested, stage explicit in-scope paths and include each changed
manifest with its lockfile; never stage unrelated work or append AI attribution.
