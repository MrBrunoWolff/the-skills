---
name: wf-web-resync
description: Preview and resynchronize selected local repositories with their remote branches. Use when the user requests local mirrors or post-merge cleanup; identify work that would be discarded and require concrete authorization for destructive changes.
---

# Resynchronize local repositories

Resolve membership through `[[wf-web-list-fleet]]`, including caller-owned workspace
manifests. Preserve explicit subsets; report missing members. This workflow can discard
local work. A routine update or checkout request does not authorize a hard reset.

## Preview the actual impact

Fetch and prune the selected remote, then inspect status, all worktrees, tracking
branches, and local/remote tips. Fetch changes remote-tracking refs; it does not change
a working tree. Resolve each default branch from repository instructions, remote HEAD,
or hosting metadata. Stop that repository if the branch cannot be resolved; do not
fall back to a guessed `main`.

Use `git clean -n -d` to preview untracked removals. Show dirty files, untracked
paths, local commits that would be discarded on remote-backed branches, local-only
branches, and branches in other worktrees. Include detached HEAD work and ongoing
merges/rebases. Keep ignored files; never use `git clean -x`.

`git cherry` compares individual patch IDs. It can help identify equivalent commits,
but it does not prove that a multi-commit branch was squash-merged. A `+` does not
prove unpublished content, and an old matching PR title does not prove a branch safe.
Cross-check PR merge metadata and commit tips, merge bases, and the relevant changes.
Classify uncertain work as uncertain. Do not promise “nothing lost” from patch IDs.

## Authorization

Present concrete repositories, files, branches, and tips affected before destructive
changes. Honor an existing instruction that explicitly authorizes this scope; otherwise
ask once for the proposed local reset/deletion. `--yes` or `--force` authorizes the
previewed local mirror operation when explicitly supplied by the caller. It does not
authorize changes to other worktrees or shared remotes.

Remote cleanup needs separate explicit authorization naming the branches, or a caller
request such as `--prune-remote` with concrete candidates reviewed. A merged PR alone
is insufficient: the branch may have newer commits or be a long-lived promotion branch.
Determine protected/long-lived branches from repository settings and instructions.
Never infer protection only from a fixed list of branch names.

## Apply the approved plan

Process each repository sequentially. Recheck tips and dirty state if time has passed;
a changed plan requires renewed authorization for the extra impact. Preserve branches
used by other worktrees and report them. Do not force-remove worktrees.

When a clean local branch is behind its remote, prefer `git merge --ff-only`. For an
explicitly authorized mirror reset, reset the selected branch to the verified remote
tip, set its upstream, and remove only the previewed untracked paths. Repoint other
approved remote-backed branches and delete only approved local-only branches. Stop on
unexpected checkout/reset errors rather than applying more destructive flags.

Follow the execution environment's approval rules. If a destructive action is denied,
do not retry it through another syntax or bulk command; report the remaining action.
An independently valid fast-forward is acceptable only if it discards no work.

For authorized remote deletions, recheck PR state and verify that the remote branch
still points at the reviewed tip. Use a lease against that exact tip when deleting;
a concurrent push must cause failure. Keep protected branches and newly advanced tips.
Do not push resets, commits, or tags as part of local resynchronization.

## Install and report

Install from the restored lockfile using the project's package manager and documented
frozen command (`npm ci`, Bun/pnpm frozen install, or the applicable Yarn mode).
Do not invent JavaScript setup for other stacks. Prune only when supported and
appropriate for this layout; a monorepo-wide proposed removal is a reason to inspect,
not permission to remove the installed tree.

Verify branch tips, upstream tracking, and status. Report per-repository results,
retained or uncertain work, remote branches left alone, and failed or denied actions.
Run `[[wf-web-check-quality]]` when requested or required by repository instructions.
Leave any new lockfile changes visible rather than silently treating them as clean.

User intent and overrides: $ARGUMENTS
