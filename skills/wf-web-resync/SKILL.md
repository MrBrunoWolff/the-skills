---
name: wf-web-resync
description: Git resync across a fleet of repos so local mirrors remote — fetch+prune, checkout each repo's own default branch, hard-reset to its remote tip, clean untracked, mirror every remote-backed branch, delete local-only branches, flag branches left stranded on the remote after their PR merged, then reinstall deps to match the lockfile. Destructive; previews and confirms before mutating.
---

# wf-web-resync — make local repos mirror remote

Makes each repo a faithful reflection of its remote: every local branch that still exists on the
remote is mirrored to the remote tip, and every **local-only** branch (merged or abandoned
feature branches) is deleted. Use it to start fresh on a machine after the work was merged
elsewhere.

**This is destructive.** It throws away uncommitted changes and deletes local-only branches. It
previews everything first and asks before touching anything.

It also **reports** branches still sitting on the remote whose PR already merged (Step 1c).
Those are residue: the mirror rule below recreates them locally on every future resync, so they
never age out on their own. Deleting them touches the shared remote, so it is opt-in behind its
own gate and its own flag — never folded into `--yes`.

## The fleet

Resolved per `[[wf-web-list-fleet]]`: `$WF_ROOT`, or `wf-fleet.json`, or the parent directory of
the current repo. A directory is in scope if it has both `.git/` and `package.json`. Repo-name
tokens in `$ARGUMENTS` scope the run to a subset.

**Each repo's default branch is detected, never assumed:**

```bash
DEFAULT=$(git -C "$repo" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
DEFAULT=${DEFAULT:-main}
```

A fleet can mix `main`-only repos with `main` + `staging` promotion flows. Hardcoding either one
resets the wrong branch in half the fleet — which looks exactly like data loss.

If a repo is missing from disk, skip it silently. Do not touch any other directory.

## Step 1 — Dry-run preview (NO MUTATIONS)

Per repo, collect **without changing anything**:

```bash
git -C "$repo" fetch --prune origin          # safe; updates remote refs only
git -C "$repo" branch --show-current
git -C "$repo" status --short | wc -l        # dirty file count
git -C "$repo" clean -n -fd                  # what untracked files WOULD be removed
for b in $(git -C "$repo" for-each-ref --format='%(refname:short)' refs/heads/ | grep -vx "$DEFAULT"); do
  if git -C "$repo" show-ref --verify --quiet "refs/remotes/origin/$b"; then
    echo "keep+mirror $b"                    # exists on remote → kept, reset to origin/$b
  else
    echo "delete $b"                         # local-only → WOULD be deleted
  fi
done
```

Print one consolidated table:

| Repo | Default branch | Current branch | Dirty files | Local-only to delete | Untracked to clean |

Call out kept-and-mirrored branches separately so the user sees they survive.

### Step 1b — Classify local-only branches by CONTENT, not ancestry (MANDATORY)

**Never report a local-only branch as carrying unpushed work based on
`rev-list --count origin/<default>..$b`.** Squash-merging a PR leaves the branch with a local
commit SHA that never appears upstream, so ancestry-based counting flags *every* merged branch
as "1 unpushed commit" — a false positive that turns a routine resync into a false data-loss
alarm, and trains the user to click through the gate.

Use `git cherry`, which compares **patch-ids** (content):

```bash
# '-' = patch already upstream (squash-merged) → safe to delete
# '+' = genuinely not upstream                → real unmerged work, escalate
git -C "$repo" cherry "origin/$DEFAULT" "$b"
```

Reading the result:

- **All lines `-`** → merged. Say so plainly ("merged upstream, safe to delete"). Do **not**
  warn about data loss.
- **Any line `+`** → real unmerged content. Before escalating, read
  `git diff origin/$DEFAULT..$b`: a `+` on a branch that simply predates a later upstream commit
  shows the *branch's older version* of a file — deleting it loses nothing, and keeping it would
  risk reintroducing a fixed bug. Escalate only when the branch holds content that exists
  nowhere upstream.
- **Ignore `git diff --shortstat` as a merge signal.** That diff is bidirectional: a large file
  count usually means the branch lags the default branch, not that it carries work. It answers
  "how far behind", never "is it merged".

Cross-check before reporting — `git log --oneline origin/$DEFAULT` normally shows the squash
commit matching the branch's subject line.

Word the preview accordingly. *"7 local-only branches, all merged upstream — deleting them loses
nothing"* is the common case. Reserve data-loss language for branches that actually earned a `+`.

### Step 1c — Detect stray branches, local AND remote

