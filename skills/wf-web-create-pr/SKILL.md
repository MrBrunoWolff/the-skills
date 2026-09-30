---
name: wf-web-create-pr
description: Create a PR for a web repo — runs the repo's quality suite as a blocking gate, audits the diff for PWA and auth-gate regressions, surfaces agentic readiness as INFO, then delegates to an interview-style web reviewer before opening the PR with derived labels and assignee. Detects the target branch, remote slug and deploy platform rather than assuming them.
---

# wf-web-create-pr — create a PR for a web repo

The web-flavoured PR flow: quality gate → diff audit → reviewer → PR. Everything about *this*
repo — target branch, remote slug, package manager, deploy platform, which gates exist — is
**detected**, per the repo profile in `[[wf-web-list-fleet]]`.

## Preflight

```bash
# package manager from the lockfile — never fall back to another
if   [ -f bun.lock ]; then PM=bun; elif [ -f pnpm-lock.yaml ]; then PM=pnpm
elif [ -f package-lock.json ]; then PM=npm; elif [ -f yarn.lock ]; then PM=yarn
else echo "No lockfile."; exit 1; fi
command -v "$PM" >/dev/null 2>&1 || { echo "ERROR: $PM required."; exit 1; }

TARGET=${TARGET:-$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')}
SLUG=$(git remote get-url origin | sed -E 's|.*[:/]([^/]+/[^/]+?)(\.git)?$|\1|')
```

Resolve the target from the explicit request, repository instructions, or the
remote default branch. If `origin/HEAD` is missing, query
`gh repo view --json defaultBranchRef` or ask; do not silently assume `main`.
For a promotion between long-lived branches, use the repository's documented
release flow. Do not invent a staging/production branch pair or release counter.

Use the web checks for repositories with a detected web stack. For libraries,
documentation, Python, or infrastructure, keep the Git, writing, and review flow
and run their own documented checks. Skip web-only checks that do not apply.

## Writing and PR conventions

- Lead with the problem and resulting behavior. Describe the final diff for a
  reader who has not seen the conversation. Keep simple changes to a few sentences.
- Use plain English and concrete verbs. Avoid slogans, repeated summaries,
  decorative emoji, and claims stronger than the evidence.
- Keep titles stable: describe the change, with dependency versions in the body.
  A release counter or version that is the subject of the work may stay in a title.
- Omit AI-attribution footers and AI co-author trailers unless the user requests
  them. Preserve actual human authorship and existing repository requirements.
- State the merge method immediately after the summary. Use a short NOTE for a
  normal squash merge, or CAUTION when the documented flow requires preserving
  history. Confirm enabled merge methods; do not change protection rules here.
- Use at most one GitHub alert of each type. Keep temporary run status out of
  the durable description. Remove a resolved warning rather than narrating it.
- Preserve template headings and order. Add only sections relevant to the change.
  Mark checks as passed, failed, or not run; never present planned checks as results.
- Use full links for cross-repository references. A bare `#N` is appropriate only
  when it intentionally refers to that numbered issue or PR in this repository.

## Workflow

### Step 1–2 — Branches and status

Read Git status, the source branch, the target, and the diff. Preserve unrelated
working-tree changes and stage explicit paths only. Do not require an unrelated
change to be discarded before creating this PR. State the source and target.

For regular PRs, bring the feature branch up to date using the repository's
documented method. For a promotion, do not merge the destination back into the
source just to make their histories match. Never merge the PR as part of creation.

### Step 2.5 — Environment preflight

Abort on failure unless explicitly overridden:

1. Use the frozen-install procedure in `wf-web-check-quality` once. It selects
   `npm ci`, Yarn's version-appropriate mode, or the manager's frozen flag.
   If the install fails, report it before proceeding to checks that require it.
2. If the repo ships a PWA, check for untracked artifacts that should have been committed:
   ```bash
   git ls-files --others --exclude-standard public/icons/ public/sw.mjs public/manifest.json \
     public/register-sw.js public/theme-init.js
   ```

### Step 3 — Analyze changes

Extract the web-specific signals from the diff. Each one is a surface with its own failure mode:

| Signal | Where | Why it matters |
|---|---|---|
| Manifest changed | `public/manifest.json` | name usable on target devices; splash colors intentional; icon list aligned |
| Service worker changed | `public/sw.mjs` | The committed copy must **keep** its placeholders. A diff of only the three version lines is a build artifact — see Step 3.6 |
| Icon set changed | `public/icons/*.png` | Must stay the 8 PWA + 3 favicon set |
| Auth path touched | the gate's lib, proxy/middleware, `/auth` routes | Highest-risk surface in the repo |
| Splash / theme-init touched | `layout.tsx` | Affects FOUC on every route |
| Theme tokens touched | `globals.css` under `[data-theme]` | Affects every page; verify light **and** dark |
| Shared UI package bumped | `package.json` | Confirm the consumer is on the intended version |
| Supply-chain config touched | `bunfig.toml` | A weakened guard needs a recorded reason |

