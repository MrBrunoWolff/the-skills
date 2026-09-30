---
name: wf-web-scan-security
description: Run an on-demand DeepSec source-security scan in a selected repository, inspect coverage and candidates, and investigate within the user's authorized scope. Keep credentials and reports local; this is separate from dependency audits and publication secret checks.
---

# Scan source security with DeepSec

Use the explicit target repo or the current repository. Read `wf-web-deepsec` when
available, plus the installed DeepSec `SKILL.md` and relevant docs. Check the
installed CLI's help; flags and initialization behavior change.

## Choose the run scope

An ordinary `deepsec init` can install, connect to a provider, generate context,
scan, and start an AI investigation. Do not use it as if it only creates files.
For a local pattern scan, use scaffold-only mode and run scan explicitly.

```sh
bunx deepsec init --plan --output json
bunx deepsec init --scaffold-only
```

Use the caller's preferred runner; Bun is an option, not a requirement for the
scanned project. Reuse an existing workspace. Do not force initialization over
handwritten context or existing findings.

## Prepare the local workspace

Keep `.deepsec/` ignored for an ad hoc publication review. If the caller requests
versioned scan inputs, use DeepSec's generated ignore rules and stage only reviewed
configuration/context. Credentials, dependency trees, and findings stay untracked.

Install only inside the isolated workspace. For Bun, change its generated
`packageManager`, remove newly generated pnpm-only workspace/lock files, and run
`bun install`. Preserve existing files if this is a reused workspace. Never add a
root package manifest to a documentation/Python repo merely to run the scanner.

Read `data/<id>/SETUP.md` and complete `INFO.md` from the actual codebase: purpose,
auth shape, threat model, project-specific risks, and known test placeholders.
Keep it short. Read writing-matchers docs before adding any matcher; do not invent
speculative rules simply to produce candidates.

Run a dependency advisory check only if the target actually has dependencies and
an applicable manager/audit command. Skip and explain it for documentation-only or
standard-library projects. A source scan does not replace package advisory data.

## Local scan and coverage

From `.deepsec/`, use the installed binary without an incidental network fetch:

```sh
./node_modules/.bin/deepsec scan --project-id <id>
./node_modules/.bin/deepsec status --project-id <id>
```

Report the active matchers, covered languages/files, and candidate count. Zero
candidates is not a finding that all source is safe. Markdown workflows, unusual
languages, unrecognized manifests, and Git history may require manual review or a
separate credential check. State uncovered surfaces explicitly.

For a publication review, inspect publishable tracked, staged, unstaged, and
untracked files, plus Git history. Search for actual credential values, private
keys, credential-bearing URLs, private repo names, and machine-specific paths.
Report locations and categories without printing secret values. Distinguish
placeholder-only examples from live credentials.

## Investigation

If the user already requested an AI audit and specified its scope/budget, proceed
within those limits. Otherwise, complete the local scan, report candidates and
coverage, then ask before starting billable model investigation. Explain that
this additional choice comes from the tool's separate scan/process stages.

Read current process help before choosing diff scope, limits, model, reasoning,
and authentication. Local subscriptions are supported in current DeepSec; use the
selected CLI's existing login when that is the caller's choice. Provider keys
remain in the ignored workspace or environment, never inline command arguments.

```sh
./node_modules/.bin/deepsec process --project-id <id> --diff <base-ref>
./node_modules/.bin/deepsec report --project-id <id>
```

Revalidation is another model-backed operation; run it when within the authorized
scope. Do not upload source to a sandbox or create/link a cloud project as an
incidental step of a local scan.

## Findings and fixes

Read each cited file before confirming a finding. Report impact, evidence,
location, and uncertainty; distinguish confirmed issues from hypotheses and
coverage gaps. Do not suppress findings just to improve a count.

Keep reports and exports local. Report a confirmed issue before changing it;
apply a fix when the user's request covers remediation. Otherwise present the
concrete fix for review. Do not commit or push security findings or fixes merely
because a scan was requested. DeepSec remains on demand, outside the routine
`wf-web-check-quality` suite. User scope: $ARGUMENTS.
