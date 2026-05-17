# SpecFirst CLI Interface — Design Spec

**Date:** 2026-05-16  
**Status:** Approved  
**Scope:** CLI interface layer for the SpecFirst accessibility pipeline (phases 1–8)

---

## 1. Goal

Build a CLI that lets developers run the SpecFirst accessibility pipeline from the terminal. The CLI wraps existing core logic (phases 1–5 already implemented; phases 6–8 implemented by a parallel PR). This spec covers the interface layer only — command structure, terminal output, shared utilities, and error handling.

---

## 2. Stack

| Dependency | Purpose |
|---|---|
| `commander` | Command parsing, `--help`, flags |
| `chalk` | Terminal color (used sparingly) |
| `ora` | Spinner per pipeline step |
| `tsx` | Runtime for development |
| TypeScript | Language |

All three runtime deps are small and well-maintained. No additional frameworks.

---

## 3. File Structure

```
specfirst/
  cli/
    index.ts                  ← commander entry point, registers all commands
    commands/
      init.ts
      run.ts
      baseline.ts
      bobPrompt.ts
      patchGuard.ts
      verify.ts
      report.ts
      watch.ts
    shared/
      logger.ts               ← all terminal output
      runContext.ts           ← run-folder path resolution + validation
      errorHandling.ts        ← assertStatus, handleCommandError
```

`package.json` gains a `bin` field:

```json
{
  "bin": {
    "specfirst": "./dist/cli/index.js"
  }
}
```

For development, commands are invoked via `tsx specfirst/cli/index.ts <command>`.

---

## 4. Commands

### `specfirst init`

Creates `specfirst.config.json` in the project root with defaults:

```json
{
  "watch": "src/components",
  "testOutput": "tests/a11y",
  "reportOutput": "specfirst/runs",
  "wcagLevel": "AA",
  "wcagVersion": "2.2",
  "maxRetries": 3,
  "testHarnessUrl": "http://localhost:5173"
}
```

---

### `specfirst run <file>`

**Main demo command.** Runs phases 1–6 and generates the Bob prompt, then exits with explicit next steps.

Pipeline executed in sequence:

1. Analyze component (phase 1)
2. Classify pattern (phase 2)
3. Load rule manifest (phase 3)
4. Freeze spec (phase 4)
5. Generate tests (phase 5)
6. Baseline — run Playwright, confirm failures (phase 6)
7. Generate Bob prompt (phase 7)

Terminal output:

```
SpecFirst Run: Picker.tsx

✓ Analyze component
✓ Classify pattern: react-select-only-combobox
✓ Load manifest: 11 checks
✓ Freeze spec
✓ Generate tests
✗ Baseline red-confirmed: 3 failed checks
✓ Bob prompt generated

Failed checks:
  - keyboard-arrow-down-opens
  - keyboard-enter-selects
  - keyboard-escape-closes

Next:
  Open specfirst/runs/<run-id>/bobPrompt.md in IBM Bob.
  After Bob patches the component, run:

  specfirst verify <run-id>
```

**Flags:**

- `--interactive` — adds a `(Y/n)` prompt after baseline before generating the Bob prompt. Default is non-interactive.
- `--debug` — writes stack traces to `specfirst/runs/<run-id>/debug.log`.

---

### `specfirst baseline <run-id>`

Standalone re-run of phase 6 only. Useful for debugging without re-running the full pipeline.

Reads `testGenerationResult.json`, verifies hashes, runs Playwright, parses results, writes `baselineResult.json`.

Expected status: `red-confirmed` (baseline must confirm failures to be meaningful).

---

### `specfirst bob-prompt <run-id>`

Standalone re-run of phase 7. Regenerates or prints the path to `bobPrompt.md`.

Useful if the prompt was deleted, or if the developer wants to review it again.

Warns (does not fail) if `bobPrompt.md` already exists before overwriting:

```
⚠ Bob prompt already exists, overwriting...
```

---

### `specfirst patch-guard <run-id>`

Standalone phase 8 integrity check. Hash-checks the following against hashes stored in `testGenerationResult.json`:

- `lockedSpec.json`
- generated test file (`tests/a11y/<Component>.spec.ts`)
- generated harness file (`src/specfirst-demo/generated/<Component>Harness.tsx`)

Fails loudly if any are modified. Intended as a debugging tool; `verify` calls it internally.

---

### `specfirst verify <run-id>`

