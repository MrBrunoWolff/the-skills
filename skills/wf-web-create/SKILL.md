---
name: wf-web-create
description: File inventory and templates for bootstrapping a new web repo — Next.js + React 19 + React Compiler + Tailwind 4 + bun, with oxlint/oxfmt/knip/react-doctor/vitest quality gates, a supply-chain-hardened bunfig, optional PWA scaffold and password gate, theming, and CI. Knowledge only; the action is /wf-web-create-repo.
---

# wf-web repo — canonical skeleton

The skeleton a new web repo starts from. This is the source of truth when scaffolding; the
action that applies it is `[[wf-web-create-repo]]`.

**Pick a reference repo.** If your fleet already has a repo you are happy with, read its
current state rather than trusting the versions pinned below — they age. Set `reference` in
`wf-fleet.json` (see `[[wf-web-list-fleet]]`) to name it, and diff against it when anything
here looks stale. The templates below describe *shape*; the reference repo carries *versions*.

---

## Stack

| Layer | Choice | When to use this starter |
|---|---|---|
| Package manager | **bun** | Use this Bun starter when requested. Other repositories may use their own managers. |
| Node engine | `"node": "24.x"` in `engines` | See the warning below — this field has a deployment side effect. |
| Framework | Next.js (App Router) with Turbopack | |
| React | 19 with the React Compiler (`reactCompiler: true`) | |
| Styling | Tailwind CSS 4 via `@tailwindcss/postcss` | |
| Lint | `oxlint` | |
| Format | `oxfmt` | |
| Dead code | `knip` | |
| Health | `react-doctor` | |
| Unit tests | `vitest` (jsdom) | Component specs need a DOM; a runner without one fails on `document`. |
| E2E | Playwright (optional per repo) | |
| Deploy | Vercel or Cloudflare Workers | Detected from `.vercel/project.json` or `wrangler.jsonc`. |

Use each repository’s declared toolchain for existing projects. Shared workspace
commands resolve those differences rather than requiring a single stack.

> Check deployment runtime support
> Choose the Node engine and runtime from the deployment target’s current documentation.
> Keep the Bun package-manager version in `packageManager`. Verify platform configuration
> fields against its schema; do not infer runtime support from an old build-image failure.

## File inventory

### Root config

| File | Notes |
|---|---|
| `package.json` | Template below |
| `bunfig.toml` | **Supply-chain guards — template below. Do not skip this one.** |
| `tsconfig.json` | strict, bundler resolution, `@/*` → `./src/*` |
| `next.config.ts` | React Compiler + optional bundle analyzer |
| `postcss.config.mjs` | Tailwind 4 postcss plugin |
| `.oxlintrc.json` | with `ignorePatterns` for agent dirs |
| `.oxfmtrc.json` | with `ignorePatterns` for agent dirs |
| `knip.json` | project globs excluding agent dirs, `public/`, `scripts/` |
| `doctor.config.json` | `ignore.files` for agent dirs and `public/` |
| `vitest.config.ts` | jsdom environment, globs `src/**/*.test.{ts,tsx}` |
| `vercel.json` *or* `wrangler.jsonc` | whichever platform; see below |
| `.gitignore`, `README.md` | |
| `AGENTS.md` | the framework warning block below |
| `CLAUDE.md` | single line: `@AGENTS.md` |

### CI — `.github/`

- `workflows/ci.yml` — one quality job: install → audit → check → test → doctor
- `CODEOWNERS`, `pull_request_template.md`
- optionally `workflows/zizmor.yml` — workflow security audit

### App source — `src/`

- `app/layout.tsx` — root layout: inline theme-init script, inline splash CSS, ThemeProvider,
  fonts via `next/font`
- `app/page.tsx`, `app/globals.css` — Tailwind 4 imports plus design tokens under `[data-theme]`
- `app/components/ThemeProvider.tsx`, `ThemeSwitch.tsx`
- `components/ui/LoadingScreen.tsx` — SSR'd splash overlay
- `site.ts` — the single canonical origin, if the app emits absolute URLs (see below)
- **If gated:** `lib/auth.ts` + `proxy.ts` + `app/auth/` — see *Optional: password gate*

### PWA — `public/` + `scripts/`

Delegate to `[[wf-web-setup-pwa]]`. Skip entirely for a library or an internal tool nobody
installs.

