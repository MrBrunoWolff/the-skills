# Agent-Skill Source Repos — Curated Reference

A reference catalog of GitHub repos that publish **agent skills** (Claude Code / Codex / Cursor /
Gemini CLI, the open Agent Skills format). Install any with `npx skills add <owner>/<repo>` or via
the Claude Code plugin marketplace (`/plugin marketplace add <owner>/<repo>`).

Legend: ⭐ = authoritative / first-party source · 🗂️ = curated index (a list, not skills itself).

---

## Official & Foundational

| Repo | Link | What it is |
|------|------|------------|
| ⭐ anthropics/skills | https://github.com/anthropics/skills | Anthropic's official public skills repo — `skill-creator`, `claude-api`, document/MCP/creative skills. The reference for the SKILL.md format. |
| obra/superpowers | https://github.com/obra/superpowers | Agentic skills *framework* + software-dev methodology (TDD, systematic debugging, git worktrees). |
| obra/superpowers-skills | https://github.com/obra/superpowers-skills | Community-editable skill library for the Superpowers plugin. |
| obra/superpowers-marketplace | https://github.com/obra/superpowers-marketplace | Curated Claude Code plugin marketplace. |

## General Engineering & Productivity

| Repo | Link | What it is |
|------|------|------------|
| ⭐ MrBrunoWolff/the-skills | https://github.com/MrBrunoWolff/the-skills | Your own skills repo (`agent-setup`, `update-setup`, this catalog). |
| mattpocock/skills | https://github.com/mattpocock/skills | Matt Pocock's TS/engineering + productivity skills (`tdd`, `triage`, `grill-me`, `handoff`, `write-a-skill`, …). |
| addyosmani/agent-skills | https://github.com/addyosmani/agent-skills | Addy Osmani — production-grade engineering skills (`/spec`, `/plan`, `/build`, `/review`, `/ship`), agent personas, hooks. |
| safishamsi/graphify | https://github.com/safishamsi/graphify | Turns a code/docs/schema folder into a queryable knowledge graph (tree-sitter + LLM); 25 languages. |
| affaan-m/everything-claude-code | https://github.com/affaan-m/everything-claude-code | "ECC" — 250+ skills across nearly every stack (~214k⭐). Kitchen sink: **selective `--skill` installs only**, never `--all`. |
| jeffallan/claude-skills | https://github.com/jeffallan/claude-skills | ~80 specialist skills by domain (FastAPI, Django, Playwright, DevOps, …) (~10k⭐). |

## Backend, Security & Infra

| Repo | Link | What it is |
|------|------|------------|
| ⭐ trailofbits/skills | https://github.com/trailofbits/skills | Trail of Bits (top security firm, ~5.7k⭐) — `modern-python` (uv/ruff/ty/pytest) + security auditing skills (semgrep, static-analysis, property-based-testing, supply-chain-risk-auditor, differential-review). |
| ⭐ antonbabenko/terraform-skill | https://github.com/antonbabenko/terraform-skill | Anton Babenko (terraform-aws-modules maintainer, ~2k⭐) — Terraform/OpenTofu testing, modules, CI/CD, production patterns. |
| lackeyjb/playwright-skill | https://github.com/lackeyjb/playwright-skill | Playwright E2E skill (~2.8k⭐) — Claude writes and executes browser automation/tests on the fly. |

## Web / Frontend

| Repo | Link | What it is |
|------|------|------------|
| ⭐ vercel-labs/agent-skills | https://github.com/vercel-labs/agent-skills | Vercel — React/Next.js best practices, view transitions, composition, web design, deploy-to-vercel. |
| vercel-labs/agent-browser | https://github.com/vercel-labs/agent-browser | Browser automation CLI for agents. |
| vercel-labs/next-browser | https://github.com/vercel-labs/next-browser | React DevTools / Next.js dev-overlay data as shell commands. |
| millionco/react-doctor | https://github.com/millionco/react-doctor | React diagnostics (lint, a11y, bundle, architecture) + animation/remotion best practices. |
| ⭐ GoogleChrome/modern-web-guidance | https://github.com/GoogleChrome/modern-web-guidance | Google Chrome — modern web platform guidance + chrome-extensions. |
| ⭐ shadcn/ui | https://github.com/shadcn/ui | shadcn — the `shadcn` component skill lives in this repo. |

## iOS / Apple Platforms

| Repo | Link | What it is |
|------|------|------------|
| ⭐ twostraws/swift-agent-skills | https://github.com/twostraws/swift-agent-skills | Paul Hudson (Hacking with Swift) — curated *directory* of open-source Swift/Apple agent skills. Best starting point. 🗂️ |
| ⭐ twostraws/swiftui-agent-skill | https://github.com/twostraws/swiftui-agent-skill | Paul Hudson — focused SwiftUI skill (modern API usage, perf, a11y). |
| vabole/apple-skills | https://github.com/vabole/apple-skills | iOS 26+ APIs, SwiftUI, UIKit, Liquid Glass, Human Interface Guidelines. |
| patrickserrano/skills | https://github.com/patrickserrano/skills | iOS/Swift/SwiftUI — build, debug, profile, test, refactor, ship. |
| keskinonur/claude-code-ios-dev-guide | https://github.com/keskinonur/claude-code-ios-dev-guide | Setup guide for Claude Code + PRD-driven Swift/SwiftUI workflows (guide, not skills). 🗂️ |

