---
name: wf-web-lighthouse
description: Measure and improve Lighthouse performance, accessibility, best-practices, and SEO on production web builds. Configure Chrome DevTools MCP or use the CLI when browser audit tools are unavailable. Use for performance budgets and score regressions; exclude unit-only quality checks.
---

# Lighthouse on a production build

Read the project's instructions and scripts, build it, and use its documented production preview or an authorized deployed preview. Do not measure Vite/Next development mode and call it production performance. Record the URL, build/version, Lighthouse version, browser, mobile/desktop preset, throttling, and compression behavior.

Discover Chrome DevTools MCP tools before auditing. Project setup uses `npx -y chrome-devtools-mcp@latest` in `.mcp.json` and `[mcp_servers.chrome-devtools]` in `.codex/config.toml`. Keep existing server entries. An isolated browser profile avoids coupling audits to personal sessions. Restart the agent after configuration changes and verify the tools connected; a config file alone is not a live connection.

Run a Lighthouse audit through the available MCP tool and inspect traces, network requests, console errors, and accessibility snapshots. If that tool is unavailable, use the project's Lighthouse script or:

```sh
npx -y lighthouse@latest http://localhost:3000 --only-categories=performance,accessibility,best-practices,seo --output=json --output=html --output-path=./lighthouse/report
```

Use Chrome or Chrome for Testing. Headless CI can use `--chrome-flags=--headless`; add `--no-sandbox` only when the environment requires it. Keep mobile throttling as the default; audit desktop separately. Run three cold loads and retain the reports. Honor the project's score budget; this starter requires 100/100 in all four stable categories. Do not disable failing audits, hide real app content, switch presets, or fabricate results to satisfy a target.

Prioritize measured causes: LCP discovery and network chains, blocking CSS/JS, long tasks, font/image layout shifts, missing accessible names, contrast, metadata, and browser errors. Compare like builds under like conditions. Local Workers previews may serve uncompressed assets; report that limitation and validate production compression explicitly. A compression proxy must be identified as a local simulation, never described as a deployed audit.

For PWA apps, separately verify the manifest, correctly sized ordinary/maskable icons, service-worker activation, offline fallback, and update behavior. Keep API responses and authenticated HTML out of caches. PWA installability and experimental Agentic Browsing are separate from the four stable scores.

Sources: [Lighthouse CLI](https://github.com/GoogleChrome/lighthouse#using-the-node-cli), [performance scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring), [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp#quick-start).
