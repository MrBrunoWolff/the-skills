---
name: wf-web-code-reviewer
description: Reviewer charter plus interview-style grilling pattern for web repos — Next.js App Router + React 19 + React Compiler + Tailwind 4 + bun, optional PWA and password gate. Defines what is CRITICAL (blocks the PR), WARNING (asks the author), and SUGGESTION (informational), and how the review is conducted — one question at a time, walking the decision tree, recording ADRs as architectural decisions crystallise. Loaded by the wf-web-code-reviewer agent, which /wf-web-create-pr delegates to.
---

# wf-web Reviewer Charter

The rules a web diff is reviewed against, and the procedure for conducting the review.

Three severity tiers — **CRITICAL** (blocks the PR), **WARNING** (asks the author before
proceeding), **SUGGESTION** (informational). Cite `file:line` for every finding. Never flag
something you have not verified against the actual code.

Rules below reference tools by role, not by name where the repo might differ — resolve the
repo's actual script surface first (`[[wf-web-check-quality]]`). A rule about a gate the repo
does not have does not apply.

---

## Review style: GRILLING (interview, not report dump)

This reviewer does **not** dump a static report. It conducts the review as a focused interview:
walk down the diff one branch of the decision tree at a time, surface one finding at a time,
and **ask the author to defend or refine the choice** before moving on.

### Mechanics

1. **One question at a time.** Never dump 30 findings in one message. Each turn surfaces a
   single finding (or a tight cluster on the same decision) and asks a specific question. Wait
   for the answer.
2. **Recommend your answer.** State what you think the right call is, and why, *before* the
   author replies. They can agree, override, or refine — but they should never have to guess
   what you think.
3. **Walk the tree depth-first.** Resolve dependencies between decisions in order. If a new
   `'use client'` appears (C10), grill that first — if the component should be a Server
   Component, half the follow-up findings about hooks and effects evaporate.
4. **Explore the codebase instead of asking** when the answer is on disk. "Does the UI package
   already export a Button variant for this?" → grep it. Only ask when the answer is not
   recoverable from the repo.
5. **Sharpen language as you go.** When the author uses overloaded terms ("dashboard", "panel",
   "card"), pause and ask which one they mean. If the repo has a glossary, check against it; if
   not and the term keeps recurring, propose creating one — one line, not a spec dump.
6. **Cross-reference the code.** When the author states how something works, verify it against
   the diff. Contradictions get surfaced immediately: "You said the gate covers `/admin`, but
   the diff removed `/admin` from the allowlist — which is right?"
7. **Stress-test with concrete scenarios.** Do not just cite the rule; invent a scenario that
   exposes the failure. "If a user is mid-purchase and the SW cache is from three deploys ago,
   what loads?" beats "Service worker is stale."

### Recording decisions during the grilling

When a decision is **hard to reverse**, **surprising without context**, AND **the result of a
real trade-off** — all three — offer to record it as an ADR (one paragraph, in the repo's
`docs/adr/`). Otherwise skip it. Most findings produce no ADR; they are just fixes.

Decisions worth recording from a web PR are usually:

- Choosing a Server Component over a Client Component (or the reverse) for a non-obvious reason.
- Adopting a third-party dependency that becomes load-bearing.
- Breaking a documented convention with explicit sign-off.
- Loosening an auth gate deliberately for a specific public surface.
- Introducing a pattern that will spread (the first use of `cva`, say).

Create `docs/adr/` lazily on the first ADR. Do not pre-scaffold it.

### When the grilling ends

- All findings resolved (accepted, fixed in-session, or explicitly waived), **or**
- the author calls a halt ("ship it", "good enough"), **or**
- a CRITICAL is unresolvable in-session and blocks the PR.

Then emit the **Final report** (shape below). The command that invoked the reviewer consumes it.

---

## CRITICAL — block the PR

### Package manager / lockfile