### Step 3.5 — Quality gate (BLOCKING)

Run the repo's own suite via `[[wf-web-check-quality]]` — which resolves the script surface
rather than assuming it. If the repo has a composite `check` script, that plus `test`, `doctor`
and `audit` is the whole gate; do not also re-run `check`'s constituents.

Collect **all** exit codes. **Block on:** lint · typecheck · tests · a health-score
**regression** against the target branch (compare in an isolated checkout) · a **new high/critical
advisory**.

**Warn but allow:** dead-code findings — surface them under "Known follow-ups". Override with
`--allow-knip`.

On a health regression, show the delta rather than the absolute: "score dropped 85 → 78 (3 new
errors, 2 new warnings). Block until fixed, or override with `--allow-doctor-regression`." An
absolute score with no baseline is not actionable.

### Step 3.6 — PWA installability check

Only if `manifest.json`, `sw.mjs`, or `public/icons/**` changed.

1. Validate names and intended splash colors, plus 192px and 512px ordinary icons.
   Check maskable artwork against its safe zone when present. Twelve characters
   and the eight-icon purpose split are starter conventions, not validity rules.
2. **Service-worker version lines are build-injected, never committed.**
   - **Placeholders present in the committed file = correct. Do not block on them.**
   - **If the only change to `sw.mjs` is those three auto-generated lines** — flipped from
     placeholders to values, or churned between values — it is an accidentally-committed build
     artifact in a repo that uses this injection scheme. Report the specific
     generated lines. Restore only those lines while preserving any authored SW
     edits; do not discard the entire working file. An intentional version bump
     should be recorded as such.
   - **Real SW logic changes** (cache lists, fetch strategy) are reviewed normally.
3. Verify the static-asset allowlist still covers `/sw.mjs`, `/manifest.json`, `/icons/`,
   `/theme-init.js`, `/favicon.ico`. If the proxy/middleware changed, re-check it did not
   regress.

### Step 3.7 — Agentic readiness (INFO, never blocking)

Advisory only — the Lighthouse Agentic Browsing category is experimental. See
`[[wf-web-agentic]]`.

1. **Static (cheap, always):** agent-centric a11y is already the a11y gate — confirm no
   regression, do not duplicate the check. `llms.txt` is not expected; only if a *public* app
   deliberately changed one, confirm the allowlist covers it.
2. **Live (optional, when there is a UI change and a preview is up):** run a Lighthouse audit on
   the preview via `chrome-devtools-mcp`; report the Agentic Browsing pass-ratio and CLS.
   Skipping is fine — record "not run" rather than omitting the line.

### Step 4 — Code review (BLOCKING, interview-style)

Delegate to the **`wf-web-code-reviewer`** agent. It loads its own charter
(`[[wf-web-code-reviewer]]`), the skeleton (`[[wf-web-create]]`) and the PWA rules
(`[[wf-web-pwa]]`) — do **not** inline the rules here.

> If that agent is not installed (agents are a manual install — see the repo README), run the
> review inline from the charter instead, keeping the same one-question-at-a-time procedure.
> Say which mode you used.

**Conversational, not one-shot.** The reviewer grills: one finding at a time, recommended answer
stated up front. Surface its questions to the user verbatim and relay answers back to the *same*
agent via `SendMessage` rather than spawning a new one — a fresh agent loses the thread.

Pass it: the unified diff (`git diff $TARGET...HEAD`), target and source branches, the issue
reference if any, the changed-file list, the **pre-computed quality signals from Step 3.5**
(it must not re-run them), the Step 3.6 PWA results, and the Step 3 signal list.

**Verdict gates:** `BLOCK` → refuse to create the PR, name the unresolved CRITICALs, offer to
keep grilling · `ASK` → present the WARNINGs, wait for explicit go/no-go · `PROCEED` → continue,
embedding the suggestions and grilling log in the body.

If the report lists ADRs under "Decisions recorded", verify the files were actually created
under `docs/adr/` before opening the PR.

### Step 5 — Generate PR content

#### 5.1 — Detect the repo's PR template (MANDATORY)

Precedence: `.github/PULL_REQUEST_TEMPLATE.md` → `.github/pull_request_template.md` →
`docs/pull_request_template.md` → `PULL_REQUEST_TEMPLATE.md`.

If one exists, **the body MUST follow its section order and headings.** Treat it as the
contract: do not reorder, rename, or omit sections except per its own removal instructions. If
a section is genuinely empty, follow its removal guidance; otherwise keep the heading and write
at least one bullet.

A reasonable default when the repo has none:

