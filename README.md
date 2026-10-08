# the-skills

Reusable [agent skills](https://skills.tools) for repository setup, workspace cloning, dependency maintenance, quality checks and reviews, installable with the [skills CLI](https://github.com/vercel-labs/skills).

[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

## Quick start

```bash
# a specific skill
npx skills@latest add MrBrunoWolff/the-skills --skill agent-setup

# list what's available
npx skills@latest add MrBrunoWolff/the-skills --list

# everything
npx skills@latest add MrBrunoWolff/the-skills --all
```

Use Node.js/npm for `npx`, or the equivalent `bunx skills@latest add ...` commands with Bun. Install only the workflows you need; private repository rosters and credentials stay with the caller.

## Features

- Manifest-based workspace cloning that preserves existing checkouts.
- Stack-aware agent setup and dependency maintenance.
- Repository inventory, quality checks, security reviews and pull-request workflows.
- Web performance, PWA and browser verification guidance.

## Development

See the [skills and agent catalog](docs/catalog.md) for individual workflows, installation details and repository layout. [skill-sources.md](skill-sources.md) records curated upstream sources. Agent definitions require a separate manual install; the CLI installs skills.

Each skill has its own `SKILL.md` with name and description frontmatter. Preserve its interface, validate local links and run tests for changed executable helpers. Follow [AGENTS.md](AGENTS.md) when contributing.

## License

MIT — see [LICENSE](LICENSE).