Step 1b answers "is this *local* branch safe to delete". It says nothing about branches lingering
**on the remote** after their PR merged — and because Step 3's rule is "exists on origin → keep",
every one is faithfully recreated locally on each future resync. They never age out; the fleet
accumulates them.

Classify with `gh`, never by guessing from the branch name. Derive the repo slug from the remote:

```bash
slug=$(git -C "$repo" remote get-url origin | sed -E 's|.*[:/]([^/]+/[^/]+?)(\.git)?$|\1|')
protected=$(printf '%s|%s' "$DEFAULT" "$(git -C "$repo" config --get wf.protectedBranches || echo 'prod|staging|release')")
for b in $(git -C "$repo" for-each-ref --format='%(refname:short)' refs/remotes/origin/ \
           | sed 's|^origin/||' | grep -Evx "HEAD|$protected"); do
  state=$(gh pr list --repo "$slug" --head "$b" --state all --limit 1 \
          --json number,state --jq '.[0] | "PR \(.number) \(.state)"')
  echo "$b -> ${state:-no PR}"
done
```

Read it as:

- **`MERGED`** → stray. Offer to delete (remote plus local mirror).
- **`OPEN`** → live work. Keep. Never offer.
- **`CLOSED`** → abandoned *without* merging. Do **not** lump these in with merged ones — the
  content exists nowhere upstream. List them separately and let the user decide one at a time.
- **no PR** → possibly an in-flight push from another machine. Report; do not offer to delete.

> **The `grep -Evx` guard is load-bearing — do not remove it.** In a promotion flow, PRs merge
> *from* the long-lived branch, so `staging` shows as `MERGED` on every repo. Deleting it on
> that basis would be catastrophic. Long-lived branches are never candidates, whatever `gh`
> reports.

Add both findings to the preview table as their own columns.

## Step 2 — Confirmation gate

