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
TARGET=${TARGET:-main}
SLUG=$(git remote get-url origin | sed -E 's|.*[:/]([^/]+/[^/]+?)(\.git)?$|\1|')
```

**Never hardcode a branch name.** A fleet can mix `main`-only repos with `main` + `staging`
promotion flows; the symbolic ref is the only thing that knows which this is. `$ARGUMENTS` may
override the target.

Refuse to run outside a web repo — `package.json` with a framework dependency. For a Python or
infra repo, use the generic PR flow.

## Workflow

### Step 1–2 — Branches and status

Confirm a clean tree and that the branch is pushed. Confirm the target branch resolved above is
the one the author intends — state it, do not silently assume.

### Step 2.5 — Environment preflight

Abort on failure unless explicitly overridden:

1. `$PM install --frozen-lockfile` — the lockfile must match `package.json`. If it drifted,
   surface the diff and ask whether to commit the updated lockfile first.
2. If the repo ships a PWA, check for untracked artifacts that should have been committed:
   ```bash
   git ls-files --others --exclude-standard public/icons/ public/sw.mjs public/manifest.json \
     public/register-sw.js public/theme-init.js
   ```

### Step 3 — Analyze changes

Extract the web-specific signals from the diff. Each one is a surface with its own failure mode:

| Signal | Where | Why it matters |
|---|---|---|
| Manifest changed | `public/manifest.json` | `short_name` ≤ 12; `theme_color === background_color`; icon list aligned |
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
**regression** against the target branch (re-run there and compare) · a **new high/critical
advisory**.

**Warn but allow:** dead-code findings — surface them under "Known follow-ups". Override with
`--allow-knip`.

On a health regression, show the delta rather than the absolute: "score dropped 85 → 78 (3 new
errors, 2 new warnings). Block until fixed, or override with `--allow-doctor-regression`." An
absolute score with no baseline is not actionable.

### Step 3.6 — PWA installability check

Only if `manifest.json`, `sw.mjs`, or `public/icons/**` changed.

1. Parse the post-change manifest and assert `short_name.length ≤ 12`,
   `theme_color === background_color`, all 11 icon paths exist on disk, and the
   `"any maskable"` (72–384) / `"any"` (512) split holds.
2. **Service-worker version lines are build-injected, never committed.**
   - **Placeholders present in the committed file = correct. Do not block on them.**
   - **If the only change to `sw.mjs` is those three auto-generated lines** — flipped from
     placeholders to values, or churned between values — it is an accidentally-committed build
     artifact. Block: "discard with `git checkout -- public/sw.mjs`; the deploy build injects
     these." Override only if the author states the bump is intentional.
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
- Manifest: short_name "…" (≤12 ✅), theme_color === background_color ✅
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

If an issue reference applies, put it at the **top**, before the template.

> ### Two writing rules for the body
>
> - **Never write a bare `#N`.** GitHub autolinks it to whatever issue or PR carries that
>   number in this repo, which is almost never what you meant. Write "audit items 2 and 3", or
>   a full URL when you really do mean a specific issue.
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

Always include **at least one type label** — the dominant one for a mixed diff, defaulting to
`enhancement`. Stack secondary labels on top. Drop any that does not exist on the repo, silently
but with a note.

#### 5.4 — Assignee

Always `@me`. The author owns the PR until merge. Not flag-controlled.

### Step 6 — Preview and confirm

```
Source → Target:  <branch> → <target>
Title:            <title>
Assignee:         @me
Labels:           enhancement, dependencies
Body:             <preview>

Create this PR? (yes / modify / cancel)
```

### Step 7 — Create

```bash
gh pr create --repo "$SLUG" --base "$TARGET" --head "$(git branch --show-current)" \
  --title "$TITLE" --body "$BODY" --assignee "@me" \
  --label "enhancement" --label "dependencies"
```

One `--label` flag per label — a comma list breaks on labels containing spaces or emoji. If
creation fails with `could not add label: 'X' not found`, retry without it and warn. Never
`gh label create`.

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