## Android / Kotlin / Compose

| Repo | Link | What it is |
|------|------|------------|
| ⭐ chrisbanes/skills | https://github.com/chrisbanes/skills | Chris Banes (Google Android eng) — Compose state hoisting/authoring, stability diagnostics, animations, Kotlin structured concurrency. Best Compose source. |
| ⭐ skydoves/compose-performance-skills | https://github.com/skydoves/compose-performance-skills | skydoves — curated library focused on Jetpack Compose performance. |
| rcosteira79/android-skills | https://github.com/rcosteira79/android-skills | Android & KMP — architecture, data layer, DI, testing, coroutines/flows, Gradle, RxJava migration. |
| aldefy/compose-skill | https://github.com/aldefy/compose-skill | Jetpack Compose skill with real androidx source-code "receipts". |
| Drjacky/claude-android-ninja | https://github.com/Drjacky/claude-android-ninja | Kotlin + Compose: modular architecture, Navigation3, Gradle conventions, testing. |
| new-silvermoon/awesome-android-agent-skills | https://github.com/new-silvermoon/awesome-android-agent-skills | Curated collection of modern Android agent skills. 🗂️ |

## Cross-Platform / Mobile

| Repo | Link | What it is |
|------|------|------------|
| vercel-labs/agent-skills (react-native) | https://github.com/vercel-labs/agent-skills | React Native skills live inside Vercel's repo (`vercel-react-native-skills`). |

## Curated Indexes (find more) 🗂️

| Repo | Link | What it is |
|------|------|------------|
| VoltAgent/awesome-agent-skills | https://github.com/VoltAgent/awesome-agent-skills | 1000+ skills from official teams + community. |
| VoltAgent/awesome-claude-code-subagents | https://github.com/VoltAgent/awesome-claude-code-subagents | Subagent personas by language/domain. |
| karanb192/awesome-claude-skills | https://github.com/karanb192/awesome-claude-skills | 50+ verified, actively maintained. |
| travisvn/awesome-claude-skills | https://github.com/travisvn/awesome-claude-skills | Curated skills + resources + tools. |
| ComposioHQ/awesome-claude-skills | https://github.com/ComposioHQ/awesome-claude-skills | Curated workflow skills. |

---

## Recommendation matrix

Machine-friendly section consumed by the `agent-setup` skill (Phase 1, see
[skills/agent-setup/recommend.md](skills/agent-setup/recommend.md)). Rules:

- **One preferred skill per concern** — alternatives are listed but never auto-suggested.
- **Scope**: `global` = install once in `~/.claude/skills` (about the user, not the repo);
  `project` = install per-repo via `npx skills add` (lands in `skills-lock.json`).
- **Tier**: `general` = suggest for every repo; otherwise suggest only when the stack is detected.