```markdown
## Summary
<!-- 1–3 sentences on what this PR does. -->

## Features
## Fixes
## Maintenance
## Dependencies
<!-- Remove any section that does not apply. -->
```

#### 5.2 — Augmentation sections (appended after the template)

```markdown
## Quality
- lint ✅   format ✅   knip ⚠️ N unused (see follow-ups)
- typecheck ✅   test ✅ (M tests)   doctor ✅ score N (Δ +/-)   audit ✅

## PWA (only if manifest/sw/icons touched)
- Manifest: name "…", splash colors verified
- Service worker: placeholders retained ✅ — no bare version-line churn
- Icons: 11/11 present ✅

## Preview
- Deploy preview URL (the platform posts it — leave the line so the reviewer checks it)

## Agentic (INFO — only if a UI change and a preview is up)
- Agentic Browsing pass-ratio: N/M — or "not run"
- CLS on primary route: N — or "not run"

## Test plan
- [ ] Visit `/` on the preview: light + dark, mobile + desktop
- [ ] Hard-refresh, confirm no FOUC
- [ ] If the auth gate was touched: confirm it redirects, accepts, and rejects
- [ ] If PWA was touched: install in Chrome and verify icon + name
- [ ] [change-specific steps]

## Known follow-ups
```

Put issue references in the template's designated section or alongside the
summary. Keep the merge-method alert immediately after the summary.

> ### Two writing rules for the body
>
> - Write "audit items 2 and 3" for numbered findings. Use `#N` only for an
>   intentional reference to an issue or PR in this repository.
> - **Do not add a co-author trailer** to commits or PRs on personal repos unless the user asks
>   for one. If the session's attribution guidance says otherwise, that guidance wins — but the
>   default here is none.

#### 5.3 — Labels

Derive from the diff and the conventional-commit type, then **filter against the repo's actual
labels** (`gh label list`). Never invent or auto-create one.

| Trigger | Label |
|---|---|
| `feat:` / new user-facing capability | `enhancement` |
| `fix:` / bug-fix-only diff | `bug` |
| `refactor:` | `refactor` |
| `chore:` | `chore` |
| `docs:` / only docs changed | `documentation` |
| `test:` / only tests changed | `test` |
| `.github/workflows/**` touched | `ci/cd` |
| dependency section changed, no other code | `dependencies` |
| auth / security-sensitive file touched | the repo's security label |
| a promotion PR between long-lived branches | the repo's release label |

Use the dominant type label and applicable secondary labels that already exist
in the repository. Report unavailable labels; a repository without a matching
label does not require inventing one or substituting `enhancement`.

#### 5.4 — Assignee

Assign `@me` unless the user or repository specifies another owner. Apply the
assignee on creation and verify it afterward.

### Step 6 — Review the concrete draft

```
Source → Target:  <branch> → <target>
Title:            <title>
Assignee:         @me
Labels:           enhancement, dependencies
Body:             <preview>

```

If the user already requested PR creation and all required decisions are
resolved, proceed. Ask only for missing choices or explicit waivers needed by
the quality/review gates. Do not add a second permission step to an authorized
request.

### Step 7 — Create

```bash
gh pr create --repo "$SLUG" --base "$TARGET" --head "$(git branch --show-current)" \
  --title "$TITLE" --body "Description pending." --assignee "@me" \
  --label "enhancement" --label "dependencies"
gh pr edit "$PR_NUMBER" --repo "$SLUG" --body-file "$PR_BODY_FILE"
gh pr view "$PR_NUMBER" --repo "$SLUG" --json url,assignees,labels,body
```

Write the reviewed description to a temporary file with real newlines. Capture
the created PR number before editing. Pass one `--label` per label from the
computed set; the labels above are examples. If editing fails, report the
existing PR and retry that edit, not creation. Before retrying a failed create,
check whether the PR already exists. Do not create labels here.

### Step 8 — Report

PR URL and number, the assignee and labels applied, a reminder to watch for the deploy preview
the platform posts on the PR, and whoever `.github/CODEOWNERS` puts on the touched paths.

## Flags / arguments

| Token | Effect |
|---|---|
| `<target-branch>` | Override the detected target |
| `--allow-knip` | Dead-code findings become info |
| `--allow-doctor-regression` | Allow a health-score regression (acknowledged) |
| `--no-doctor` | Skip the health step |
| `--label <name>` / `--no-label <name>` | Adjust the derived label set (repeatable) |

`--assignee @me` is always applied.

## Cross-references

- `[[wf-web-check-quality]]` — the gate in Step 3.5
- `[[wf-web-code-reviewer]]` — the charter the reviewer loads
- `[[wf-web-pwa]]` — what Step 3.6 validates against
- `[[wf-web-agentic]]` — the Step 3.7 INFO check
- `[[wf-web-list-fleet]]` — the repo profile this detects from

User intent / overrides: $ARGUMENTS
