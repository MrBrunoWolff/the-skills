---
name: wf-web-scan-security
description: Run a deepsec (vercel-labs/deepsec) agent-powered vulnerability scan on a bun web repo — bootstraps or reuses the .deepsec/ workspace, converts the pnpm scaffold to bun, runs the free regex scan, reports the candidate count and STOPS for approval before the paid AI investigation, then summarises findings without committing them.
---

# wf-web-scan-security — deepsec scan for a web repo

An on-demand security audit with [`vercel-labs/deepsec`](https://github.com/vercel-labs/deepsec).

**Reference knowledge:** `[[wf-web-deepsec]]` — the bun conversion, the `.deepsec/` layout,
credentials, git policy and the cost model. deepsec's own skill and docs ship inside the
workspace (`.deepsec/node_modules/deepsec/SKILL.md` and `dist/docs/`) — **read those for any
question about deepsec's own flags or config**; do not paraphrase them from memory.

**Arguments:** `$ARGUMENTS` — optionally a repo name and/or a diff scope. Default target is the
current repo.

## Preflight

```bash
command -v bun >/dev/null 2>&1 || {
  echo "ERROR: bun is required. curl -fsSL https://bun.sh/install | bash"; exit 1; }
```

Never use `npx`, `pnpm` or `npm` here. deepsec's docs and CLI quickstart both print pnpm
instructions — ignore them and substitute per the table in the skill.

## Step 1 — Locate or bootstrap the workspace

```bash
ls .deepsec/deepsec.config.ts 2>/dev/null && echo "workspace exists" || echo "needs init"
```

**If it exists**, reuse it — do not re-init. (`init` refuses a non-empty workspace without
`--force`, and `--force` would overwrite a hand-written `INFO.md`, which is the expensive part.)
Confirm the project is registered and skip to Step 3:

```bash
cd .deepsec && bunx deepsec status
```

**If it does not**, bootstrap and immediately convert the pnpm scaffold to bun — `deepsec init`
has no package-manager flag, so this correction is not optional:

```bash
bunx deepsec init
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

Verify before continuing:

```bash
test ! -e pnpm-workspace.yaml && test ! -e pnpm-lock.yaml && test -f bun.lock \
  && echo "bun-only OK" || echo "FAIL: pnpm artefacts remain"
bunx deepsec --version
```

To add more fleet repos to one workspace (which is what enables cross-project `metrics`), use
`bunx deepsec init-project ../../<repo>` — never hand-edit the `projects` array.

## Step 2 — Credentials

`process` needs a model provider. If `.deepsec/.env.local` has no key, **stop and ask** rather
than starting a run that will fail on auth:

```bash
grep -qE '^(AI_GATEWAY_API_KEY|ANTHROPIC_AUTH_TOKEN|OPENAI_API_KEY)=.+' .deepsec/.env.local 2>/dev/null \
  && echo "credential present" || echo "MISSING — see [[wf-web-deepsec]] § Credentials"
```

It goes in `.deepsec/.env.local` (already gitignored) — never in the scanned repo's
`.env.local`, and never inline in a command.

## Step 3 — Project setup context (first run only)

deepsec's finding quality depends on `data/<id>/INFO.md`, hand-written context about the
codebase. On a first run, read `data/<id>/SETUP.md` and follow it — it tells you to read
deepsec's own `SKILL.md` and then fill `INFO.md` from the target codebase. **Do not skip this
and then judge the tool by its output.**

## Step 4 — Run the free audit first

Before paying anything, run the repo's dependency advisory gate (`bun run audit`, or
`bun audit --audit-level=high`). It is free, instant, and answers the question deepsec never
asks. Prune first so it reads the real tree:

```bash
bun prune && bun run audit
```

## Step 5 — Scan (free) and STOP

```bash
cd .deepsec
bunx deepsec scan --project-id <id>
bunx deepsec status --project-id <id>
```

`scan` is regex matchers only — no AI, no cost. **Report the candidate count and stop here.**
That count is what the next step bills for.

Do not run `process` unprompted. Say what the scan found, roughly what processing would cost
(per-candidate agent investigation, at `--thinking-level xhigh` by default), and let the user
choose:

- **Diff-scoped** — the right default for anything routine. `--diff <ref>` (e.g. the target
  branch, for PR scope), `--diff-staged`, or `--diff-working`.
- **Full audit** — every pending candidate. A deliberate, paid choice.
- **Otherwise scoped** — `--limit`, `--filter`, `--only-slugs`, or a lower `--thinking-level`.
  For an exploratory pass, drop the thinking level before dropping scope.

## Step 6 — Investigate (paid, only once approved)

```bash
bunx deepsec process --project-id <id>                        # full
bunx deepsec process --project-id <id> --diff origin/main     # PR scope
bunx deepsec process --project-id <id> --diff-working         # uncommitted

bunx deepsec revalidate --project-id <id>   # optional; cuts false positives
bunx deepsec report --project-id <id>
```

`revalidate` also checks git history for fixes that already landed, so it is worth running
before presenting anything.

## Step 7 — Present findings

Summarise **in the response**, most severe first. For each: what it is, the `file:line`, and
whether you confirmed it by reading the code.

Findings are AI-generated hypotheses:

- Treat each as a **starting hypothesis**; read the file before confirming.
- Never dismiss one without evidence from the code in question.
- Separate **confirmed** from **needs-human-review**, and say which is which.
- For a confirmed issue that cannot be fixed now, propose an issue with the rule, `file:line`,
  impact and suggested fix.

**Do not commit findings.** `data/*/reports/` and any `export` directory are unfixed
vulnerability write-ups. If you use `export`, put the output outside the repo.

## Guardrails

- **Never add deepsec to `[[wf-web-check-quality]]`.** That suite is free, deterministic and
  runs on every PR; this costs money and returns probabilistic findings.
- **Never `git add -A` here** — a fresh `.deepsec/` is a large untracked tree containing
  `node_modules/`. Stage explicit paths.
- **Do not fix a security finding and land it silently.** Report first; a real vulnerability fix
  is its own PR with its own review.

User intent / overrides: $ARGUMENTS