This step **discards uncommitted work and deletes local-only branches**. Ask once via
`AskUserQuestion`, summarising total impact ("3 repos dirty, 7 local-only branches will be
deleted; `prod` kept and mirrored").

State the impact using the **Step 1b verdict**, not raw commit counts. When every local-only
branch came back all-`-`, the honest summary is *"7 local-only branches, all squash-merged —
nothing lost"*. Overstating this is how a gate stops being read.

`--yes` / `--force` in `$ARGUMENTS` skips this gate. If the user declines, stop — nothing has
been mutated.

### Step 2b — Second gate, for stray *remote* branches only

Deleting a branch on `origin` is **outward-facing**: it affects every clone, not just this
machine, and it is the one action here that cannot be undone from local state. It gets its own
`AskUserQuestion`, asked only when Step 1c found `MERGED` strays, and only *after* the main
resync is approved.

- Ask it separately. Never bundle it into the Step 2 summary.
- List the branches by name with their PR numbers, so the user approves a specific set, not a
  category.
- **`--yes` / `--force` do not cover this gate.** Remote deletion requires the explicit
  `--prune-remote` flag; without it, an unattended run reports strays and deletes nothing.
- Default to *no*. A stray remote branch costs clutter; a wrongly deleted one costs work.

If declined, finish the rest of the resync and list the strays in the report.

## Step 3 — Execute (per repo, after approval)

```bash
git -C "$repo" checkout "$DEFAULT"
git -C "$repo" reset --hard "origin/$DEFAULT"
git -C "$repo" branch --set-upstream-to="origin/$DEFAULT" "$DEFAULT"
git -C "$repo" clean -fd                     # untracked only — NOT -x
for b in $(git -C "$repo" for-each-ref --format='%(refname:short)' refs/heads/ | grep -vx "$DEFAULT"); do
  if git -C "$repo" show-ref --verify --quiet "refs/remotes/origin/$b"; then
    git -C "$repo" branch -f "$b" "origin/$b"
    git -C "$repo" branch --set-upstream-to="origin/$b" "$b"
  else
    git -C "$repo" branch -D "$b"
  fi
done
```

`git branch -f <b> origin/<b>` repoints a branch you are not on to the remote tip without
checking it out.

**Why the `--set-upstream-to` lines are mandatory:** `checkout` on an already-existing local
branch never fires git's DWIM auto-tracking, and `reset --hard` / `branch -f` only move the
branch pointer — none of them write `branch.<b>.remote` / `.merge`. Without them a bare
`git pull` fails with *"There is no tracking information for the current branch."* Setting
upstream explicitly is idempotent — a no-op when tracking is already correct.

Edge cases:

- **Detached HEAD** → note it, still checkout + reset.
- **Already clean** → the reset is a no-op. Fine.
- **Never `git push`** — with exactly one exception, Step 3b, gated twice (Step 2b plus
  `--prune-remote`). Never push a branch, a tag, or a reset default branch.
- **Never `git clean -x`** — it wipes `node_modules` / build caches and forces slow reinstalls.
- **A branch checked out in another worktree cannot be deleted.** `git branch -D` fails with
  *"used by worktree at …"*. Never pass `--force` to `git worktree remove` to get around it —
  inspect that worktree for uncommitted work first, report what you find, and let the user
  choose. Skip that one branch and finish every other repo.

### Working with the permission classifier

The pseudo-code above is the *intent*; do not paste it as one shell command.

**One, a `for` loop over repos containing destructive verbs.** A single command that resets and
deletes across a whole fleet reads as bulk-destructive and is refused wholesale. Issue one
command per repo. Independent repos can go in a single message as parallel `Bash` calls — that
is not a workaround, just a smaller blast radius per call.

**Two, the hard reset**, frequently denied even for one repo. When that happens, consult the
Step 1 numbers. If the repo is 0 commits ahead of the remote and has 0 dirty files — the normal
case after a clean preview — a fast-forward merge reaches an identical end state, because there
is nothing for the reset to discard that the fast-forward would not also reach. It is strictly
safer: on a repo that turns out to be ahead or dirty it fails loudly rather than silently
discarding. **Only substitute it under those two preconditions**; otherwise stop and ask rather
than forcing.

The classifier is **nondeterministic** — the same deletion may be allowed in seven repos and
denied in the eighth. Retry a denial once; if it persists, finish every other repo, then hand
the user the exact leftover command. Never leave a repo half-done without flagging it.

### Step 3b — Delete stray remote branches (ONLY with Step 2b approval + `--prune-remote`)

Only for branches Step 1c classified `MERGED` and the user named. One branch per command — never
a loop, never a batch.

**Re-verify immediately before each deletion** — the PR state was read during the preview and
the remote may have moved:

```bash
gh pr list --repo "$slug" --head "$b" --state all --limit 1 --json state --jq '.[0].state'
git -C "$repo" push origin --delete "$b"
git -C "$repo" branch -D "$b"
```

If it no longer says `MERGED`, **stop and report** rather than deleting. Never `--force` here; a
plain `--delete` that fails is telling you something changed.

## Step 4 — Re-sync deps to the reset lockfile

After the hard reset, `node_modules` may be stale from the previous branch. Reinstall **frozen**
so the tree matches the committed lockfile, then prune:

```bash
$PM install --frozen-lockfile     # npm: npm ci
bun prune                         # or pnpm prune
```

`--frozen-lockfile` honours the lockfile but never *removes* a package that dropped out of it,
and a resync is exactly where orphans pile up — you have just hard-reset across branches whose
dependency sets differ.

> Skip prune on a repo where it mis-reports (a workspace monorepo proposing to remove most of
> the installed tree while `--frozen-lockfile` exits 0 on the same tree). That is a tooling bug,
> not drift. Do not act on it and do not hand-edit the lockfile.

Run these one repo at a time, in the foreground, to avoid cross-repo collisions.

## Step 5 — Report

| Repo | Reset to (SHA) | Branches deleted | Stray remote | Install |

The **Stray remote** column lists branches whose PR merged but which still exist on `origin` —
deleted if Step 2b was approved, otherwise listed as outstanding. Say which; a silent column
reads as "handled".

Verify before reporting: every repo on its default branch, 0 dirty,
`rev-list --left-right --count <default>...origin/<default>` = `0/0`, upstream tracking set on
each surviving branch.

Note repos skipped, fetch/install failures, and — explicitly — any repo where a step was denied
by the classifier, with the command to run manually. State plainly whether deleted branches were
merged: if Step 1b came back all-`-`, say "all squash-merged, nothing lost" rather than leaving
the deletion sounding lossy.

## Flags / arguments

| Token | Effect |
|---|---|
| `--yes` / `--force` | Skip the Step 2 gate. **Does not** authorise remote deletion. |
| `--prune-remote` | Allow Step 3b. Still asks at Step 2b unless combined with `--yes`. |
| repo-name tokens | Scope to a subset. Default = the whole fleet. |

## Cross-references

- `[[wf-web-list-fleet]]` — fleet resolution and the repo profile
- `[[wf-web-check-quality]]` — run after a resync to confirm the tree is green

User intent / overrides: $ARGUMENTS
