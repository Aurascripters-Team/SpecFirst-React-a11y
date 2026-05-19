# IBM Bob Remediation Task: SpecFirst React A11y

**Task Id:** fb92abfe-1340-4169-b675-c002260e8533
**API Cost:** 0.31 Bobcoins
**Tokens:** ↑ 122.1k ↓ 1.9k
**Cache:** ↑ 22.7k ↓ 99.3k
**Size:** 134 kB
**Context Length:** 25.4k / 200k

## Target component

`tests/fixtures/ArrowComponentWithAria.tsx`

## Locked spec

`specfirst/runs/2026-05-17T13-09-47-843Z-analyze/lockedSpec.json`

Locked spec hash:

`sha256:66bacb92a464ccd9716b7a554e8a50f5ee5c02f286351f6b0d3da14171d61cb7`

## Generated test file

`tests/a11y/Picker.spec.ts`

Bob must not edit this file.

## Generated harness

`src/specfirst-demo/generated/PickerHarness.tsx`

Bob must not edit this file.

## Baseline result

Status: `red-confirmed`

Failed checks:

1. `expanded-state`
2. `keyboard-arrow-down-opens`
3. `keyboard-enter-selects`
4. `keyboard-escape-closes`
5. `axe-scan`

## Session summary

Bob read the locked spec, listed the workspace files, and located the project at `../../Documents/GitHub/SpecFirst-React-a11y/`. Bob read the component, locked spec, test file, and harness, then applied fixes to `ArrowComponentWithAria.tsx`. The patch addressed all 5 failing checks. The user denied the apply_diff operation and the patch was not saved.
