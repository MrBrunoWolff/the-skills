---
name: wf-web-pwa
description: File templates for a production PWA setup in a Next.js app — manifest.json shape (8 PWA icons + 3 favicons, short display name, theme/background match), sw.mjs (explicit public-asset cache, stale-while-revalidate, version-busted via build-time placeholders), register-sw.js, theme-init.js, and the two scripts (generate-pwa-assets.mjs using sharp, inject-sw-versions.mjs). Knowledge only; the action is /wf-web-setup-pwa.
---

# wf-web PWA — canonical setup

The file templates for a PWA that installs cleanly in Chrome, survives deploys without serving
a stale shell, and does not flash the wrong theme on first paint.

Written against Next.js App Router. The manifest, service worker and icon rules are
framework-agnostic; only the `layout.tsx` wiring is Next-specific.

Throughout, `<brand>` is your logo directory under `public/logos/` and `<app>` your app's name.
Nothing here hardcodes either.

---

## File templates

### `public/manifest.json`

```json
{
  "name": "<App full name>",
  "short_name": "<=12 chars",
  "description": "<one-line description>",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0c1520",
  "theme_color": "#0c1520",
  "orientation": "portrait-primary",
  "scope": "/",
  "prefer_related_applications": false,
  "categories": ["business"],
  "icons": [
    { "src": "/icons/icon-72x72.png",   "sizes": "72x72",   "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-96x96.png",   "sizes": "96x96",   "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-128x128.png", "sizes": "128x128", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-144x144.png", "sizes": "144x144", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-152x152.png", "sizes": "152x152", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-384x384.png", "sizes": "384x384", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```

**Starter conventions:**

- Prefer a short display name; 12 characters is a starter convention, not a manifest validity limit.
- `theme_color === background_color`, and both match the splash background in `layout.tsx`.
  A mismatch is a visible flash on PWA launch.