| Concern | Preferred skill | Source repo | Tier | Scope | Alternatives |
|---------|----------------|-------------|------|-------|--------------|
| tdd | `tdd` | mattpocock/skills | general | project | addyosmani test workflows |
| spec/plan/ship workflow | `/spec` `/plan` `/build` `/review` | addyosmani/agent-skills | general | project | — |
| bug triage | `triage` | mattpocock/skills | general | project | — |
| root-cause debugging | `diagnose` | mattpocock/skills | general | project | obra systematic-debugging |
| PRD writing | `to-prd` | mattpocock/skills | general | project | — |
| issue breakdown | `to-issues` | mattpocock/skills | general | project | — |
| architecture review | `improve-codebase-architecture` | mattpocock/skills | general | project | — |
| codebase knowledge graph | `graphify` | safishamsi/graphify | general (large repos) | project | — |
| dep + skill refresh | `update-setup` | MrBrunoWolff/the-skills | general | project | — |
| web fleet roster + repo profile | `wf-web-list-fleet` | MrBrunoWolff/the-skills | web (fleet) | project | — |
| web quality suite runner | `wf-web-check-quality` | MrBrunoWolff/the-skills | web | project | — |
| web PR flow + reviewer charter | `wf-web-create-pr` / `wf-web-code-reviewer` | MrBrunoWolff/the-skills | web | project | — |
| new web repo scaffold | `wf-web-create-repo` / `wf-web-create` | MrBrunoWolff/the-skills | web | project | — |
| PWA setup | `wf-web-setup-pwa` / `wf-web-pwa` | MrBrunoWolff/the-skills | web (PWA) | project | — |
| fleet dep + skill refresh | `wf-web-update-deps` / `-fix` / `wf-web-update-skills` | MrBrunoWolff/the-skills | web (fleet) | project | `update-setup` for a single repo |
| fleet git resync | `wf-web-resync` | MrBrunoWolff/the-skills | web (fleet) | project | — |
| agent-powered security scan | `wf-web-scan-security` / `wf-web-deepsec` | MrBrunoWolff/the-skills | web | project | — |
| agentic readiness | `wf-web-agentic` | MrBrunoWolff/the-skills | web | project | — |
| skill authoring | `write-a-skill` | mattpocock/skills | general | global | anthropics skill-creator |
| terse output mode | `caveman` | mattpocock/skills | general | global | — |
| session handoff | `handoff` | mattpocock/skills | general | global | — |
| plan stress-testing | `grill-me` / `grill-with-docs` | mattpocock/skills | general | global | — |
| quick prototyping | `prototype` | mattpocock/skills | general | global | — |
| React/Next.js perf | `react-best-practices` | vercel-labs/agent-skills | web | project | — |
| web design quality | `web-design-guidelines` | vercel-labs/agent-skills | web | project | — |
| modern web platform APIs | `modern-web-guidance` | GoogleChrome/modern-web-guidance | web | project | — |
| React diagnostics | `react-doctor` | millionco/react-doctor | web (react) | project | — |
| component library | `shadcn` | shadcn/ui | web (shadcn detected) | project | — |
| browser automation/testing | `agent-browser` | vercel-labs/agent-browser | web | project | — |
| Next.js runtime introspection | `next-browser` | vercel-labs/next-browser | web (next) | project | — |
| view transitions | `react-view-transitions` | vercel-labs/agent-skills | web (react) | project | — |
| React composition | `composition-patterns` | vercel-labs/agent-skills | web (react) | project | — |
| Vercel deploys | `deploy-to-vercel` | vercel-labs/agent-skills | web (vercel.json) | project | — |
| Chrome extensions | `chrome-extensions` | GoogleChrome/modern-web-guidance | web (manifest.json ext) | project | — |
| SwiftUI | `swiftui-agent-skill` | twostraws/swiftui-agent-skill | ios | project | vabole/apple-skills |
| Apple platform APIs/HIG | apple-skills | vabole/apple-skills | ios | project | patrickserrano/skills |
| Compose state & animations | compose skills | chrisbanes/skills | android | project | aldefy/compose-skill |
| Compose performance | compose-performance | skydoves/compose-performance-skills | android | project | — |
| Android architecture/KMP | android-skills | rcosteira79/android-skills | android | project | Drjacky/claude-android-ninja |
| Kotlin coroutines | `kotlin-coroutines-structured-concurrency` | chrisbanes/skills | android | project | — |
| React Native | `react-native-skills` | vercel-labs/agent-skills | react-native | project | — |
| modern Python tooling | `modern-python` | trailofbits/skills | python | project | jeffallan fastapi/django experts |
| Python patterns/testing | `python-patterns` + `python-testing` | affaan-m/everything-claude-code | python | project | manikosto/claude-code-python-stack |
| Django | `django-patterns` | affaan-m/everything-claude-code | python (django detected) | project | jeffallan django-expert |
| FastAPI | `fastapi-patterns` | affaan-m/everything-claude-code | python (fastapi detected) | project | jeffallan fastapi-expert |
| backend API design | `api-design` + `backend-patterns` | affaan-m/everything-claude-code | node-backend | project | jeffallan backend skills |
| NestJS | `nestjs-patterns` | affaan-m/everything-claude-code | node-backend (nest detected) | project | — |
| Terraform/OpenTofu | terraform-skill | antonbabenko/terraform-skill | terraform | project | ECC deployment-patterns |
| Docker | `docker-patterns` | affaan-m/everything-claude-code | docker | project | — |
| Kubernetes | `kubernetes-patterns` | affaan-m/everything-claude-code | kubernetes | project | — |
| E2E testing (Playwright) | playwright-skill | lackeyjb/playwright-skill | e2e (playwright detected) | project | ECC e2e-testing |
| security review | `static-analysis` / `semgrep-rule-creator` / `supply-chain-risk-auditor` | trailofbits/skills | on-request (any stack) | project | ECC security-review |
| Go | `golang-patterns` + `golang-testing` | affaan-m/everything-claude-code | go | project | — |
| Rust | `rust-patterns` + `rust-testing` | affaan-m/everything-claude-code | rust | project | — |
| Flutter/Dart | `dart-flutter-patterns` | affaan-m/everything-claude-code | flutter | project | Harishwarrior/flutter-claude-skills (testing) |

> Star counts and picks verified June 2026 via the GitHub API. ECC = affaan-m/everything-claude-code.

## Gaps worth filling later

- **Flutter / Dart** — covered via ECC's `dart-flutter-patterns`, but no strong *dedicated* first-party source yet (best dedicated repos are <100⭐).
- **AWS-specific** (CDK, SAM, service patterns) — terraform-skill covers IaC generally; nothing AWS-native yet.

> Verified June 2026. Re-check links periodically — skill repos move/rename fast.
