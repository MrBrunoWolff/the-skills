---
name: wf-web-agentic
description: Agentic readiness for web apps — making an app observable, debuggable and usable by AI browser agents. Covers (1) Chrome DevTools for Agents via the chrome-devtools-mcp server (Lighthouse audits, performance traces, accessibility tree, device emulation, WebMCP tool list/invoke, shared browser context) as the way to verify and debug a running app, and (2) the Lighthouse "Agentic Browsing" experimental category — what it scores (WebMCP tool registration, agent-centric accessibility, CLS stability, llms.txt presence) and the concrete app changes that move it. Sources - https://developer.chrome.com/blog/devtools-for-agents-v1 and https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring.
---

# wf-web-agentic — agentic readiness for a web app

Two related ideas, one goal: a web app should be **easy for an AI agent to drive, verify and
debug** — both the coding agent building it and any browser agent a user points at the live
site.

- **Tooling (how we verify):** Chrome DevTools for Agents, delivered as `chrome-devtools-mcp`.
- **Target (what we build toward):** the Lighthouse *Agentic Browsing* experimental category.

Source of truth — read these before changing this file, since both move:

- DevTools for Agents — https://developer.chrome.com/blog/devtools-for-agents-v1
- Lighthouse Agentic Browsing scoring — https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring
- Agents docs — https://developer.chrome.com/docs/devtools/agents
- Source — https://github.com/ChromeDevTools/chrome-devtools-mcp

## 1. Chrome DevTools for Agents (chrome-devtools-mcp)

`chrome-devtools-mcp` gives a coding agent the visibility to verify, debug and optimize against
a **live** browser, instead of inferring from source or a sandboxed headless run.

Install (Claude Code):

```
/plugin marketplace add ChromeDevTools/chrome-devtools-mcp
/plugin install chrome-devtools-mcp@chrome-devtools-plugins
```

Or as a plain MCP server: `npx chrome-devtools-mcp@latest`. (Gemini CLI:
`gemini extensions install --auto-update https://github.com/ChromeDevTools/chrome-devtools-mcp`.)

**Capabilities** — reach for these via the MCP tools rather than guessing:

| Capability | Use it to |
|---|---|
| Lighthouse audits | Run accessibility / SEO / best-practices / performance **and the Agentic Browsing category** against a live URL (a deploy preview). |
| Performance traces | Capture a trace, read CWV (LCP, INP, **CLS**), find the slow work behind a regression. |
| Accessibility tree | Read the page the way an agent sees it — verify names, labels and roles instead of inferring from the DOM. |
| Device & network emulation | Resize, throttle CPU/network, simulate geolocation; reproduce mobile-only behaviour. |
| WebMCP tools | List, invoke and validate the page's declared WebMCP tools. |
| Shared browser context | Drive an existing authenticated session (past a login or password gate) instead of a fresh sandbox. |

**When to reach for it:** verifying a change actually works on a deployed preview, debugging a
CWV/CLS regression, confirming the accessibility tree exposes a control, or auditing agentic
readiness before a PR. Prefer it over headless one-shots when you need to *observe* a running
app. (`agent-browser` remains the right tool for scripted navigation and scraping;
DevTools-MCP is for inspect / audit / trace.)

> **A note on scores you cannot move.** Before attributing a Best-Practices or performance
> ceiling to your own code, check what the *deployed* page actually loads. A CDN or bot-
> protection layer that injects its own challenge script executes on the main thread and is
> counted against your page — it can cap a category and simultaneously be the single largest
> main-thread cost, with nothing in the repo to fix. Audit a preview with that layer off, or
> compare against a local production build, before optimizing something that is not yours.

## 2. Lighthouse "Agentic Browsing" category (the target)

An experimental Lighthouse category scoring how well a site supports machine interaction. It is
**not** the usual 0–100: it is a **fractional pass-ratio** of deterministic checks, and it is
currently advisory — it gathers signals rather than issuing a ranking. Treat it as **INFO**,
never a blocking gate, until Chrome stabilises it.

What it measures, and the app change that satisfies it:

| Signal group | Check | What to do |
|---|---|---|
| **WebMCP** | Declarative tool registration (HTML), imperative registration (JS), schema validity | For pages with real actions (forms, search, CRUD), expose them as WebMCP tools with valid schemas, so an agent invokes a tool instead of scraping the DOM. |
| **Agent a11y** | Names and labels on interactive elements; valid roles and parent/child tree; content visible in the a11y tree | Semantic HTML plus correct ARIA. Every button, link and input has a programmatic name. This **overlaps your existing a11y gate** (react-doctor, `web-design-guidelines`) — there is no separate effort, and no reason to duplicate the check. |
| **Stability** | Cumulative Layout Shift (CLS) | Reserve space for images and embeds; avoid late-injected content that shifts layout. An agent that mis-locates a moved element fails outright where a human would just re-aim. |
| **Discoverability** | `llms.txt` at the domain root | **Optional, low priority** — see below. |

### `llms.txt` — optional, and usually not worth it

Lighthouse checks for its *presence*, but it is a proposed convention with thin adoption and no
enforced consumer, so the real-world payoff today is near zero. Concretely:

- **Skip it for auth-gated apps.** External agents cannot reach past the gate anyway.
- **Consider it only for a genuinely public site**, as a cheap forward-looking bet.
- If you do ship one, it is a short Markdown file at the root served as a static asset
  (`public/llms.txt`), allowlisted past any auth gate, and it has to stay current with the real
  routes and actions or it actively misleads.

```markdown
# <App Name>
> One-line description of what this app is for.

## Primary routes
- /dashboard — ...
- /status — ...

## Notes
- Auth: password gate at /auth on preview environments.
```

## How to run an agentic audit

There is no stable Lighthouse CLI flag for this category yet, so run it through
`chrome-devtools-mcp`:

1. Deploy or open the **preview** for the branch.
2. Ask for a **Lighthouse audit** on that URL; report the Agentic Browsing pass-ratio and any
   failing checks, plus CLS from a performance trace.
3. Surface the result as **INFO** in the PR (see `[[wf-web-create-pr]]`). Do not block on it.

> If the MCP browser is unavailable, the Lighthouse CLI still covers the stable categories:
> `npx lighthouse <url> --only-categories=performance,accessibility,best-practices,seo
> --output=json --output-path=./lh.json`. Use `-G`/`-A` to capture and re-audit artifacts so
> repeat runs compare like with like. The agentic category will be missing — say so rather
> than reporting a partial audit as complete.

## Checklist (advisory)

- [ ] Interactive elements have programmatic names and roles (covered by the a11y gate).
- [ ] CLS is stable on the primary routes (verify via a performance trace on the preview).
- [ ] Pages with real actions expose WebMCP tools with valid schemas — where it adds value, not
      on every page.
- [ ] Any score ceiling has been attributed to the right layer (your code vs. an injected
      third-party script) before optimization work starts.

## Cross-references

- `[[wf-web-pwa]]` — the static-asset allowlist a `/llms.txt` would join
- `[[wf-web-create-pr]]` — surfaces the agentic-readiness INFO check in the PR flow
- `[[wf-web-check-quality]]` — points here for the live audit
- `[[wf-web-code-reviewer]]` — adds agentic readiness as a review dimension
- `[[web-design-guidelines]]` / `[[modern-web-guidance]]` — the a11y and modern-API guidance the
  agent-a11y signals lean on