### Tests — `src/**/*.test.ts(x)`

At least one real test. A repo whose test script exits 0 because it found no tests has a green
CI badge and no test gate — which is worse than no badge.

---

## Templates

### `bunfig.toml` — the supply-chain guards

```toml
[install]
# Refuse to install npm versions published less than 3 days ago.
# Defence against supply-chain attacks.
minimumReleaseAge = 259200

# Never run lifecycle scripts (postinstall etc), for dependencies or this package.
ignoreScripts = true
```

Both lines earn their place:

- **`minimumReleaseAge`** is why a compromised package published an hour ago does not reach
  your machine. It means `bun update --latest` may resolve *below* a package's `latest` tag —
  that is the guard working, **not** a bug or a stale cache. Do not work around it. Add your
  own scopes to `minimumReleaseAgeExcludes` if you publish internally and want your own
  releases adopted immediately.
- **`ignoreScripts`** blocks the main execution vector a malicious package has at install time.
  If a legitimate dependency genuinely needs its postinstall, run that one explicitly rather
  than opening the gate for every package in the tree.

If the repo's unit tests run on vitest rather than bun's native runner, also scope bun's runner
so a bare `bun test` does not run DOM specs in a DOM-less environment:

```toml
[test]
root = "scripts/bun-test"   # a single spec that delegates to vitest and exits with its status
```

### `package.json`

```json
{
  "name": "<repo-name>",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build --turbopack",
    "build:analyze": "ANALYZE=true next build --turbopack",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "format": "oxfmt --write . '!.agents/**' '!.claude/**'",
    "format:check": "oxfmt --check . '!.agents/**' '!.claude/**'",
    "knip": "knip",
    "doctor": "bunx react-doctor -y .",
    "check": "bun run --parallel --no-exit-on-error lint format:check typecheck knip",
    "test": "vitest run",
    "test:watch": "vitest",
    "audit": "bun audit --audit-level=high"
  },
  "dependencies": {
    "next": "<exact>",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "*", "@types/react": "*", "@types/react-dom": "*",
    "babel-plugin-react-compiler": "^1",
    "jsdom": "*", "knip": "*", "oxfmt": "*", "oxlint": "*",
    "postcss": "*", "react-doctor": "<exact>", "tailwindcss": "^4",
    "typescript": "*", "vitest": "*"
  },
  "engines": { "node": "24.x" },
  "packageManager": "bun@<version>"
}
```

Four things in there are deliberate:

- **`check` runs the fast gates in parallel with `--no-exit-on-error`**, so one command gives
  the complete picture instead of stopping at the first failure. CI and `[[wf-web-check-quality]]`
  both lean on it.
- **`audit` is its own script** at `--audit-level=high`, so the advisory gate is a real CI step
  rather than something remembered occasionally.
- **`next` is pinned exactly**, and `@next/*` packages (`bundle-analyzer`, `playwright`) move in
  lockstep with it. A minor drift between them produces type errors that look like your code.
- **`react-doctor` is pinned exactly.** It is a scoring tool; an unpinned bump changes the score
  without changing the app, and then a PR gate fails for no reason anyone can act on.

### `vercel.json`

```json
{ "framework": "nextjs", "installCommand": "bun install --frozen-lockfile" }
```

Never a `bunVersion` key. For a Cloudflare Workers app there is no `vercel.json` — the deploy
contract lives in `wrangler.jsonc` and a `deploy` script.

