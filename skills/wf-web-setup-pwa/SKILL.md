---
name: wf-web-setup-pwa
description: Install or refresh the full PWA setup in a Next.js web repo — manifest.json, sw.mjs with build-time version injection, register-sw.js, theme-init.js, generated icons from a source SVG, layout.tsx wiring and the static-asset allowlist. Asks for the app name, short_name, description, theme colour and categories, then writes, generates and verifies.
---

# wf-web-setup-pwa — install or refresh a PWA

Sets up (or refreshes) every PWA artifact in a web repo so it matches the shape in
`[[wf-web-pwa]]`, which holds the complete file contents. This skill is the *action*; that one
is the *knowledge*. Do not re-derive the templates here.

## Preflight

Detect the package manager from the lockfile and abort if it is missing — never fall back to a
different one:

```bash
if   [ -f bun.lock ];          then PM=bun
elif [ -f pnpm-lock.yaml ];    then PM=pnpm
elif [ -f package-lock.json ]; then PM=npm
elif [ -f yarn.lock ];         then PM=yarn
else echo "No lockfile — run this inside a JS project."; exit 1
fi
command -v "$PM" >/dev/null 2>&1 || { echo "ERROR: $PM is required (this repo's lockfile is ${PM}'s)."; exit 1; }
```

Then confirm the repo is a Next.js app (`next` in dependencies) and has `src/app/layout.tsx`.
For a non-Next framework, the manifest / service worker / icon parts still apply but the
`layout.tsx` wiring does not — say so and adapt rather than writing Next-specific code into a
Vite or Workers app.

## What gets created

```
public/
├── manifest.json                # name, short_name <=12, theme/bg colour, 11 icons
├── sw.mjs                       # service worker, static + dynamic caches, version-busted
├── register-sw.js               # afterInteractive registration
├── theme-init.js                # data-theme bootstrap (mirror of the layout.tsx inline)
├── icons/
│   ├── favicon-{16,32,48}x{16,32,48}.png
│   └── icon-{72,96,128,144,152,192,384,512}x….png
└── logos/<brand>/
    └── logo.svg                 # source for icon generation — you supply this
scripts/
├── generate-pwa-assets.mjs      # sharp-based icon generator
└── inject-sw-versions.mjs       # injects APP_VERSION / BUILD_TIME / GIT_COMMIT
```

Plus: two `package.json` scripts, a `sharp` devDependency, the `layout.tsx` metadata block and
`<Script id="register-sw">`, and the static-asset allowlist entries if the app is gated.

## Inputs to ask the user

Use existing project values and the user’s choices. Ask only for missing details:

- **App full name** — e.g. "My App"
- **PWA `short_name`** — preferably ≤ 12 characters. Use supplied values; if their answer is
  longer, propose a shortened form rather than silently truncating.
- **Description** — one line.
- **Theme colour** — also the background colour; the two must match. Offer the repo's existing
  `--color-background` token as the default if `globals.css` has one, rather than inventing a
  hex.
- **Categories** — 1–3 from the manifest vocabulary, e.g. `["business"]`.

## Workflow

1. Preflight.
2. Confirm the repo shape (Next.js, `src/app/layout.tsx`).
3. Ask the inputs above.
4. **Source SVG check.** If `public/logos/<brand>/logo.svg` is missing, stop and ask the user to
   provide one. **Do not invent a placeholder logo** — generated icons are the app's identity
   in the launcher, and a placeholder that ships is worse than a blocked run.
5. Write every file from `[[wf-web-pwa]]` § *File templates*.
6. Add the two `scripts/` files.
7. Patch `package.json`: add `pwa:assets` and `inject-versions`; chain `inject-versions` onto
   `build`; add `sharp` to `devDependencies` if absent. Use the repo's own runner in the chain.
8. Patch `src/app/layout.tsx`:
   - `metadata.manifest = '/manifest.json'`
   - `metadata.icons` lists the favicon set and apple icons
   - `metadata.appleWebApp` is set
   - `viewport.themeColor` has a light/dark pair
   - `<Script id="register-sw" src="/register-sw.js" strategy="afterInteractive" />` is rendered
     (imported from `next/script`)
9. If the app has an auth gate, patch its static-asset predicate to allow every PWA path (see
   `[[wf-web-pwa]]` § *Static-asset allowlist*). Verify rather than assume — a gate that blocks
   `/sw.mjs` presents as a manifest bug.
10. Install (picks up sharp).
11. Generate the icons — all 11 PNGs from the source SVG.
12. Verify version injection in a temporary copy or save the pre-injection working
    file and restore only those generated values. Preserve authored changes; do not
    check out the entire file from Git. The committed worker keeps its placeholders.
13. Print the verification checklist:
    - [ ] `public/manifest.json` exists and its display name is usable
    - [ ] `theme_color === background_color`
    - [ ] all 11 icon PNGs present under `public/icons/`
    - [ ] `inject-versions` resolved all three placeholders — **then reverted**
    - [ ] `layout.tsx` references `/register-sw.js` and `/manifest.json`
    - [ ] lint and typecheck pass

## Non-negotiables

- Prefer a short display name; twelve characters is a starter convention.
- Include 192px and 512px ordinary icons. Maskable artwork is optional and must
  satisfy the safe-zone/background requirements in `[[wf-web-pwa]]`.
- **`{ type: 'module' }`** on the registration call, because `sw.mjs` is an ES module.
- **`sw.mjs` lives in `public/`**, not under `src/`, so it is served from the origin root with
  root scope.
- **The committed service worker keeps its placeholders.** A diff containing only the three
  injected version lines is a build artifact, not a change.

## Refreshing an existing setup

When the files already exist, this is a *diff*, not a rewrite:

- Show what would change before writing, and leave anything the repo has deliberately
  customised (extra `STATIC_ASSETS` entries, a different cache strategy, extra categories).
- Regenerate icons only if the source SVG changed — otherwise you produce a large, meaningless
  binary diff.
- Never overwrite `manifest.json` wholesale; patch the fields that are wrong.

## Cross-references

- `[[wf-web-pwa]]` — the file templates this applies
- `[[wf-web-create-repo]]` — calls this as part of a full bootstrap
- `[[wf-web-check-quality]]` — run after
- `[[wf-web-agentic]]` — the advisory agentic-readiness pass

User intent / overrides: $ARGUMENTS