| # | Rule | Why |
|---|---|---|
| C1 | A `package.json` script calling a package manager other than the one the repo's lockfile declares. | Mixed managers break CI and local dev, and produce a second lockfile. |
| C2 | A `packageManager` field naming a different manager than the lockfile. | Same. |
| C3 | Lockfile drift: `package.json` changed but the lockfile did not, or vice versa. | The lockfile becomes a lie and CI hits unreproducible installs. |
| C4 | A new top-level dependency that duplicates an existing one (`lodash` + `lodash-es`, `date-fns` + `dayjs`, `axios` + `ofetch`). | Bundle bloat and two ways to do one thing. |
| C5 | A change to `bunfig.toml` that removes or weakens `minimumReleaseAge` or `ignoreScripts`. | Those are the repo's supply-chain guards. Weakening one needs an explicit, recorded reason — not a drive-by. |

### PWA — only if the repo ships one

See `[[wf-web-pwa]]` for the full rules.

| # | Rule | Why |
|---|---|---|
| C6 | Manifest `short_name` longer than 12 characters. | Chrome truncates beyond that; the extra characters are a name nobody sees. |
| C7 | `theme_color !== background_color` in `manifest.json`. | The two must match the splash background; a mismatch is a visible flash on launch. |
| C8 | The `public/sw.mjs` diff contains **only** the auto-generated version lines (`APP_VERSION` / `BUILD_TIME` / `GIT_COMMIT` flipped from placeholders to values, or churned between values). | An accidentally-committed build artifact. The committed file must keep its placeholders; the build injects real values. Discard with `git checkout -- public/sw.mjs`. **Placeholders in the committed file are correct — never flag those as a defect.** |
| C9 | The icon set breaks the `"any maskable"` for 72–384 / `"any"` for 512 invariant. | Chrome's installability check depends on the exact split. |

### Auth gate — only if the repo has one

| # | Rule | Why |
|---|---|---|
| C10 | A change that **loosens** the cookie check, removes a route from the gated set, or weakens the static-asset predicate. | The gate is the only thing keeping preview deployments private. |
| C11 | A new public route that bypasses the gate without being in the allowlist. | Same. |
| C12 | The static-asset allowlist stops covering `/sw.mjs`, `/manifest.json`, `/icons/`, `/theme-init.js`, `/favicon.ico`. | Breaks service-worker registration and PWA installability — and presents as a manifest bug. |

### React / Next.js

| # | Rule | Why |
|---|---|---|
| C13 | A new `'use client'` component with **no actual interactivity** — no event handlers, no hooks, no browser-only API. | The App Router plus React Compiler defaults to RSC. A spurious `'use client'` ships JS that did not need to ship. |
| C14 | A client-only API (`localStorage`, `sessionStorage`, `document`, `window`, `navigator`) read at module top level without a `typeof window !== 'undefined'` guard, an effect, or an event handler. | SSR throws on first render. |
| C15 | `'use server'` used incorrectly — e.g. at module top level in a Client Component file. | Hard build error. |
| C16 | A Server Component importing a client-only module without a Client boundary. | Build error at best, hydration mismatch at worst. |
| C17 | `dangerouslySetInnerHTML` introduced without **both** a scoped lint disable and a one-line justification comment immediately above. | The few legitimate uses (theme-init script, splash CSS) are inline by design. Any new one needs sign-off. |

### Styling / theming

| # | Rule | Why |
|---|---|---|
| C18 | A new hex / rgb / hsl literal in JSX or CSS outside the token set in `globals.css` (`--color-*` under `[data-theme]`). | Tokens are the only thing that gets light *and* dark right. A raw literal breaks dark mode silently — it looks fine to whoever wrote it. |
| C19 | A font import not going through the framework's font pipeline (e.g. a raw `<link>` to a font CDN). | Loses self-hosting and CWV benefits and adds a render-blocking request. |

### Images

| # | Rule | Why |
|---|---|---|
| C20 | A raw `<img>` for a raster logo or photo where the framework's image component applies. Exceptions: SVG sprites, the inline splash logo, anything in `public/icons/`. | LCP regression. |

### Tests

| # | Rule | Why |
|---|---|---|
| C21 | Skipped tests (`test.skip`, `it.skip`, `describe.skip`) without a referenced issue in a comment immediately above. | Skipped-without-context tests rot, and nobody can tell whether they still matter. |
| C22 | The auth-gate test file deleted or stripped of its coverage. | Without it, the test script exits 0 on an empty file *and* a regression in the gate ships unnoticed. |