Full phase 8 verification. Internally runs patch-guard first, then:

1. Confirm locked spec and test file hashes unchanged
2. Rerun the same Playwright tests
3. Compare results against `baselineResult.json`
4. Write `finalVerificationResult.json`

Expected statuses: `passed`, `failed`, or `invalidated`.

By composing patch-guard internally, the developer only needs one command after Bob patches:

```bash
specfirst verify <run-id>
```

`patch-guard` remains available as a standalone command for debugging.

---

### `specfirst report <run-id>`

Generates `evidenceReport.md` in the run folder.

The report uses the claim boundary language from the SpecFirst policy:

> Passed SpecFirst automated accessibility contract. Manual review required.

Never claims WCAG compliance or full accessibility. The report is structured as an auditable evidence artifact.

---

### `specfirst watch [dir]`

Watches `.tsx` files in `[dir]` (defaults to `specfirst.config.json → watch`) using Node's `fs.watch`. On save, runs the same logic as `specfirst run` for the changed file.

Built last — depends on all other commands being stable.

---

## 5. Shared Utilities

### `logger.ts`

Owns all terminal output. No command file should call `console.log` directly.

```ts
step(label: string): Ora                  // returns ora spinner; caller calls .succeed() / .fail()
info(message: string): void               // plain informational line
warn(message: string): void               // ⚠ prefixed warning
printChecks(failed: string[]): void       // indented failed check list
printNextAction(message: string): void    // "Next:" block in distinct style
fatal(message: string, options?: { exitCode?: number }): never  // prints error, exits 1 (mockable in tests)
```

**CLI color rules (from theme spec):**

- `chalk.green` — success states only (`✓`)
- `chalk.red` — failure states only (`✗`)
- `chalk.yellow` — warnings (`⚠`)
- `chalk.bold` — run titles, "Next:" label
- No color for informational body text — monochrome by default

**Status indicators:**

```
✓  passed / completed
✗  failed
⟳  running (ora spinner)
⚠  warning
■  skipped
```

---

### `runContext.ts`

Resolves and validates all run-scoped artifact paths from a run ID. Commands must never manually construct paths.

```ts
type RunContext = {
  runId: string;
  runDir: string;
  componentAnalysisPath: string;
  classificationPath: string;
  manifestLoadResultPath: string;
  lockedSpecPath: string;
  testGenerationResultPath: string;
  baselineResultPath: string;
  bobPromptPath: string;
  finalVerificationResultPath: string;
  evidenceReportPath: string;
  debugLogPath: string;
};

function getRunContext(runId: string): RunContext;
function assertRunExists(context: RunContext): void;  // throws if runDir does not exist
```

---

### `errorHandling.ts`

Centralises error handling so commands do not duplicate try/catch logic.

```ts
function assertStatus<T extends { status: string }>(
  result: T,
  allowed: string[]
): void;
// throws if result.status is not in allowed

function handleCommandError(
  error: unknown,
  context: RunContext,
  debug: boolean
): never;
// prints user-facing message (reason + message from result)
// writes stack trace to debug.log if debug === true
// exits 1
```

Each command declares its own allowed statuses:

```ts
assertStatus(result, ["red-confirmed"]);        // baseline
assertStatus(result, ["passed", "failed", "invalidated"]); // verify
```

---

## 6. Run Folder Structure

Each run produces:

```
specfirst/runs/<run-id>/
  componentAnalysis.json
  classification.json
  manifestLoadResult.json
  manifestUsed.json
  lockedSpec.json
  testGenerationResult.json
  baselineResult.json
  bobPrompt.md
  finalVerificationResult.json
  evidenceReport.md
  debug.log                   ← only written when --debug is passed
```

Run IDs use the existing timestamp format: `2026-05-16T20-01-11-151Z-analyze`.

---

## 7. Canonical Demo Flow

```bash
specfirst run src/components/Picker.tsx
# → phases 1–6, bob prompt generated, next steps printed

# Developer opens bobPrompt.md in IBM Bob
# Bob patches Picker.tsx

specfirst verify <run-id>
# → patch-guard, final Playwright rerun, finalVerificationResult.json written

specfirst report <run-id>
# → evidenceReport.md written
```

---

## 8. Out of Scope

- VS Code extension (separate future brainstorm)
- Web UI
- Bob API integration (Bob is a human-in-the-loop step; prompt is a markdown file)
- Full WCAG compliance claims (claim boundary is enforced by the report template)
