# Quality gates — per-stack guardrails reference

Canonical "run before you commit" checks per stack. Phase 2b detects which of these the repo
**actually has** (scripts in `package.json`, config files, dev-deps), writes the real commands into
the repo's `CLAUDE.md` under `## Quality gates`, and flags any **core** gate that's missing so the
user can add it.

Prefer the repository's declared `check:ci` (or equivalent) as the canonical pre-commit
and pre-PR contract. Read the script and its configuration before running it. Run a frozen
install with the repository's pinned package manager/runtime, then execute the same stages
CI executes. A successful fast `check` does not establish that tests, builds or security pass.
Keep validation non-mutating; run formatter/lint fix commands separately.

Choose depth from the project's role, not just its framework:

- **Quick templates:** static checks, existing unit tests and a small build; avoid application
  browser matrices. Preserve browser setup if existing component tests require it.
- **Rich tools/labs:** static checks, tests, production build/package validation and applicable
  diagnostics. Keep paid model calls and live server tests opt-in.
- **Full products/presence sites:** rich validation plus production browser checks, local data
  fixtures, failure artifacts, and the product's native checks on their required platforms.
- **Metadata/skills repositories:** validate manifests, skill frontmatter, helper syntax/tests;
  do not invent application builds or dependency audits when no package dependencies exist.

Where installed, require zero lint warnings/errors and zero Knip findings/configuration hints.
React Doctor should complete its full scan and return 100/100 with no warnings/errors;
an unavailable score does not establish success. Distinguish a custom project Doctor from
React Doctor and do not apply React diagnostics to a non-React application. Keep generated
and vendored exclusions narrow and documented; fix application findings instead of hiding them.

Code, security and browser/native validation should run independently in CI, with a stable
required aggregate that fails on failure, cancellation or unexpected skips. Scheduled audits
maintain the default-branch baseline; they supplement PR security checks. Preserve package-age
holds and documented advisory exceptions. Templates should inherit the same contract.

The stack tables below help discover available gates when no canonical contract exists.
Only list real commands, explicitly flag missing coverage, and never claim an unrun check passed.

## Web / Next.js (the Vercel default)

| Gate | Tier | Command (use the repo's actual script if defined) | Detect via |
|------|------|---------------------------------------------------|------------|
| lint | core | `bun run lint` (oxlint / eslint) | `lint` script, `oxlint`/`eslint` dep, `eslint.config.*` |
| typecheck | core | `bunx tsc --noEmit` (or `bun run typecheck`) | `typescript` dep, `tsconfig.json` |
| react-doctor | core | `bunx react-doctor -y .` (or `bun run doctor`) | `react` dep — always relevant for React/Next |
| knip (dead code) | optional | `bun run knip` | `knip` dep / `knip.*` config |
| build | optional | `bun run build` | `build` script — heavier; gate before push, not every edit |

> Use the cheap lint/typecheck loop while editing. Before committing or opening a PR, run
> the complete declared contract, including formatting, tests, build and security.

## Node backend (express / fastify / nest)

| Gate | Tier | Command | Detect via |
|------|------|---------|------------|
| lint | core | `bun run lint` | `lint` script, eslint/oxlint |
| typecheck | core | `bunx tsc --noEmit` | `typescript` dep |
| test | core | `bun test` / `bun run test` | `test` script, vitest/jest dep |

## Python

| Gate | Tier | Command | Detect via |
|------|------|---------|------------|
| lint | core | `ruff check` | `ruff` in deps / `ruff.toml` / `[tool.ruff]` |
| format check | core | `ruff format --check` | same |
| typecheck | core | `mypy .` or `ty check` | `mypy`/`ty` dep, `[tool.mypy]` |
| test | core | `pytest` (or `uv run pytest`) | `pytest` dep, `tests/` |

## Rust

| Gate | Tier | Command | Detect via |
|------|------|---------|------------|
| format check | core | `cargo fmt --check` | `Cargo.toml` |
| lint | core | `cargo clippy -- -D warnings` | `Cargo.toml` |
| test | core | `cargo test` | `Cargo.toml` |

## Go

| Gate | Tier | Command | Detect via |
|------|------|---------|------------|
| format check | core | `gofmt -l .` | `go.mod` |
| vet | core | `go vet ./...` | `go.mod` |
| lint | optional | `golangci-lint run` | `.golangci.*` |
| test | core | `go test ./...` | `go.mod`, `*_test.go` |

## iOS / Swift

| Gate | Tier | Command | Detect via |
|------|------|---------|------------|
| lint | optional | `swiftlint` | `.swiftlint.yml` |
| build | core | `swift build` or `xcodebuild build` | `Package.swift` / `*.xcodeproj` |
| test | core | `swift test` or `xcodebuild test` | `Tests/` / scheme |

## Android / Kotlin

| Gate | Tier | Command | Detect via |
|------|------|---------|------------|
| lint | core | `./gradlew lint` (+ ktlint/detekt if present) | `build.gradle*`, `.editorconfig` |
| test | core | `./gradlew test` | `build.gradle*`, `src/test/` |

## What Phase 2b writes into CLAUDE.md

A `## Quality gates` section like (web example, using the repo's real scripts):

```markdown
## Quality gates

Run the repository’s canonical contract before every commit or PR:

1. `bun install --frozen-lockfile`
2. `bun run check:ci`  # exact CI stages; inspect their results

Use the repository's fix commands separately if validation finds formatting/lint issues.

Never commit with a failing gate. If a gate is genuinely wrong (false positive), fix the rule or
the config — don't skip the gate or weaken it to pass.
```

Tailor commands to what the repo defines; only list gates the repo actually has, and separately
tell the user which **core** gates are missing (e.g. "no typecheck script — add `tsc --noEmit`?").