### Process

| # | Rule |
|---|---|
| C23 | The lint gate is non-zero. |
| C24 | The typecheck gate is non-zero. |
| C25 | Tests fail. |
| C26 | The health score **regressed** against the target branch (more errors, or a lower score). Regressions compound; gate them at the PR. |
| C27 | The advisory gate reports a new **high or critical** advisory introduced by this diff. |

---

## WARNING — surface and ask

| # | Rule | Why |
|---|---|---|
| W1 | A new component file over 200 LOC without a split rationale. | Past 200 LOC comprehension drops. A compound component or lots of pure JSX is a fine answer — but it should be an answer. |
| W2 | `useEffect` introduced where it runs only on mount and could be a server fetch or an initialiser. | RSC plus the React Compiler eliminates many old-React effects. Ask why. |
| W3 | Tailwind class strings over ~8 utilities on one element. | Extract to a `cva` variant or a component. |
| W4 | A new dependency when an existing one covers the same surface. Check `package.json` before flagging. | |
| W5 | Animation introduced with no `prefers-reduced-motion` handling. | Accessibility. |
| W6 | Form inputs with no associated `<label>`, `aria-label`, or `aria-labelledby`. | Accessibility. |
| W7 | A new `console.log` on a non-error path. | Production noise. |
| W8 | A new asset in `public/` over 200 KB with no optimisation note. | LCP cost. |
| W9 | New dead-code findings caused by this diff. | Surface for cleanup. |
| W10 | A build-only tool added to `dependencies` rather than `devDependencies`. | Bloat. |
| W11 | A new keyboard interaction with no visible focus style. | Accessibility. |
| W12 | `useState` for a value that never changes after first set. | Mis-modelled state; `const` or `useRef`. |
| W13 | A **phantom assertion** — see below. | It is not a weak test, it is zero test, and it is indistinguishable from a real one in review. |

### W13 — how to decide a phantom

A phantom assertion is a negative assertion (`not.toContain`, `not.toBeVisible`,
`toHaveCount(0)`, `toHaveText('')`) whose subject string or selector **does not exist on the
target branch**. It passes before the change, after the change, and after reverting the change.

Negative assertions are where a reviewer's attention is weakest and the author's is too, because
the green tick looks identical either way. The failure mode is not carelessness: it is writing
the assertion against the vocabulary of the branch being *written* rather than the branch being
*diffed* — a renamed string, a test hook copied from a sibling repo, a selector that was
proposed and never shipped.

**Triage by grep against the target branch. Decide by reverting the source.**

1. **Grep triage** — for every negative assertion in the diff, search the *target* branch:
   `git grep -n "<string>" <target> -- src/`
   Zero hits makes it a candidate, not a verdict. Rendered text is often composed at runtime
   (`` `${actual} of ${available} available` ``) or served from a fixture, so a literal-only
   grep produces false positives on both sides.
2. **Revert to decide** — restore the changed source to the target branch and re-run:
   `git checkout <target> -- src/ && <test command>`
   An assertion that does not fail under revert does not guard the change.
3. **Classify:**
   - **Phantom** — the string cannot be produced on either branch. **Delete it, or replace it
     with the string the target branch actually rendered.**
   - **Real and guarding** — fails under revert. Keep.
   - **Real but dormant** — the string exists and is reachable, but this fixture does not
     produce it on either branch. Keep, and say so in a comment: it guards a regression the
     current fixture cannot demonstrate.

**Caveat on step 2:** most runners stop a test at its first failing assertion, so one revert run
reports only the first failure per test. Read the *rendered output* in the failure message — it
is the target branch's actual DOM text, and it decides every remaining assertion in that test at
once. Where a fixture never reaches a failure, dump the rendered text directly rather than
inferring.

**Two structural defences worth requiring** once a phantom has been found in a file:

- **A positive control beside every negative.** `expect(row).not.toBeNull()` before asserting on
  `row`'s content; a `toHaveCount(1)` on a sibling that *should* match beside every
  `toHaveCount(0)`. A cell that renders empty and a selector that matches nothing are the same
  observation without one.
- **Assert the null-check first**, so a broken selector fails as "expected null not to be null"
  rather than as an opaque error further down.

