# IBM Bob Remediation Task: SpecFirst React A11y

**Task Id:** 1205ec3d-c715-4bdc-b391-74ce8769187c
**API Cost:** 0.69 Bobcoins
**Tokens:** ↑ 272.4k ↓ 3.4k
**Cache:** ↑ 24.9k ↓ 247.5k
**Size:** 156 kB
**Context Length:** 28.1k / 200k

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

Bob successfully located the project at `../../Documents/GitHub/SpecFirst-React-a11y/`, read all required files, and applied a patch to `ArrowComponentWithAria.tsx`. The patch fixed all 5 failing checks:

1. Fixed `aria-expanded` to use string "true"/"false" instead of boolean
2. Fixed `aria-activedescendant` to reference actual option IDs using `options[activeIndex].value`
3. Added Enter key handler to select active option and close popup
4. Added Escape key handler to close popup without changing selection
5. Fixed axe-scan by ensuring aria-activedescendant only set when popup is open

Bob ran Playwright tests, confirmed 10/11 passed, then fixed the remaining `keyboard-enter-selects` test by displaying option label instead of value in the trigger button. All 11 tests passed.
