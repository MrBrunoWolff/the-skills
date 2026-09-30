---
name: wf-web-update-skills
description: Refresh installed agent skills in selected repositories, verify failed updates against their upstream source, restore the declared selection where one exists, and report changes without modifying application dependencies or committing.
---

# Refresh installed agent skills

Resolve repository membership through `wf-web-list-fleet`. An explicit workspace
manifest limits membership; do not expand it by scanning siblings. Report missing
checkouts. Read each selected repo's instructions and skill lock before changing
anything. Process repositories sequentially and preserve unrelated work.

## Update and inspect

Use the repository's pinned skills CLI when it has one; otherwise use the current
CLI and record its version. Check its help before relying on optional or
experimental commands. The supported project update is:

```sh
npx skills@latest update --project --yes
```

Capture the exit code and complete output. If the command unexpectedly prompts,
report the failure instead of answering with an invented choice. A deletion-check
warning and a failed skill update are separate results; record both.

Retry once when a transient failure is plausible. Repeated failure establishes
persistence, not deletion: authentication, network errors, and rate limits can
also persist. Verify the source is accessible, then list its current skills and
look for the expected path. For private sources, a 404 can mean missing access.
Do not call it removed until a successful source lookup establishes absence.

## Repair within the declared selection

- Reinstall an unchanged skill from its recorded source when that source still
  publishes it. Preserve the selected agent types and project scope.
- For a confirmed rename, identify the successor by purpose and source. Show the
  concrete old-to-new mapping before applying it. Proceed when the user's request
  covers that replacement; ask when the mapping or intended behavior is uncertain.
- Keep a removed skill locally while its replacement or retirement is unresolved.
  A failed update alone does not authorize deleting a useful installed skill.
- Inspect the installed CLI's behavior after removal. If a stale lock entry remains,
  remove only that confirmed retired entry after checking every configured agent
  store. Do not prune all missing directories: an incomplete install is recoverable.
- Do not hand-edit vendored skill content to hide failures. Fix the source, selection,
  or install links. Do not remove and reinstall a working source under a different
  name merely to make the update report green.

Use explicit names when installing a subset:

```sh
npx skills@latest add <owner/repo> --skill <name-a> --skill <name-b> --yes
```

Omit broad `--all` or all-agent selection. Preserve the repository's declared agent
types; pass explicit `--agent` values when configured. Do not use comma-separated
skill names. Re-sync or lock restoration is optional and only applies when the
installed CLI documents the relevant command.

## Restore the intended setup

An update refreshes installed skills; it does not add missing declared skills or
retire ones the repo no longer wants. If the repo has a setup manifest or documented
sync helper, use that source of truth and its supported check/apply modes. Do not
invent one or copy private configuration into this public skill.

Report a source collision rather than overwriting an installed skill from another
source. Preserve unrelated MCP servers, permissions, hooks, and local settings.
For generated instruction blocks, edit the canonical source; reject a stale source
that would replace newer generated content. Do not force a stale template through.

For workspace-managed links without a skills lock, refresh the source checkout
under the user's normal Git workflow and run the workspace's setup helper to
reconcile its selection. Do not replace those links with a second install scheme.

## Verify and report

Re-run the update or documented sync check once after a repair. Report per repo:
updated skills, resolved transient warnings, confirmed renames/removals, source
collisions, manifest drift, and unresolved failures. Describe the evidence for each
classification in plain English. Leave changes uncommitted and do not run app
quality checks as part of a skills-only request.

Related workflows: `wf-web-update-deps` includes this pass; `wf-web-create-pr`
reviews the resulting changes. User scope and overrides: $ARGUMENTS.
