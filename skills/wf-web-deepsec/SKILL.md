---
name: wf-web-deepsec
description: Running deepsec (vercel-labs/deepsec, the agent-powered vulnerability scanner) in a bun web repo — the pnpm-to-bun deltas its scaffold needs, the .deepsec/ workspace layout, where the model-provider key lives, what to track vs ignore in git, the cost model of scan vs process, and the diff modes for PR-scoped runs. Knowledge only; the action is /wf-web-scan-security.
---

# deepsec in a bun web repo

[`vercel-labs/deepsec`](https://github.com/vercel-labs/deepsec) is an agent-powered
vulnerability scanner you run in your own infrastructure. It finds candidate sites with regex
matchers (cheap, no AI), then has an AI agent investigate each one and emit findings with a
recommendation.

**The tool ships its own skill and docs — read those for anything about deepsec itself.** This
document covers only what is local: the bun conversion, and the conventions around it. Do not
paraphrase deepsec's CLI or config from memory; its flags and plugin contracts change.

| What | Where (after `bun install` in `.deepsec/`) |
| --- | --- |
| deepsec's own skill | `.deepsec/node_modules/deepsec/SKILL.md` |
| Full docs | `.deepsec/node_modules/deepsec/dist/docs/` |
| Worked reference setup | `.deepsec/node_modules/deepsec/dist/samples/webapp/` |
| Per-project setup prompt | `.deepsec/data/<id>/SETUP.md` |

Docs index: `getting-started.md`, `configuration.md`, `plugins.md`, `writing-matchers.md`,
`models.md`, `vercel-setup.md`, `architecture.md`, `data-layout.md`, `faq.md`.

---

## Bun-only deltas (the whole point of this skill)

`deepsec init` has **no package-manager flag** — it offers only `--id` and `--force`. The
scaffold it writes is hard-coded pnpm, so a bun repo must correct it immediately after init.

| deepsec's docs say | use instead |
| --- | --- |
| `npx deepsec init` | `bunx deepsec init` |
| `cd .deepsec && pnpm install` | `cd .deepsec && bun install` |
| `pnpm deepsec <cmd>` | `bunx deepsec <cmd>` (from inside `.deepsec/`) |
| `"packageManager": "pnpm@…"` | `"packageManager": "bun@<version>"` |
| `pnpm-workspace.yaml` | **delete it** — bun reads the `workspaces` field in `package.json` |

Post-init fix, from the repo root:

```sh
cd .deepsec
rm -f pnpm-workspace.yaml pnpm-lock.yaml
bun --eval '
  const p = "package.json";
  const j = JSON.parse(await Bun.file(p).text());
  j.packageManager = "bun@" + Bun.version;
  await Bun.write(p, JSON.stringify(j, null, 2) + "\n");
'
bun install
```

> Do **not** add an `engines.bun` here if the repo deploys to Vercel — `engines` is resolved
> major-only and a `bun` entry moves the project onto the bun build image. `.deepsec/` has its
> own manifest, so this is usually harmless, but keep the habit.

**Invocation.** `bunx deepsec <cmd>` from inside `.deepsec/` resolves the workspace install. For
something unambiguous — in a script, or when a network fetch must not happen — call the binary
directly: `./node_modules/.bin/deepsec <cmd>`. There are **no npm scripts** in the scaffold, so
`bun run deepsec …` does not work unless you add them.

---

## Workspace layout

`deepsec init` scaffolds `.deepsec/` **inside the repo being scanned** and registers that repo
as project 1 with `root: ".."`:

```
<repo>/.deepsec/
  deepsec.config.ts          # projects list; <deepsec:projects-insert-above> marker
  package.json               # the deepsec dependency lives here, not in the repo
  AGENTS.md                  # deepsec's own agent guidance
  .gitignore                 # node_modules/, .env*.local, and scan output
  data/<id>/
    SETUP.md                 # setup prompt for this project — read it before scanning
    INFO.md                  # AI prompt context you fill from the codebase (TRACKED)
    tech.json, project.json
    files/ runs/ reports/    # regenerated output (IGNORED)
```

Add more repos with `bunx deepsec init-project <root>` rather than hand-editing the `projects`
array — it scaffolds `data/<id>/` and the setup prompt too. One `.deepsec/` workspace **can**
hold several fleet repos (`root: "../../other-repo"`), which is how you get cross-project
`metrics`. Prefer that over one workspace per repo.

---

## Git: what to track

Decide deliberately, because the default `git status` noise is exactly how a `node_modules` tree
gets committed:

- **Recommended — track the inputs.** deepsec's own `.deepsec/.gitignore` already excludes
  `node_modules/`, `.env*.local` and all regenerated output (`data/*/files/`, `runs/`,
  `reports/`, `project.json`), keeping `deepsec.config.ts` and the hand-written `INFO.md` /
  `SETUP.md`. Committing those makes a scan reproducible on another machine, which is the whole
  point of `INFO.md`.
- **Alternative — ignore it entirely.** Add `.deepsec/` to the repo's `.gitignore` if scans
  should stay local. You lose `INFO.md` portability.

Either way: **never commit `data/*/reports/` or an `export` directory.** Those are unfixed
vulnerability write-ups — publishing them is handing someone a map.

---

## Credentials

deepsec needs a model provider. Put the key in `.deepsec/.env.local`, which the scaffold's
`.gitignore` already excludes. **Never** in the scanned repo's `.env.local` (that file is loaded
by the app and by e2e runs), and never inline in a command that gets echoed into a transcript.

