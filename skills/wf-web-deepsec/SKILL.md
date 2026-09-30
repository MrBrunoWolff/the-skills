---
name: wf-web-deepsec
description: Explain the DeepSec scan/process boundary, current initialization behavior, isolated runner setup, coverage limits, credential routes, and Git handling. Use wf-web-scan-security for the actual scan workflow.
---

# DeepSec setup and interpretation

DeepSec finds source-security candidates with local matchers, then uses coding
agents to investigate them. Read its installed skill and docs before selecting
flags or changing configuration:

- `.deepsec/node_modules/deepsec/SKILL.md`
- `.deepsec/node_modules/deepsec/dist/docs/getting-started.md`
- `configuration.md`, `models.md`, `vercel-setup.md`, and `writing-matchers.md`
  in that same docs directory, when relevant.

The official source is [vercel-labs/deepsec](https://github.com/vercel-labs/deepsec).
The installed CLI and matching docs take precedence over older workflow examples.

## Initialization can run the audit

Current `init` is a resumable setup workflow, not just a scaffold generator. It
can install dependencies, configure model access, generate context/matchers,
scan, and start processing. Inspect the plan before a full initialization:

```sh
bunx deepsec init --plan --output json
```

For a scan that starts with no model calls or cloud setup:

```sh
bunx deepsec init --scaffold-only
```

Scaffold-only creates files but does not install, connect, scan, or process.
Use the installed help to confirm support. Never force a nonempty workspace merely
to restart; setup and processing are resumable.

## Runner and workspace

The isolated workspace has its own package manifest; the target need not be a
JavaScript app. Use a supported installer or adapt a fresh scaffold to the user's
runner. Current initialization exposes pnpm/npm installer choices. Bun can run
an isolated install after changing the generated packageManager and removing only
newly generated pnpm-specific workspace/lock files. Reused workspaces need their
existing configuration preserved.

After installation, call `./node_modules/.bin/deepsec` from `.deepsec/` for a
predictable offline invocation. Complete the project's SETUP/INFO context before
interpreting findings. Add further projects using `init-project`, not by editing
only the project list and skipping their setup files.

## Model access and cost

| Stage | Behavior |
|---|---|
| scan | Local pattern matching; no model calls |
| process | Model-backed investigation of candidates |
| triage/revalidate | Further model-backed analysis |
| status/report/export/metrics | Read recorded state |

Local subscriptions can use an already logged-in Claude or Codex CLI with
`--model-auth local`. Gateway and direct/custom providers are other routes; read
the installed credential docs and store only variable names in configuration.
Never print token values, put them in URLs, or put credentials into the target's
publishable source. Sandbox/cloud execution is a separate choice and may require
additional platform credentials and source uploads.

For a model-backed run, honor the scope and cost/duration policy the user supplied.
Read current help for diff modes, project IDs, limits, models, and thinking levels.
A scan-only request does not implicitly authorize a billable full-repo audit.

## Coverage and publication

Report matcher and language coverage along with candidate counts. Zero candidates
means the enabled patterns did not match; it does not prove complete security.
Matcher-driven reviews may miss Python behavior or unsafe instructions in Markdown.
For public release, review current publishable files and Git history separately
for secrets and private context. A credential in an older commit remains relevant
even if the current file is clean. Do not rewrite history without authorization.

Dependency advisory checks answer a different question. Run the target's existing
check when applicable, not an invented Bun audit on a repo without a package tree.
A code investigation does not fill a private registry's advisory coverage gap.

Ignore `.deepsec/` for local reviews. When scan inputs are deliberately versioned,
use the generated ignore rules and review each staged input. Keep credentials,
node_modules, candidate state, reports, and exports local. Treat findings as
hypotheses until the code confirms them. Use `wf-web-scan-security` to perform a
scan; do not add a model-backed audit to every routine quality check.
