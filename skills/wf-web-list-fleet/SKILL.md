---
name: wf-web-list-fleet
description: Print the web fleet roster — every web repo discovered on disk with its detected stack profile (package manager, framework, deploy target, available quality scripts) and, where configured, its prod/preview URLs. Grouped by category. This skill also defines the two contracts the rest of the `wf-web-*` family reads — the optional `wf-fleet.json` registry and the detected repo profile — so it is the one to read first. Optionally enriches with current branch, last commit and PWA short_name.
---

# wf-web-list-fleet — the web fleet roster

Prints the repos in your web fleet with their stack profile and deploy URLs. Useful for sharing
links, building a release note, onboarding a contributor, or just seeing what you have.

This is a **pure registry printer** — no bun required. The optional `--enrich` flag uses `git`
and `jq`; if either is missing, that enrichment is skipped with a warning rather than aborting.

> **Read this first.** The two contracts defined here — the `wf-fleet.json` registry and the
> **repo profile** — are what every other `wf-web-*` skill uses instead of a hardcoded repo
> list. They are reproduced in condensed form in the skills that need them, but this is the
> source of truth.

---

## Contract 1 — the fleet root

Repos are found under a **fleet root**, resolved in this order:

1. `$WF_ROOT`, if set.
2. The `root` key in `wf-fleet.json` (see below).
3. **The parent directory of the current repo** — i.e. if you are in `~/personal/my-app`, the
   root is `~/personal`. This is the default and needs no configuration.

A directory under the root is a **fleet repo** if it contains both `.git/` and `package.json`.
Everything else is ignored.

---

## Contract 2 — `wf-fleet.json` (optional)

Deploy URLs and grouping cannot be detected from disk, so they live in an optional config.
Resolve it in this order, first hit wins:

1. `$WF_FLEET_CONFIG` (explicit path)
2. `<fleet root>/wf-fleet.json`
3. `<current repo>/wf-fleet.json`
4. `~/.config/wf/fleet.json`

**If no config exists, that is fine** — every skill in this family still works. You lose only
the URL and grouping columns; the stack profile is always detected.

```json
{
  "root": "~/personal",
  "groups": ["main", "demos", "libraries"],
  "repos": {
    "my-app": {
      "group": "main",
      "prod": "https://www.example.com/",
      "prod_alias": "https://my-app.vercel.app/",
      "preview": "https://my-app-git-main-acme.vercel.app/",
      "notes": "the flagship"
    },
    "my-ui": {
      "group": "libraries",
      "deploy": "none",
      "role": "shared components, consumed by the apps above"
    }
  },
  "scopes": ["@myorg"],
  "exempt": {
    "typescript": "my-legacy-app is deliberately held at ~6"
  }
}
```

| Key | Meaning |
|---|---|
| `root` | Fleet root directory. `~` is expanded. |
| `groups` | Display order for grouping. Repos with an unlisted or missing `group` fall into `ungrouped`, printed last. |
| `repos.<name>.prod` / `.prod_alias` / `.preview` | Deploy URLs. All optional. |
| `repos.<name>.deploy: "none"` | Not deployed (a library). Suppresses the URL lines. |
| `repos.<name>.role` / `.notes` | Free text shown beside the repo. |
| `scopes` | Your own npm scopes — packages that skip the supply-chain release-age gate and that advisory databases will not cover. Read by `[[wf-web-update-deps]]`. |
| `exempt` | Packages whose cross-repo version drift is **deliberate**, with the reason. Read by the common-deps check in `[[wf-web-update-deps]]`. |

Repos present on disk but absent from `repos` are still listed (profile only, no URLs). Repos
listed in the config but missing from disk are skipped with a note — never an error.

---

## Contract 3 — the repo profile (always detected, never configured)

This is what replaces a hardcoded per-repo quirk table. **Detect, never assume.** Every
`wf-web-*` skill derives what to run from this profile.

