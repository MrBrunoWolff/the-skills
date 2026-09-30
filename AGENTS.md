# Maintaining the skills repository

This is a public, installable skill collection. Keep private workspace rosters,
organization-specific conventions, credentials, local paths, and scan reports out
of publishable files. Put repository lists in caller-owned manifests.

Read the current skill and its callers before changing a workflow. Preserve skill
names and installed interfaces unless the user requests a migration. Match current
official tool documentation; do not turn an old observed bug into a universal rule.
Keep each installed skill self-contained, with supporting files under its directory.

Write plain English. Lead with concrete behavior and why it matters; use active
verbs, short paragraphs, and relevant examples. Avoid decorative emoji, slogans,
all-caps emphasis, repeated warnings, and invented requirements. Put exact versions
in validation notes or bodies rather than incidental commit/PR titles. Omit AI
attribution unless requested and preserve human authorship requirements.

Respect the user's existing authorization. Ask only for missing decisions; do not
create an approval loop around work already requested. Preserve unrelated work,
use explicit staging paths, and leave commits/pushes to the requested scope.

For a release review, validate every skill's frontmatter and local links, run tests
for executable helpers, inspect the full diff and index, and scan both publishable
files and Git objects for secrets/private context. Keep tool output redacted.
Local security tooling belongs under ignored .deepsec/. Do not publish findings.
