# Headless protocol and scenarios

Choose a transport suited to the app. The minimal transport is one JSON request
and one response per line, in a long-lived native process. No prompts or banners.
Compile runners before starting the scenario suite. Keep discovered absolute
binary paths in ignored machine-local files and regenerate them after moves.

A useful small command vocabulary is:

- `ls`: discover the focused feature, current state and action names/schemas.
- `vm`: read a feature snapshot.
- `do`: dispatch a typed UI action; 200 applied, 400 invalid payload, 409 refused.
- `reset`: reconstruct the headless host from explicit fixtures.

The numbers are response statuses carried in JSON; an HTTP server is optional.
Do not claim a protocol version or action schema exists until implemented.
Multiple native runners can share a session driver without sharing their domain
models or requiring identical platform-specific UI components.

```js
import { Session } from './session.mjs';
const core = new Session(['/absolute/path/to/native-runner'], { cwd: projectRoot });
try {
  const discovery = await core.request({ command: 'ls' });
  // Use the commands and payloads actually advertised by this app.
  console.log(discovery);
} finally {
  await core.close();
}
```

The driver accepts an optional `timeoutMs` (default five seconds). It serializes
requests over one process, parses responses in order and terminates the session
on timeout, malformed output, unexpected output, spawn failure or early exit.
Bound stdout and stderr so a faulty runner cannot grow the host indefinitely.
Build commands do not belong in this response timeout.

Use named journeys with literal expected state at meaningful checkpoints.
Compare the same checkpoints across the native targets. Merely comparing two
snapshots can miss matching bugs. Keep invalid input separate from action
availability: a correctly typed action for a hidden control is refused by the
core, while a misspelled payload is rejected by the adapter before dispatch.

For navigation, test a covered screen, a back action at the root, details-to-open,
removal cancellation and stale IDs after a catalog change. For async features,
exercise initial load, failure before data, stale data, retry and cancellation.
For persistence, reconstruct with the same fixture storage and prove the relevant
state survives; a reset that replaces storage cannot establish persistence.

Document the boundary of each scenario. A fixture catalog proves navigation;
it does not prove ZIP extraction, signature verification, platform authorization,
network isolation, real persistence or pixels. Keep those in their own tests.
