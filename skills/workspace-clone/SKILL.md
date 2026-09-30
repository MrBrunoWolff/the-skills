---
name: workspace-clone
description: Clone missing repositories from a user-supplied workspace manifest into a chosen checkout root. Use for fresh-machine or multi-repository setup; preserve existing checkouts and keep repository lists outside the skill.
---

# Clone a workspace

Use the caller's manifest and checkout root. This skill carries no repository
roster, organization, authentication configuration, or preferred branch names.

The manifest is a JSON object with `version: 1` and a `repositories` array. Each
entry contains a unique `name`, relative checkout `path`, and Git clone `url`.
Additional workspace fields are ignored. URLs must not contain credentials.
Use standard Git transports or local repositories; executable remote-helper URLs
are rejected. Review caller-provided manifests before running them.

```json
{
  "version": 1,
  "repositories": [
    {"name": "example", "path": "example", "url": "https://github.com/example/project.git"}
  ]
}
```

Run the bundled helper relative to this skill's location:

```sh
bun scripts/clone-workspace.ts --manifest /path/to/workspace.json --root /path/to/checkouts --dry-run
bun scripts/clone-workspace.ts --manifest /path/to/workspace.json --root /path/to/checkouts
```

Requires Git and Bun or Node 22.18+. For Node, replace `bun` with `node`;
the helper uses only Node standard-library APIs and needs no install step.

Use repeatable `--repo NAME` to restrict the operation to selected manifest
members. Preview when the user has not already specified the concrete scope;
an authorized setup request covers cloning the selected missing repositories.

The helper clones missing repositories on the remote's default branch. It
checks existing origins against the manifest and leaves those checkouts
untouched: no fetch, pull, reset, branch changes, dependency install, or cleanup.
A mismatched origin, invalid destination, or clone failure is reported and
produces a nonzero exit code. Interrupted runs can be retried; completed clones
are skipped. Do not remove a failed destination automatically.

Git authentication belongs to the machine's Git credential helper or SSH setup.
On authentication or network failure, report the affected repositories and
follow the execution environment's approval rules; do not embed tokens in URLs
or repeatedly retry unchanged failures.

After cloning, read each selected repository's own instructions and README to
determine tools, dependencies, environment variables, and validation commands.
Cloning alone does not make an application ready to run. The caller is
responsible for generating editor workspace files and installing agent skills.

The helper has offline tests using temporary local Git repositories:

```sh
bun test tests/clone-workspace.test.ts
node --test tests/clone-workspace.test.ts
```
