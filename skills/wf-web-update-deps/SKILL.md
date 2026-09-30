---
name: wf-web-update-deps
description: Refresh dependencies and installed agent skills in selected repositories, preserve release-age guards and intentional pins, validate each repo, and report cross-repository dependency drift. Leave changes uncommitted; use wf-web-update-deps-fix to repair introduced failures.
---

# Refresh dependencies and agent skills

Resolve membership through `wf-web-list-fleet` and honor the caller's repo subset.
An explicit workspace manifest is the boundary, including for read-only drift
checks. Read each repo's instructions, status, lockfiles, package-manager config,
workspace declarations, and setup manifest before updating. Preserve unrelated
changes and record the starting commit for baseline comparisons.

Detect the manager and available scripts; do not substitute a different manager
or invent a missing check. Non-JavaScript members stay visible in the inventory
but use their own documented update workflow. Process installs sequentially.

## Preserve update policy

Respect exact pins, held majors, prerelease channels, workspace links, peer ranges,
and tool families that must move together. Resolve supported flags from the
installed manager's help and current official documentation. A past tool bug is
a reason to verify the resulting diff, not a permanent claim about every version.

Apply the version scope the user requested. A within-range refresh can use the
manager's ordinary update. Use `--latest` only when moving beyond declared ranges
is in scope, and exclude intentional holds. Do not silently adopt a major that
the repo explicitly holds back. Record unresolved migration choices separately.

### One release-age cutoff

Read the configured minimum age; do not replace it with a fixed house default.
Capture the run's starting time once. Immediately before each update, add elapsed
time to that repo's configured age, keeping its effective publish cutoff fixed.
Recompute for every workspace invocation, not only once per repository.

```sh
WF_RUN_START=$(date +%s)  # once for the run
# WF_GATE_SECONDS comes from the selected repository's configuration.
WF_RUN_AGE=$((WF_GATE_SECONDS + $(date +%s) - WF_RUN_START))
bun update --minimum-release-age="$WF_RUN_AGE" <selected-packages>
```

Preserve the existing trusted-package exclusions. Do not add new exclusions or
set the age to zero just to obtain a newer release. A repo without a guard needs
that limitation reported; adding a guard is a separate setup choice.

### Monorepos

Enumerate the declared workspaces, including nested workspace globs. Inspect each
manifest's update constraints and tool families. Current Bun supports recursive
and filtered updates; older versions may require running inside each workspace.
Use a supported mode that honors different holds, then perform one root install.
Verify both workspace manifests and the root lockfile, not only the root manifest.

Inspect the diff for changed `workspace:*` links, flattened multi-range peers,
new `latest` peer specs, unrequested overrides/resolutions, lockfile-format changes,
and manifest overrides inconsistent with direct dependency specs. Preserve the
original intentional specs and confirm compatibility with the deployment toolchain.
For published npm packages, use the repo's publish dry-run check where available.

### Prerelease pins

Detect a preview, canary, or release-candidate pin before updating. Keep its
committed version out of the blanket update and report it. Move it on its existing
channel only when the user requested that change. Never bypass the age guard or
switch to stable as an incidental dependency refresh. Check every relevant
framework config key against the installed schema after a framework update.

### Expo and coupled tooling

Use the installed Expo SDK's compatibility commands for Expo-managed dependencies,
with the repo's declared package manager. Do not apply a blanket latest update to
runtime packages constrained by the SDK. Update non-Expo tooling explicitly within
its recorded holds. Move other coupled families with their documented upgrade tool.

## Install, inspect, and validate

Use the selected manager's supported update, then reconcile the root lockfile and
prove a frozen install succeeds. For npm, use `npm ci`; for Yarn, distinguish
Classic frozen-lockfile mode from modern immutable mode. Keep one lockfile scheme.

Where supported, inspect prune's proposal before applying it. If it proposes
removing most of a valid nested workspace tree or disagrees with a successful
frozen install, report the tooling failure and skip it. Do not hand-edit a lockfile
or remove source directories to make prune green.

Run the declared advisory check, or the manager's supported dependency audit when
requested. Report severity and affected dependency paths; do not run an automatic
`audit fix`. A skipped private-registry audit is a coverage gap, not proof that
its packages are safe. An AI code scan does not replace dependency advisory data.

Use dedupe only in a documented preview mode during this refresh. Report proposed
downgrades and do not apply them merely to reduce a count.

Refresh installed skills through `wf-web-update-skills`. Persistent errors require
source verification before replacement or retirement. Reconcile the repo's declared
setup and canonical generated instructions when a documented helper exists. Do not
copy a private fleet's manifest, permissions, or conventions into public skills.

Run the repo's own checks through `wf-web-check-quality`, with installation already
completed. Capture every applicable result; avoid rerunning the constituents of an
aggregate gate. Exclude vendored agent directories from each applicable tool's
configuration, while preserving real source directories such as data or agent code.

## Classify failures

Compare failing checks with the starting committed baseline in an isolated
checkout. Install that baseline's own dependencies before checking it. Do not
reset, stash, or replace files in the author's working tree for this comparison.

- Local drift: the failure clears after valid installed-tree reconciliation.
- Pre-existing: it also fails on the starting baseline.
- Introduced: the baseline passes and the updated checkout fails.

Record the evidence. This workflow reports findings; `wf-web-update-deps-fix`
repairs introduced failures. Do not label an uncertain failure as a regression.

## Dependency drift

Compare shared specs across every member of the resolved workspace, including
workspace manifests and members not updated in this run. Keep this comparison
read-only. Distinguish declared spec drift from actually resolved version drift.
Skip workspace-link specs and record documented intentional differences. Never
align an exact pin or install a common version automatically.

If type identities split after a bump, inspect the dependency tree and peer ranges.
Two installed versions can explain the failure; they are not automatically wrong.
Reconcile the repo's declared constraints rather than forcing a new global override.

## Report

Use one table with repo, dependency changes, skill changes, check results, and
unresolved work. Add the common-dependency matrix only when it reveals a difference.
Name held prereleases, intentional pins, advisory coverage gaps, proposed downgrades,
manifest/spec integrity problems, and pre-existing failures when relevant.

Use plain English and exact versions in the report body, not a long version list
in a commit or PR title. Leave all changes uncommitted. User scope: $ARGUMENTS.

Official references: [Bun update](https://bun.sh/docs/pm/cli/update),
[Bun install](https://bun.sh/docs/pm/cli/install),
[skills CLI](https://github.com/vercel-labs/skills).