**Scope note:** this is about test *credibility*, not coverage. It is a WARNING, not a CRITICAL
— a phantom does not break the build; it silently removes a guard the team believes it has.
Surface every instance with the target-branch string that should replace it.

---

## SUGGESTION — endorse and note

| # | Rule |
|---|---|
| S1 | A Server Component replacing a Client Component — endorse. |
| S2 | View Transitions or CSS scroll-driven animations used where appropriate (check `modern-web-guidance` for Baseline status). |
| S3 | `cva` variants replacing boolean prop proliferation. |
| S4 | New tests exercising the auth gate end to end. |
| S5 | An oversized component split. |
| S6 | A raster image migrated to WebP/AVIF through the framework image component. |
| S7 | A new design token added to `globals.css` *and* used in the same diff. |
| S8 | A `useEffect` removed in favour of a server pre-render or compiler memoisation. |

---

## Mandatory cross-checks for any UI / CSS / client-JS change

1. State explicitly whether `modern-web-guidance` was consulted, and for which Web Platform APIs
   (View Transitions, anchor positioning, `:has()`, container queries, scroll-driven animations,
   `content-visibility`, Fetch Priority). Name the API and confirm its Baseline status was
   checked.
2. Flag obsolete patterns superseded by Baseline — a JS focus trap where `<dialog>` would do, a
   hand-rolled accordion where `<details>` would do, manual positioning math where CSS anchor
   positioning would do.
3. Verify **light and dark** both work, by confirming every introduced colour references a
   token.
4. Note whether the change is reachable behind the auth gate, and whether it is tested there.

---

## Final report shape

Emitted once, after the grilling concludes. It summarises what came up — it is **not** the start
of the review.

```
# Web Review — <repo> — <branch> → <target>

## Verdict
<BLOCK | ASK | PROCEED>

## Critical findings
- [C<N>] <file>:<line> — <one line>. <fixed-in-session | unresolved | waived-with-reason>.

## Warnings
- [W<N>] <file>:<line> — <one line>. <resolution>.

## Suggestions
- [S<N>] <file>:<line> — <note>.

## Decisions recorded
- ADR-<NNNN>: <title> — <the call made.>     (or "None")

## Cross-checks
- modern-web-guidance: <consulted? for which APIs?>
- light/dark theme: <verified?>
- behind auth gate: <yes/no>

## Grilling log
<5–10 lines: what was debated, accepted, rejected. Helps the next reader see the trade-offs.>
```

The invoking command maps the verdict to: `BLOCK` → refuse to create the PR · `ASK` → present
warnings and wait for go/no-go · `PROCEED` → create it, embedding the suggestions and grilling
log in the body.

---

## Agentic readiness (INFO — static signals only)

When the diff touches routes or actions, sanity-check the *static* agentic signals (full rubric
in `[[wf-web-agentic]]`). These are INFO — surface as Suggestions, never block:

- **WebMCP:** if the change adds a significant user action (form, search, CRUD), note — do not
  require — that exposing it as a WebMCP tool would help agents.
- **`/llms.txt`:** not expected. Only if a *public* app deliberately added or changed one,
  confirm the static-asset allowlist covers it. Do not suggest adding one.

Agent-centric a11y is **not** a separate check here — it is the a11y dimension and the health
gate. The **live** Lighthouse Agentic Browsing audit is runtime and belongs to the PR command,
not the reviewer.

## What the reviewer does NOT check

To stay fast and focused:

- Lint, dead-code, typecheck, tests, health — **already run** by the PR command before the
  reviewer is invoked. The reviewer sees the *results* and uses them as inputs (a health
  regression becomes C26). It does not re-run them.
- Deploy-preview availability, Lighthouse scores, cross-browser visual differences — runtime,
  not code review.

If any of those results indicate failure, the PR command blocks **before** invoking the
reviewer.

## Cross-references

- `[[wf-web-create]]` — the skeleton this charter validates against
- `[[wf-web-pwa]]` — the PWA rules behind C6–C9
- `[[wf-web-check-quality]]` — the gates whose results feed C23–C27
- `[[wf-web-create-pr]]` — the command that delegates here
