---
name: wf-web-create-repo
description: Scaffold a new web repo with the canonical Next.js + bun + Tailwind 4 skeleton — supply-chain-hardened bunfig, oxlint/oxfmt/knip/react-doctor/vitest gates wired into a composite check script and CI, theming, splash, optional PWA and password gate. Asks for the name, title and options, writes everything, installs, and stages without committing.
---

# wf-web-create-repo — bootstrap a new web repo

Scaffolds a new web repo with the skeleton in `[[wf-web-create]]`, which holds the complete file
inventory and templates. This skill is the *action*; that one is the *knowledge*. Do not
re-derive the templates here — if a template has drifted from your reference repo, fix the
skill rather than improvising at scaffold time.

## Preflight

```bash
command -v bun >/dev/null 2>&1 || {
  echo "ERROR: bun is required. Install with:"
  echo "  curl -fsSL https://bun.sh/install | bash"
  echo "  # or on macOS: brew install oven-sh/bun/bun"
  exit 1
}
echo "bun $(bun --version) detected."
```

Abort and surface the install instructions rather than falling back to another package manager.
This starter selects Bun. Respect another explicitly requested stack rather than imposing
it on existing workspace members.

## Workflow

1. Preflight.
2. **Read the reference repo first.** Resolve `reference` from `wf-fleet.json` (see
   `[[wf-web-list-fleet]]`), or ask which existing repo to mirror. Read its `package.json`,
   `bunfig.toml` and tool configs for **current versions** — the skill's templates carry shape,
   the reference carries versions. If there is no reference repo (this is the first), use the
   skill's templates and say that versions should be verified.
3. Use values already supplied; ask only for missing decisions in one batch:
   - **Repo name** — e.g. `my-app`
   - **App title** — e.g. "My App"
   - **Platform** — Vercel or Cloudflare Workers (decides `vercel.json` vs `wrangler.jsonc`)
   - **Include a PWA?** — default yes for a user-facing app, no for a library or internal tool
   - **Include the `/auth` password gate?** — default yes only if previews will be public
4. Create the directory under the fleet root and `cd` in. Refuse a nonempty
   destination; an existing repository needs a scoped migration rather than overwrite.
5. Generate every file in `[[wf-web-create]]` § *File inventory*, in the § *Generation order*.
   **`bunfig.toml` is written before the first install** so the release-age and `ignoreScripts`
   guards cover the very first dependency fetch.
6. `bun install`.
7. If a PWA was requested, hand off to `[[wf-web-setup-pwa]]` — it asks its own questions
   (`short_name`, theme colour, categories) and needs a source logo SVG.
8. Run the generated checks. Initialize Git and inspect generated files for secrets.
   Stage explicit scaffold paths, excluding local credentials and unrelated files;
   leave the first commit for the user unless committing was requested.
9. Print next steps:
   - create the GitHub repo and push
   - link the deploy project; set `APP_PASSWORD` in its env if the gate was included
   - add the repo to `wf-fleet.json` with its group and URLs
   - run `[[wf-web-check-quality]]` to confirm the gates are green from commit one

## Non-negotiables for any new web repo

These are the ones that are expensive to discover later:

- **`bunfig.toml` exists and carries `minimumReleaseAge` + `ignoreScripts`** before the first
  install. Adding them afterwards means the first install — the one that pulls the whole tree —
  ran unguarded.
- Choose a Node engine supported by the deployment target. Keep Bun’s version in
  `packageManager`; check current platform documentation before enabling a Bun runtime
  or adding platform configuration fields. Do not generalize an old image failure.
- **Every script calls `bun` / `bunx`**, never `npm` / `npx` / `pnpm` / `pnpx`.
- **All four agent-dir exclusions are present** — `.oxlintrc.json`, `.oxfmtrc.json`,
  `knip.json`, `doctor.config.json`. Each tool reads only its own config. A missing
  `doctor.config.json` is the one that bites: the score tanks as soon as a vendored skill ships
  `.js`, and every deduction points into `.agents/`.
- **At least one real test**, so the test gate is a gate. A suite that passes because it found
  nothing is a green badge over an empty room.
- **CI runs install → audit → check → test → doctor.** One job, the same commands as local.

## What to delegate

For file *content* — the layout, the splash inline CSS, the proxy middleware, the theme
provider — load `[[wf-web-create]]` and follow it. If a template has drifted from the reference
repo, **update the skill after the scaffold**, rather than re-deriving it next time from
whatever repo happens to be open.

## Cross-references

- `[[wf-web-create]]` — file inventory and templates
- `[[wf-web-setup-pwa]]` — the PWA slice
- `[[wf-web-check-quality]]` — first thing to run afterwards
- `[[wf-web-list-fleet]]` — register the new repo here

User intent / overrides: $ARGUMENTS