### `next.config.ts`

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  compiler: { removeConsole: process.env.NODE_ENV === 'production' },
  reactCompiler: true,
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
```

Add the bundle analyzer behind `process.env.ANALYZE === 'true'` via `@next/bundle-analyzer`
rather than a hand-rolled webpack branch — Turbopack builds do not run a webpack config.

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true, "skipLibCheck": true, "strict": true, "noEmit": true,
    "esModuleInterop": true, "module": "esnext", "moduleResolution": "bundler",
    "resolveJsonModule": true, "isolatedModules": true, "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "next.config.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### The agent-dir exclusions — four configs, four places

Vendored agent skills ship real `.js` / `.mjs` / `.ts` files. If they are not excluded, they are
linted, type-checked, counted as dead code and scored — and a repo's health score drops for code
it does not own. **Each tool reads its own config; none of them read another's.**

| Tool | Config | Key |
|---|---|---|
| oxlint | `.oxlintrc.json` | `ignorePatterns` |
| oxfmt | `.oxfmtrc.json` | `ignorePatterns` |
| knip | `knip.json` | negated `project` globs |
| react-doctor | `doctor.config.json` | `ignore.files` |

Exclude `.agents/**`, `.claude/**`, `.cursor/**`, `.github/skills/**` in all four, plus
`public/**` and `scripts/**` where relevant. **A repo with no `doctor.config.json` at all will
score badly** the moment a vendored skill ships linty code; the tell is that every deduction
points inside `.agents/skills/…`.

```json
// doctor.config.json
{ "scope": "full", "lint": false,
  "ignore": { "files": ["public/**", "**/.agents/**", "**/.claude/**", "**/.cursor/**"] } }
```

### `AGENTS.md`

```markdown
<!-- BEGIN:nextjs-agent-rules -->
# Read the installed Next.js documentation

This version has breaking changes — APIs, conventions, and file structure may all differ from
your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing
any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
```

`CLAUDE.md` is one line: `@AGENTS.md`.

### `src/site.ts` — one canonical origin

Any app that emits absolute URLs (canonical tags, `hreflang`, sitemap, Open Graph) needs
exactly one place that names its origin:

```ts
// The single canonical origin for the site. Everything absolute derives from this.
export const SITE_URL = 'https://www.example.com';
```

Get the `www`-vs-apex choice right and keep it here. If the host 308-redirects the apex to
`www`, every absolute URL must name `www` — a canonical pointing at the apex while the page is
served from `www` fails Lighthouse's canonical audit, and any framework that builds alternate
links from the *request* host will emit a second, conflicting set.

---

## Optional: password gate

For preview deployments that are not behind platform SSO. Skip it for a public site.

`src/lib/auth.ts`:

```ts
export const AUTH_COOKIE_NAME = 'app-auth-token';

export function getAppPassword() {
  return process.env.APP_PASSWORD?.trim() ?? '';
}

export async function hashPassword(password: string) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}

export function isStaticAssetPath(pathname: string) {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/logos/') ||
    pathname.startsWith('/images/') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/robots.txt' ||
    pathname === '/theme-init.js' ||
    pathname === '/sw.js' ||
    pathname === '/sw.mjs'
  );
}
```

`src/proxy.ts` contract:

1. Require `APP_PASSWORD` when the deployed preview gate is enabled. Missing configuration
   fails closed; local development may disable the gate explicitly.
2. Pass through `/auth`, the auth API routes, and `isStaticAssetPath` matches.
3. Compare the `AUTH_COOKIE_NAME` cookie against `await hashPassword(getAppPassword())`.
4. API mismatch → JSON 401. Page mismatch → redirect to `/auth?returnTo=<original>`.
5. Set an `x-pathname` header on forwarded requests so the layout can suppress the splash on
   `/auth`.

**This is a soft gate**, not authentication: one shared password, no users, no sessions beyond
the cookie. It keeps previews out of search results and away from casual visitors. Do not put
anything behind it that would matter if the password leaked.

Test it (`AUTH_COOKIE_NAME`, `getAppPassword` trimming and empty default, `hashPassword`
producing 64 hex chars, `isStaticAssetPath` true for `/icons/x.png` / `/sw.mjs` /
`/manifest.json` and false for `/`, `/auth`, `/api/private.txt`, and `/account/export.js`). It is the one piece of security surface in the
repo, and the test is what stops a refactor quietly opening it.

---

## Generation order

1. Preflight — abort if the package manager is missing.
2. Create the repo dir, `cd` in.
3. Write root configs, **including `bunfig.toml` before the first install** — the release-age
   and `ignoreScripts` guards must be in force for the very first dependency fetch, not added
   afterwards.
4. Write CI.
5. Write the `src/` tree.
6. Invoke `[[wf-web-setup-pwa]]` for `public/` and `scripts/`, if the app wants a PWA.
7. `bun install`.
8. Generate PWA icons, if a source logo is in place.
9. `git init`, stage, **do not commit** — let the user review.

## Cross-references

- `[[wf-web-create-repo]]` — the command that applies this
- `[[wf-web-setup-pwa]]` — the PWA slice
- `[[wf-web-check-quality]]` — the gates this skeleton wires up
- `[[wf-web-list-fleet]]` — the fleet registry a new repo joins