```
AI_GATEWAY_API_KEY=…
```

Alternatives are an `ANTHROPIC_AUTH_TOKEN` + `ANTHROPIC_BASE_URL` pair, or OpenAI credentials.
`dist/docs/vercel-setup.md` covers obtaining gateway and sandbox tokens; `dist/docs/models.md`
covers model selection. Read those rather than guessing.

Check before running, so a paid run does not fail on auth:

```sh
grep -qE '^(AI_GATEWAY_API_KEY|ANTHROPIC_AUTH_TOKEN|OPENAI_API_KEY)=.+' .deepsec/.env.local 2>/dev/null \
  && echo "credential present" || echo "MISSING"
```

---

## Run the dependency audit first — it is free and answers a different question

Before spending a `process` run, run the repo's advisory gate (`bun audit`, or the repo's
`audit` script). The two tools do not overlap:

| | dependency audit | deepsec |
| --- | --- | --- |
| Looks at | **dependencies**, against the advisory DB | **your source**, via an AI agent |
| Finds | known CVEs in packages you install | novel vulnerabilities in code you wrote |
| Cost | free, ~0.5s | free `scan`, **paid** `process` |

So the audit is not a cheaper deepsec — it is the check deepsec never performs. Clearing it
first also stops you paying an agent to reason about a dependency you could have bumped.

Two caveats when reading it:

- **Privately-hosted scopes are not covered.** A registry that answers the audit endpoint with a
  404 gets skipped with a `warn:` line. Your own published packages have no advisory coverage
  from this tool — which is precisely the gap deepsec fills.
- **Prune first.** `bun install` leaves orphaned packages in `node_modules`, and audit reads
  that tree; a stale copy of a package produces an advisory that the lockfile does not actually
  carry.

## Cost model — the thing to get right

The pipeline is deliberately split so the expensive step is opt-in:

| Command | Cost | What it does |
| --- | --- | --- |
| `scan` | free | regex matchers find candidate sites; no AI |
| `process` | **paid, per candidate** | AI agent investigates each candidate |
| `triage` | cheap | P0/P1/P2 classification, no code reading |
| `revalidate` | paid | re-checks findings, cuts false positives |
| `report` / `export` / `metrics` / `status` | free | read existing state |

**Always `scan` first and look at the candidate count before running `process`** — that count is
what you are about to pay for.

Diff mode is **not** a bare `--diff` flag — it is a family, and `--diff` takes a ref:

| Flag | Scope |
| --- | --- |
| `--diff <ref>` | files changed between `<ref>` and HEAD — e.g. `--diff origin/main` for PR scope |
| `--diff-staged` | files in the git index |
| `--diff-working` | uncommitted and untracked files |

Other scoping levers: `--limit <n>`, `--filter <prefix>`, `--only-slugs` / `--skip-slugs <csv>`,
`--batch-size <n>`, `--concurrency <n>`. Cost also moves with `--thinking-level`
(`minimal|low|medium|high|xhigh`, **default `xhigh`**) and `--agent` / `--model`. The defaults
are the expensive end — **for an exploratory run, drop the thinking level before dropping
scope**: a cheap pass over everything finds more than an expensive pass over a tenth of it.

`--project-id` is optional when the workspace holds exactly one project and **required** once
there are several.

Distributed runs go through sandbox microVMs and need a platform token:
`bunx deepsec sandbox process --project-id <id> --sandboxes 10 --concurrency 4`.

---

## Interpreting output

- Findings are AI-generated hypotheses. `revalidate` exists because the false-positive rate is
  real — it also checks git history for fixes that already landed.
- Apply the same discipline as any scoring tool: treat a finding as a **starting hypothesis**,
  read the code before confirming, and never suppress one without evidence from the file in
  question.
- Custom matchers are for patterns a **confirmed true positive** taught you — not speculative
  ones. See `dist/docs/writing-matchers.md`.

## Relationship to the rest of the quality suite

deepsec is **not** part of `[[wf-web-check-quality]]` and must not be added to it. Those gates
are free, deterministic and run on every PR; `process` costs money and returns probabilistic
findings. Keep it on-demand — `[[wf-web-scan-security]]`.