| Field | How to detect |
|---|---|
| **Package manager** | Lockfile at the repo root: `bun.lock` → bun · `pnpm-lock.yaml` → pnpm · `package-lock.json` → npm · `yarn.lock` → yarn. If several exist, that is itself a finding (react-doctor flags "multiple lock files") — report it. |
| **Framework** | `package.json` dependencies: `next` → Next.js · `expo` → Expo/React Native · `vite` → Vite · `@cloudflare/workers-types` or a `wrangler.jsonc`/`wrangler.toml` → Cloudflare Workers · `parcel` → Parcel · none of the above → treat as a **library**. |
| **Monorepo** | A `workspaces` array in `package.json`, or a `pnpm-workspace.yaml`. Record the workspace globs — several skills must iterate them rather than acting on the root manifest alone. |
| **Available scripts** | `Object.keys(pkg.scripts)`. **Run only what exists.** Never invent an equivalent for a missing script, and never substitute a different tool. |
| **Deploy target** | `.vercel/project.json` → Vercel (it also carries `projectId` / `orgId`) · `wrangler.jsonc`/`wrangler.toml` → Cloudflare · neither → none. |
| **Default branch** | `git symbolic-ref --short refs/remotes/origin/HEAD` → strip the `origin/` prefix. Falls back to `main`. **Never hardcode a branch name.** |
| **Remote slug** | `git remote get-url origin`, parsed to `<owner>/<repo>` — this is what `gh --repo` needs. Never guess an owner. |
| **PWA** | `public/manifest.json` exists. If so, read `short_name`, `theme_color`, `background_color`. |

One-liner for the script surface, used throughout this family:

```bash
has() { node -e 'const s=require("./package.json").scripts||{};process.exit(s[process.argv[1]]?0:1)' "$1"; }
# usage:  has lint && bun run lint
```

And for the rest of the profile:

```bash
pm()      { [ -f bun.lock ] && echo bun && return; [ -f pnpm-lock.yaml ] && echo pnpm && return; \
            [ -f package-lock.json ] && echo npm && return; [ -f yarn.lock ] && echo yarn && return; echo none; }
default_branch() { git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||' || echo main; }
slug()    { git remote get-url origin 2>/dev/null | sed -E 's|.*[:/]([^/]+/[^/]+?)(\.git)?$|\1|'; }
```

### The script-name rule

A script may be named differently from the tool it runs, and a script name can **collide with a
binary in `node_modules/.bin`** — which some health checkers flag. So:

- Look up the script by **name in `package.json`**, not by assuming the tool's name.
- If the conventional name is missing, look for the near-neighbour (`knip` → `knip:check`,
  `typecheck` → `type-check`, `format` → `fmt`) before concluding it is absent.
- If it is genuinely absent, **warn and skip**. Do not run the tool directly via `bunx` to
  "fill in" — the repo chose not to have that gate.

---

## Default output

```
🚀 main

  my-app                            [bun · Next.js · Vercel · PWA "MyApp"]
    Prod:    https://www.example.com/
    Preview: https://my-app-git-main-acme.vercel.app/

  my-worker                         [bun · Cloudflare Workers]
    Prod:    https://worker.example.com/

🧪 demos

  my-demo                           [bun · Vite]
    (no deploy configured)

🧱 libraries (no deploy)

  my-ui                             [bun · library · monorepo]
    shared components, consumed by the apps above
```

The bracketed profile is always shown — it is detected, so it is always available. URL lines
appear only for repos the config describes.

## Flags / arguments

Recognize these tokens in `$ARGUMENTS`:

| Token | Effect |
|---|---|
| `--enrich` | Add per-repo: current branch, last commit short SHA + subject + relative date, PWA `short_name`, and whether the tree is dirty. |
| `--md` | Markdown table instead of pretty text — paste-friendly. |
| `--urls-only` | One URL per line, no labels — pipe-friendly. |
| `--prod` / `--preview` | Filter to one URL kind. |
| `--group=<name>` | Limit to a single group from the config. |
| `--profile` | Profile columns only, no URLs — useful for spotting stack drift across the fleet. |
| `--json` | Machine-readable dump of the merged config + detected profiles. |

Default (no args): the pretty grouped output above.

## Workflow

1. Resolve the fleet root (Contract 1) and load `wf-fleet.json` if present (Contract 2).
2. Enumerate candidate repos on disk; detect each one's profile (Contract 3).
3. Merge: config supplies URLs/grouping, disk supplies the profile. Note repos in only one.
4. If `--enrich`, gather git and manifest details per repo. Skip repos not cloned locally
   (warn). If `git` or `jq` is missing, skip that field and warn — never abort.
5. Format per the requested flag and print.

## Maintenance

The **profile** never needs maintenance — it is read from disk every run. Only the URLs and
grouping live in `wf-fleet.json`, so that file is the only thing to update when a deploy URL
changes or a repo joins the fleet. Do not duplicate any of it into memory or into another
skill; this contract is the registry.

## Cross-references

- `[[wf-web-check-quality]]` — runs the detected script surface
- `[[wf-web-update-deps]]` — reads `scopes` and `exempt` from the config
- `[[wf-web-resync]]` — iterates the same fleet
- `[[wf-web-create-repo]]` — adds a repo to the fleet

User intent / overrides: $ARGUMENTS
