---
name: native-behavior
description: Build or extend fully native SwiftUI and Kotlin/Compose apps with a platform-free core, agent-readable state/actions, headless Swift/JVM behavior scenarios and native parity checks. Use for Reflex-style architecture and testing; preserve an existing app's runtime and platform boundaries.
---

# Native behavior from the terminal

Make the app's actual behavior executable without rendering its UI. Apply
[Shopify's Reflex architecture](https://shopify.engineering/reflex): a native core
per platform, thin native views, and one scenario suite against both cores.
Reflex is an architectural pattern, not an SDK to install.

## Choose a bounded feature

Read the app's instructions, platform versions, build files and existing tests.
Find a small real journey whose state or navigation currently lives in a view.
Extract that logic into a plain Swift package and a Kotlin/JVM module. Both the
mobile app and a separate headless executable must depend on that same core;
a second implementation created only for tests establishes no app coverage.
Keep the existing deployment targets and supported runtimes. A native host for
web or WASM packages remains such a host: this workflow does not authorize
loading arbitrary native executables or adding general JavaScript bridges.

Views read state and send typed actions. One reducer owns each feature's state
changes. Pass storage, networking, clock and platform capabilities through
explicit interfaces when the selected feature needs them. SwiftUI, UIKit,
Android SDK and Compose imports belong outside the core. For a navigation-only
slice, pass a catalog of domain values rather than moving archive or device IO.

## Expose and exercise the core

Use a separate introspection adapter for JSON state, action descriptions and
strict payload validation. Keep business rules in the core. The adapter calls
the same `send` path as the UI and reports a refused action without mutation.
Keep credentials and personal data out of snapshots and fixtures.

Start with a persistent newline-delimited JSON process over stdin/stdout. Reserve
stdout for responses and flush each one; send diagnostics to stderr. Discover
state and actions, dispatch an action, then inspect fresh state. For asynchronous
features, add bounded settle/condition support and report the last observed state
on failure; do not use fixed sleeps. Validate unknown keys, payload types and
unsupported actions. Keep fixture/reset commands outside the app's public API.

The reusable [session driver](scripts/session.mjs) accepts an executable argument
array and working directory. It manages persistent processes, response deadlines,
protocol failures and cleanup without a shell or third-party dependencies.
Copy it into the caller's maintained harness when useful; record its producer
and resync it deliberately. See [the protocol](references/protocol.md) for usage.

Run the same journey against both native targets and assert expected outcomes
as well as cross-platform equality. Include focused navigation, cancellation,
empty/error/loading states, invalid input and any selected persistence behavior.
Keep clocks, IDs, fixtures, field names, explicit nulls and number encoding
consistent. For features with IO, enforce fixture-only networking at the host
boundary and fail the test on an attempted live request even if caught by the app.
A core with no IO capability needs no network mock.

## Keep native delivery intact

Read [native engineering](references/native-engineering.md) when adapting build,
contract-generation, dependency or device workflows. Test Swift/JVM behavior
first, then compile the actual apps and run their existing native checks. Retain
small device/visual tests for rendering, accessibility, permissions, WebViews,
platform storage and other boundaries a headless suite cannot establish.

Keep runners and test SDKs as separate products, outside mobile dependencies.
If adding live-device introspection, bind only to loopback, restrict it to debug
builds, and verify its absence in built release artifacts. Do not add a live
server solely to create headless tests. State exactly which features and targets
were exercised; a first slice is not a completed application-wide migration.
Store/store-upload, signing, deployment, commits and pushes retain the caller's
existing authorization boundaries.