- Include 192px and 512px ordinary icons. Add a separate maskable icon only after
  checking its safe zone and full background; no particular eight-size purpose split
  is required. See [manifest guidance](https://web.dev/articles/add-manifest) and
  [maskable icons](https://web.dev/articles/maskable-icon).

### `public/sw.mjs`

Use `__APP_VERSION__`, `__BUILD_TIME__`, `__GIT_COMMIT__` as **string placeholders**;
`scripts/inject-sw-versions.mjs` replaces them at build time.

> **The committed `sw.mjs` must always keep the placeholders.** Injection happens at build and
> deploy; the injected copy is a build artifact and must never be committed — committing it
> freezes the cache version and churns the file on every local build. After a local build,
> restore only the injected version values before committing, preserving authored edits. A `sw.mjs` diff consisting
> **only** of those three version lines is not merge-worthy.

```js
const APP_VERSION = '__APP_VERSION__';
const BUILD_TIME = '__BUILD_TIME__';
const GIT_COMMIT = '__GIT_COMMIT__';
const CACHE_VERSION = `${APP_VERSION}-${GIT_COMMIT}-${BUILD_TIME}`;
const CACHE_PREFIX = 'app-pwa-static-'; // Choose a stable prefix unique to this app.
const STATIC_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/favicon-48x48.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

// Only explicitly public assets are cached. Pages and API responses remain network-only.
const isCacheableRequest = (request) => {
  const url = new URL(request.url);
  return request.method === 'GET' && url.origin === self.location.origin &&
    !url.search && STATIC_ASSETS.includes(url.pathname);
};
const safeCacheResponse = async (cache, request, response) => {
  if (response.status !== 200 || response.redirected || !isCacheableRequest(request)) return;
  const control = response.headers.get('cache-control') || '';
  if (/private|no-store/i.test(control)) return;
  await cache.put(request, response.clone());
};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then(async (cache) => {
    for (const path of STATIC_ASSETS) {
      const request = new Request(new URL(path, self.location.origin));
      await safeCacheResponse(cache, request, await fetch(request));
    }
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE)
      .map(key => caches.delete(key)),
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (!isCacheableRequest(event.request)) return;
  const network = fetch(event.request).then(async response => {
    const cache = await caches.open(STATIC_CACHE);
    await safeCacheResponse(cache, event.request, response);
    return response;
  });
  event.waitUntil(network.then(() => undefined, () => undefined));
  event.respondWith(caches.open(STATIC_CACHE).then(async cache =>
    (await cache.match(event.request)) || network,
  ));
});
```

Add your own brand SVGs to `STATIC_ASSETS` if the shell renders them before first paint.

### `public/register-sw.js`

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.mjs', { type: 'module' }).catch((error) => {
      console.log('Service Worker registration failed:', error);
    });
  });
}
```

Wired in `layout.tsx`:

```tsx
import Script from 'next/script';
// inside <body>:
<Script id="register-sw" src="/register-sw.js" strategy="afterInteractive" />
```

`{ type: 'module' }` is required because `sw.mjs` is an ES module. And `sw.mjs` lives in
`public/` — not under `src/` — so it is served from the origin root and gets root scope.

### `public/theme-init.js`

```js
(() => {
  try {
    const theme = localStorage.getItem('theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
      return;
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } catch {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
```

This mirrors the inline `THEME_INIT_SCRIPT` in `layout.tsx`. The inline copy is what prevents
FOUC on the SSR'd shell; this public file is for static assets that load outside the framework
pipeline. Keep the two in sync — a drift between them is a flash nobody can reproduce on
demand.

### `scripts/generate-pwa-assets.mjs`

```js
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pwaSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const faviconSizes = [16, 32, 48];
const sourceSvg = path.join(__dirname, '../public/logos/<brand>/logo.svg');
const outputDir = path.join(__dirname, '../public/icons');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

async function run() {
  for (const size of pwaSizes) {
    await sharp(sourceSvg)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toFile(path.join(outputDir, `icon-${size}x${size}.png`));
    console.log(`generated icon-${size}x${size}.png`);
  }
  for (const size of faviconSizes) {
    await sharp(sourceSvg)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .toFile(path.join(outputDir, `favicon-${size}x${size}.png`));
    console.log(`generated favicon-${size}x${size}.png`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Ordinary icons may have a transparent background; maskable icons need a full background
and verified safe-zone artwork. Favicons get an
opaque one so they do not disappear against a dark browser chrome.

### `scripts/inject-sw-versions.mjs`

```js
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const getGitCommit = () => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'unknown'; }
};

const getAppVersion = () => {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')).version; }
  catch { return '0.0.0'; }
};

const replace = (content, key, value) => {
  const placeholder = new RegExp(`['"]__${key}__['"]`);
  const assignment = new RegExp(`(const\\s+${key}\\s*=\\s*)['"][^'"]*['"]`);
  return placeholder.test(content)
    ? content.replace(placeholder, `'${value}'`)
    : content.replace(assignment, `$1'${value}'`);
};

const swPath = path.join(process.cwd(), 'public', 'sw.mjs');
let sw = fs.readFileSync(swPath, 'utf8');
sw = replace(sw, 'APP_VERSION', getAppVersion());
sw = replace(sw, 'BUILD_TIME', Date.now().toString());
sw = replace(sw, 'GIT_COMMIT', getGitCommit());
fs.writeFileSync(swPath, sw);
console.log('injected versions into sw.mjs');
```

The two-branch `replace` is deliberate: it hits the placeholder on a clean tree and the
already-assigned value on a tree someone has built before, so a repeat build is idempotent
rather than a no-op that silently ships a stale cache key.

---

## `layout.tsx` wiring

Inside `metadata`:

```ts
manifest: '/manifest.json',
icons: {
  icon: [
    { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
  ],
  apple: [
    { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
  ],
},
appleWebApp: { capable: true, statusBarStyle: 'default', title: '<App full name>' },
```

And the viewport export:

```ts
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#0c1520' },
    { media: '(prefers-color-scheme: light)', color: '#f5f4f0' },
  ],
};
```

---

## `package.json` patch

```json
"scripts": {
  "build": "next build && bun run inject-versions",
  "pwa:assets": "node scripts/generate-pwa-assets.mjs",
  "inject-versions": "node scripts/inject-sw-versions.mjs"
},
"devDependencies": {
  "sharp": "^0.34.0"
}
```

Use whichever runner the repo's lockfile implies in the `build` chain (`bun run` / `pnpm` /
`npm run`) — do not introduce a second package manager here.

---

## Static-asset allowlist (for auth-gated apps)

If the app sits behind a password or login gate, the gate's static-asset predicate **must**
allow:

`/_next/…` · `/icons/…` · `/logos/…` · `/images/…` · `/favicon.ico` · `/manifest.json` ·
`/robots.txt` · `/theme-init.js` · `/sw.js` · `/sw.mjs` · and `/llms.txt` if you ship one
(see `[[wf-web-agentic]]`).

Otherwise service-worker registration is blocked behind the gate and Chrome never installs
the PWA — a failure that looks like a manifest problem and is not.

---

## Pre-flight checks before declaring done

- [ ] `short_name.length` ≤ 12
- [ ] `theme_color === background_color`
- [ ] All 11 icon PNGs exist under `public/icons/`
- [ ] `inject-versions` replaces the three placeholders locally (proves the regex hits) — then
      **discard that change**; the committed `sw.mjs` keeps the placeholders
- [ ] `<Script id="register-sw" …>` is in `layout.tsx`
- [ ] `metadata.manifest` is `'/manifest.json'`
- [ ] `viewport.themeColor` has a light/dark pair
- [ ] the static-asset allowlist covers `/sw.mjs`, `/manifest.json`, `/icons/`, `/theme-init.js`
- [ ] Chrome installability passes (DevTools → Application → Manifest)
- [ ] Agentic readiness reviewed (advisory) — `[[wf-web-agentic]]`

## Cross-references

- `[[wf-web-setup-pwa]]` — the command that applies all of this
- `[[wf-web-create-repo]]` — full repo bootstrap; this skill is the PWA slice
- `[[wf-web-check-quality]]` — run after PWA changes
