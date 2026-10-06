# Quality validation

Run `node scripts/quality.mjs` before committing or opening a PR. CI runs the
same dependency-free metadata and syntax checks and existing helper tests. No application build or package audit applies
to this repository. Use Bun 1.4.2 for helper tests and Node 24 for scripts.
