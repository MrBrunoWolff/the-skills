# Reusable native engineering patterns

Use the existing project stack. SwiftUI and Compose apps can share behavioral
contracts while retaining separate native implementations. Keep JavaScript build
tools in tooling when they are used for generation, tests or asset conversion;
do not add a runtime bridge merely to share test code.

## Contracts and generated assets

Give shared data shapes and screen behaviors one explicit source of truth. Use
the app's declared schemas to generate Swift/Kotlin models where appropriate.
Check regeneration for drift. Freeze representative domain outputs as golden
fixtures and assert them on both native cores. Changing an expected result
requires understanding why the product behavior changed.

For tokens, derive native palettes, typography and spacing from the project's
actual canonical design contract. Preserve platform accessibility, dynamic text,
dark mode, localization, insets and back behavior. Keep visual review and a small
screenshot/device suite alongside behavior tests; shared JSON does not establish
pixel or accessibility parity.

## Dependencies and toolchains

Inspect three independent dependency sets: tooling/package-manager dependencies,
Swift packages/Xcode, and Android catalog/Gradle. Updating one does not update the
others. Read the project's release-age policy and use one captured cutoff. Check
release dates from official publishers/Maven; unknown or inaccessible metadata
means unresolved, not up to date. Report held majors and existing prereleases.

AGP's built-in Kotlin support and Kotlin plugins need a coherent compiler
classpath. Inspect the selected AGP's supported configuration, keep Compose and
serialization plugins aligned with the chosen Kotlin version, and verify the
resolved Gradle build environment after moves. Do not assume AGP's transitive
Kotlin version is a strict pin. Run Android unit tests, lint and a real build.
Update the wrapper through its supported task and retain its checksum policy.

Use the project's stable Xcode selection, not an incidental beta default. Build
and test local packages headlessly, then compile/analyze the mobile target with
its real dependencies and simulator destination. Report unavailable tools or
SDKs rather than substituting source inspection for a build. Keep signing keys,
store uploads and production configuration separate from local verification.

## Device feedback

Drive the same feature state/action surface on devices only when a debug adapter
is needed. Restrict access and compile it out of releases. Inject fake clocks and
service fixtures rather than depending on wall time, live prices or production
accounts. Keep device scenarios reversible and preserve a user's installed data.
Use platform accessibility identifiers and test tags for the remaining visual
flows. A native build passing does not prove a device journey was exercised.

## Adoption

Record the initial slice, existing public commands, shared fixture ownership,
platform-specific exceptions and untested boundaries in the caller's own docs.
Teach its agents the actual run/build/scenario commands in app-local guidance.
Extend a tested slice rather than forcing a whole-app rewrite to match a diagram.
The architecture and state/action contract are reusable; product rules, API
endpoints, branding, private rosters and credentials are caller-owned.
