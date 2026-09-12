# Phase 1 procedure — skill recommendations

Detect what kind of project this is, then recommend (and on confirmation install) agent skills
from the vetted catalog. Opinionated by design: **one preferred skill per concern**, never the
whole firehose.

## 1. Load the catalog

The catalog is the single source of truth. Resolve it in this order:

1. **Fetch live** (preferred — always fresh):
   `https://raw.githubusercontent.com/MrBrunoWolff/the-skills/main/skill-sources.md`
2. **Local fallback** (offline / developing inside the-skills): `skill-sources.md` at the repo root.

Use the **Recommendation matrix** section — it has the concern → preferred-skill → tier → scope
mapping. The prose tables above it are human context.

**Hard rule:** never recommend a source repo that is not in the catalog. The catalog is the
trust/supply-chain boundary — skills are instructions injected into the agent, so vetting matters.

## 2. Detect the stack(s)

Check for these markers (a repo can match several — monorepos are normal):

| Marker | Stack |
|--------|-------|
| `package.json` with `next` / `react` / `vue` / `svelte` | web |
| `package.json` with `react-native` / `expo` | react-native |
| `*.xcodeproj` / `*.xcworkspace` / `Package.swift` / `Podfile` | ios |
| `build.gradle` / `build.gradle.kts` / `settings.gradle*` / `AndroidManifest.xml` | android |
| `package.json` with `express` / `fastify` / `@nestjs/*` / `hono` | node-backend |
| `pyproject.toml` / `requirements.txt` / `setup.py` | python |
| python deps include `django` | python (django) |
| python deps include `fastapi` | python (fastapi) |
| `pubspec.yaml` | flutter |
| `go.mod` | go |
| `Cargo.toml` | rust |
| `*.tf` | terraform |
| `Dockerfile` / `compose.yaml` / `docker-compose.yml` | docker |
| `Chart.yaml` / `k8s/` manifests / `kustomization.yaml` | kubernetes |
| `playwright.config.*` | e2e (playwright) |
| `vercel.json` | web + vercel deploys |
| `manifest.json` with `"manifest_version"` | chrome extension |
| `components.json` (shadcn) or `@shadcn` deps | shadcn |
| `bunfig.toml` / `bun.lock` | bun |

For monorepos, scan one level deep (`apps/*`, `packages/*`) and union the detected stacks.

## 3. Diff against what's installed

- Read `skills-lock.json` at the repo root (if present) — never re-suggest an installed skill.
- Check `~/.claude/skills/` for globally installed skills — never suggest installing globally-scoped
  skills again at project level (this causes duplicate triggers).
- **Name collisions:** the lockfile namespace is flat. If a recommended skill's name already exists
  in the lockfile **from a different source**, do NOT overwrite — flag it to the user and skip.

## 4. Compose the recommendation

1. Start with all **general / project** tier skills from the matrix.
2. Add the tier rows matching each detected stack (respect sub-conditions like "web (next)").
3. Enforce **one skill per concern** — if two candidates cover the same concern, only the
   catalog-preferred one survives. Mention the alternative in a footnote only.
4. List **general / global** tier skills separately as "install once in `~/.claude/skills`" —
   these are about the user, not the repo, and duplicating them per-project causes trigger conflicts.
5. **Budget: max ~12 project skills.** Every installed skill's description occupies agent context
   permanently; more skills = worse triggering. If over budget, drop the least stack-relevant first.

## 5. Present, confirm, install

Present a plan table before touching anything:

```text
| Skill | Source | Concern | Scope | Why |
```

Plus a short "skipped" list (already installed / collision / over budget / alternative lost to a
preferred pick). Wait for explicit confirmation.

On confirmation, install **specific skills**, not whole repos:

```bash
npx skills@latest add <owner>/<repo> --skill <skill-name>
```

Group by source repo where the CLI allows multiple `--skill` flags; never use `--all` on a source
repo — that defeats the one-per-concern curation. After installing, verify the skills landed in
`skills-lock.json` and report the final state.

## Out of scope for this phase

- Sources outside the catalog (propose catalog additions via a PR to the-skills instead).
- Agents, hooks, and slash commands that some catalog repos also ship (e.g. addyosmani's personas) —
  mention they exist, but this phase installs skills only.
- Removing or updating installed skills (`npx skills@latest update -y` is the user's call).
