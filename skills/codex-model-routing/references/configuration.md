# Configuration and verification

Optional caller-owned settings:

```json
{
  "profile": "workspace",
  "models": {
    "main": { "model": "account-main-model", "effort": "medium" },
    "fast": { "model": "account-fast-model", "effort": "low" },
    "deep": { "model": "account-deep-model", "effort": "high" },
    "mechanical": { "model": "account-fast-model", "effort": "medium" }
  },
  "excluded_roots": ["../other-workspace"]
}
```

The model strings above are placeholders, not usable model IDs. Choose IDs from
Codex's signed-in account catalog. Without explicit preferences, main uses the
current user-config model when available, fast prefers a selectable Luna/mini/nano
model, and deep prefers a selectable Astra model. When a preferred family is
unavailable, it uses main. These are selection heuristics, not a price comparison;
review the generated choices. Efforts are checked against model capabilities.

The root and Codex home are discovered at installation time, never committed
into the skill. The installer generates three `<profile>*.config.toml` files,
three `<profile>-*.toml` custom agents and `<profile>-model-routing/` containing
the runtime and its local settings. It copies files rather than symlinking a
whole config directory. Repeating an unchanged setup is a no-op. A changed
source or caller preference refreshes those managed files with timestamped
backups and diffs; put lasting preferences in the caller's settings file.

The local runtime's `scripts/routing.json` describes the scope and tier mapping.
Search maps to fast, implementation to main and judgment to deep. The mechanical
role uses its own pin. Custom-agent pins take precedence over explicit spawn
model values in the verified CLI. Parent permission overrides can supersede an
agent's read-only defaults; do not treat these agents as a security boundary.

Launch with `codex -p <profile>`, `codex -p <profile>-fast`, or
`codex -p <profile>-deep`. Plain `codex` retains the original defaults. A profile's
main-model choice applies wherever it is launched; use it in its intended
workspace. The routing tool checks canonical root membership at startup and per
request. This prevents accidental routing outside the root; it cannot detect
unrelated material pasted into an otherwise eligible brief.

Profiles forward environment variable names, not values: `TYPESAFE_API_KEY`,
`JEV_API_KEY`, `AGENT_ROUTER`, `AGENT_ROUTER_MIN_CONFIDENCE`, `AGENT_ROUTER_LOG`.
No secrets are saved. `AGENT_ROUTER_MIN_CONFIDENCE` defaults to 0.8. An optional
decision log contains tier/confidence/latency and a short description, not full
briefs or API errors. Descriptions can still be private. Missing-key/off/skipped
calls do not log. Disable Jev with `AGENT_ROUTER=off`; this retains typed roles.
Omit the profile to disable its routing instructions and MCP. Remove the three
prefixed files from `agents/` if custom-agent availability should also disappear.

After installation, run each profile with a tiny prompt and check the CLI's
reported model/effort. Ask for each typed agent on a bounded task. For Jev, ask
for one default-agent delegation after `choose_model`, and inspect the child's
transcript for the observed model. Repeat without either key; it should inherit
the parent settings and produce no routing log. Check the off switch too.
Existing sessions do not acquire newly installed profile instructions. Verify
editor activation separately; CLI verification does not establish editor behavior.

The installed runtime has benchmark and extraction helpers:

```sh
node /path/to/runtime/scripts/benchmark.mjs
node /path/to/runtime/scripts/extract-prompts.mjs
node /path/to/runtime/scripts/benchmark.mjs \
  --input /path/to/runtime/private/workspace-prompts.json \
  --output /path/to/runtime/private/workspace-benchmark.json
```

Benchmarks make real TypeSafe requests, three runs by default. The 36 bundled
short tasks are synthetic; criterion examples do not duplicate them. Report
accuracy, confidence coverage, confusion matrix and latency without claiming
real-world performance from these fixtures. History extraction is local, skips
explicit models, typed agents, encrypted task bodies and configured excluded-root
references, and does not interpret spawn calls embedded in programmatic code.
Review extracted briefs before sending them externally. Unlabelled real briefs
support distributions and coverage, not accuracy. If only encrypted messages are
available, report the benchmark as unavailable rather than classify ciphertext.

Current official documentation:

- [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Custom agents and precedence](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Hook contract](https://learn.chatgpt.com/docs/hooks)
- [TypeSafe API schema](https://api.typesafe.ai/openapi.json)

Hook input rewriting currently requires `permissionDecision: "allow"`; the
adviser avoids that contract to preserve normal approvals. Recheck CLI help and
official docs before adapting the installer to a different configuration format.
