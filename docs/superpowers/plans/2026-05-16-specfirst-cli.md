# SpecFirst CLI Interface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `specfirst` CLI interface layer — command parsing, terminal output, and wiring of existing core functions for phases 1–8.

**Architecture:** Commander registers 8 commands; each command file is a thin wrapper that calls a core function and delegates all terminal output to `logger.ts`. Shared utilities (`logger.ts`, `runContext.ts`, `errorHandling.ts`) handle all cross-cutting concerns so command files stay under ~60 lines each. Phases 6–8 core functions come from a parallel PR — commands for those phases define the expected interface and wire in once that PR merges.

**Tech Stack:** TypeScript (ESM), `commander`, `chalk`, `ora`, `tsx`, Node.js `fs`/`path`/`readline`

---

## File Map

**Create:**
- `specfirst/cli/index.ts` — commander entry point, registers all commands
- `specfirst/cli/shared/logger.ts` — all terminal output (chalk + ora)
- `specfirst/cli/shared/runContext.ts` — run-folder path resolution + validation
- `specfirst/cli/shared/errorHandling.ts` — `assertStatus`, `handleCommandError`
- `specfirst/cli/commands/init.ts` — `specfirst init`
- `specfirst/cli/commands/run.ts` — `specfirst run <file>` (phases 1–6 + bob prompt)
- `specfirst/cli/commands/baseline.ts` — `specfirst baseline <run-id>`
- `specfirst/cli/commands/bobPrompt.ts` — `specfirst bob-prompt <run-id>`
- `specfirst/cli/commands/patchGuard.ts` — `specfirst patch-guard <run-id>`
- `specfirst/cli/commands/verify.ts` — `specfirst verify <run-id>`
- `specfirst/cli/commands/report.ts` — `specfirst report <run-id>`
- `specfirst/cli/commands/watch.ts` — `specfirst watch [dir]`
- `tests/cli/runCliSharedFixtures.ts` — unit tests for shared utilities

**Modify:**
- `package.json` — add `commander`, `chalk`, `ora` deps; add `specfirst:cli` script; add `bin` field

---

## Task 1: Install Dependencies and Update package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install commander chalk ora
```

Expected output: `added 3 packages` (or similar)

- [ ] **Step 2: Add CLI script and bin field to package.json**

In `package.json`, add inside `"scripts"`:
```json
"specfirst:cli": "tsx specfirst/cli/index.ts"
```

And add at the top level (alongside `"scripts"`):
```json
"bin": {
  "specfirst": "./dist/cli/index.js"
}
```

- [ ] **Step 3: Verify types are available**

```bash
npm run typecheck
```

Expected: no errors (chalk, ora, commander all ship their own types)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add commander, chalk, ora and CLI bin field"
```

Body: "Installs the three dependencies needed for the CLI interface layer and registers the bin entry point for eventual npm publication. The specfirst:cli script allows running the CLI during development via tsx."

---

## Task 2: Create `logger.ts`

**Files:**
- Create: `specfirst/cli/shared/logger.ts`

- [ ] **Step 1: Create the file**

```typescript
// specfirst/cli/shared/logger.ts
import chalk from "chalk";
import ora, { type Ora } from "ora";

export function step(label: string): Ora {
  return ora(label).start();
}

export function info(message: string): void {
  console.log(message);
}

export function warn(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

export function printChecks(failed: string[]): void {
  console.log("");
  console.log("Failed checks:");
  for (const check of failed) {
    console.log(`  - ${check}`);
  }
}

export function printNextAction(message: string): void {
  console.log("");
  console.log(chalk.bold("Next:"));
  console.log(message);
}

export function fatal(message: string, options?: { exitCode?: number }): never {
  console.error(chalk.red(`✗ ${message}`));
  process.exit(options?.exitCode ?? 1);
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add specfirst/cli/shared/logger.ts
git commit -m "Add logger.ts shared CLI utility"
```

Body: "Centralises all terminal output behind a single module so command files never call console.log directly. Uses chalk for color-coded status (green success, red failure, yellow warning) and ora for animated spinners. fatal() calls process.exit so it can be mocked in tests."

---

## Task 3: Create `runContext.ts`

**Files:**
- Create: `specfirst/cli/shared/runContext.ts`

- [ ] **Step 1: Create the file**

```typescript
// specfirst/cli/shared/runContext.ts
import fs from "node:fs";
import path from "node:path";

export type RunContext = {
  runId: string;
  runDir: string;
  componentAnalysisPath: string;
  classificationPath: string;
  manifestLoadResultPath: string;
  manifestUsedPath: string;
  lockedSpecPath: string;
  testGenerationResultPath: string;
  baselineResultPath: string;
  bobPromptPath: string;
  finalVerificationResultPath: string;
  evidenceReportPath: string;
  debugLogPath: string;
};

export function getRunContext(runId: string, projectRoot = process.cwd()): RunContext {
  const runDir = path.resolve(projectRoot, "specfirst", "runs", runId);
  return {
    runId,
    runDir,
    componentAnalysisPath: path.join(runDir, "componentAnalysis.json"),
    classificationPath: path.join(runDir, "classification.json"),
    manifestLoadResultPath: path.join(runDir, "manifestLoadResult.json"),
    manifestUsedPath: path.join(runDir, "manifestUsed.json"),
    lockedSpecPath: path.join(runDir, "lockedSpec.json"),
    testGenerationResultPath: path.join(runDir, "testGenerationResult.json"),
    baselineResultPath: path.join(runDir, "baselineResult.json"),
    bobPromptPath: path.join(runDir, "bobPrompt.md"),
    finalVerificationResultPath: path.join(runDir, "finalVerificationResult.json"),
    evidenceReportPath: path.join(runDir, "evidenceReport.md"),
    debugLogPath: path.join(runDir, "debug.log"),
  };
}

export function assertRunExists(context: RunContext): void {
  if (!fs.existsSync(context.runDir)) {
    throw new Error(
      `Run not found: ${context.runId}\nLooked in: ${context.runDir}`
    );
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add specfirst/cli/shared/runContext.ts
git commit -m "Add runContext.ts shared CLI utility"
```

Body: "Centralises run-folder path resolution so commands never construct paths manually. assertRunExists() gives a clear error message when a run-id doesn't match an existing folder, keeping command files clean of manual fs.existsSync checks."

---

## Task 4: Create `errorHandling.ts`

**Files:**
- Create: `specfirst/cli/shared/errorHandling.ts`

- [ ] **Step 1: Create the file**

```typescript
// specfirst/cli/shared/errorHandling.ts
import fs from "node:fs";
import type { RunContext } from "./runContext.js";
import { fatal } from "./logger.js";

export function assertStatus<T extends { status: string; reason?: string; message?: string }>(
  result: T,
  allowed: string[]
): void {
  if (!allowed.includes(result.status)) {
    const detail = result.message ?? result.reason ?? "";
    throw new Error(
      `Unexpected status "${result.status}". Expected one of: ${allowed.join(", ")}. ${detail}`.trim()
    );
  }
}

export function handleCommandError(
  error: unknown,
  context: RunContext | null,
  debug: boolean
): never {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? (error.stack ?? message) : message;

  if (debug && context !== null) {
    const entry = `[${new Date().toISOString()}]\n${stack}\n\n`;
    try {
      fs.appendFileSync(context.debugLogPath, entry);
    } catch {
      // If we can't write the log, just continue to fatal
    }
  }

  fatal(message);
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add specfirst/cli/shared/errorHandling.ts
git commit -m "Add errorHandling.ts shared CLI utility"
```

Body: "Centralises assertStatus() and handleCommandError() so commands declare their expected phase statuses explicitly and don't duplicate try/catch logic. User-facing errors show only the reason/message fields from phase result objects. Stack traces go to debug.log only when --debug is passed."

---

## Task 5: Test Shared Utilities

**Files:**
- Create: `tests/cli/runCliSharedFixtures.ts`

- [ ] **Step 1: Create the test file**

```typescript
// tests/cli/runCliSharedFixtures.ts
import assert from "node:assert/strict";
import path from "node:path";
import { assertStatus } from "../../specfirst/cli/shared/errorHandling.js";
import { getRunContext } from "../../specfirst/cli/shared/runContext.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

console.log("CLI shared utilities");

// runContext
test("getRunContext resolves runDir from runId", () => {
  const ctx = getRunContext("2026-05-16T20-01-11-151Z-analyze", "/project");
  assert.equal(ctx.runDir, path.resolve("/project/specfirst/runs/2026-05-16T20-01-11-151Z-analyze"));
});

test("getRunContext sets lockedSpecPath inside runDir", () => {
  const ctx = getRunContext("my-run", "/project");
  assert.equal(ctx.lockedSpecPath, path.join(ctx.runDir, "lockedSpec.json"));
});

test("getRunContext sets bobPromptPath inside runDir", () => {
  const ctx = getRunContext("my-run", "/project");
  assert.equal(ctx.bobPromptPath, path.join(ctx.runDir, "bobPrompt.md"));
});

// assertStatus
test("assertStatus passes when status is in allowed list", () => {
  assertStatus({ status: "locked" }, ["locked", "skipped"]);
  // no throw = pass
});

test("assertStatus throws when status is not in allowed list", () => {
  assert.throws(
    () => assertStatus({ status: "failed", message: "something went wrong" }, ["locked"]),
    /Unexpected status "failed"/
  );
});

test("assertStatus includes the result message in the error", () => {
  assert.throws(
    () => assertStatus({ status: "failed", message: "hash mismatch" }, ["locked"]),
    /hash mismatch/
  );
});

test("assertStatus handles multiple allowed statuses", () => {
  assertStatus({ status: "passed" }, ["passed", "failed", "invalidated"]);
  assertStatus({ status: "failed" }, ["passed", "failed", "invalidated"]);
  assertStatus({ status: "invalidated" }, ["passed", "failed", "invalidated"]);
});

// Summary
console.log("");
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Add test script to package.json**

In `package.json` scripts, add:
```json
"test:cli-shared": "tsx tests/cli/runCliSharedFixtures.ts"
```

- [ ] **Step 3: Run tests**

```bash
npm run test:cli-shared
```

Expected output:
```
CLI shared utilities
  ✓ getRunContext resolves runDir from runId
  ✓ getRunContext sets lockedSpecPath inside runDir
  ✓ getRunContext sets bobPromptPath inside runDir
  ✓ assertStatus passes when status is in allowed list
  ✓ assertStatus throws when status is not in allowed list
  ✓ assertStatus includes the result message in the error
  ✓ assertStatus handles multiple allowed statuses

7 passed, 0 failed
```

- [ ] **Step 4: Commit**

```bash
git add tests/cli/runCliSharedFixtures.ts package.json
git commit -m "Add unit tests for CLI shared utilities"
```

Body: "Tests runContext path resolution and assertStatus behaviour. Follows the existing fixture-runner pattern used throughout the test suite. These tests provide a safety net for the two most logic-bearing shared utilities before command files are written."

---

## Task 6: Create CLI Entry Point

**Files:**
- Create: `specfirst/cli/index.ts`

- [ ] **Step 1: Create skeleton entry point**

```typescript
// specfirst/cli/index.ts
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { runCommand } from "./commands/run.js";
import { baselineCommand } from "./commands/baseline.js";
import { bobPromptCommand } from "./commands/bobPrompt.js";
import { patchGuardCommand } from "./commands/patchGuard.js";
import { verifyCommand } from "./commands/verify.js";
import { reportCommand } from "./commands/report.js";
import { watchCommand } from "./commands/watch.js";

const program = new Command();

program
  .name("specfirst")
  .description("Deterministic accessibility compliance pipeline for React components")
  .version("0.1.0");

program.addCommand(initCommand());
program.addCommand(runCommand());
program.addCommand(baselineCommand());
program.addCommand(bobPromptCommand());
program.addCommand(patchGuardCommand());
program.addCommand(verifyCommand());
program.addCommand(reportCommand());
program.addCommand(watchCommand());

program.parse();
```

Note: all command files must exist before this typechecks — create them in Tasks 7–14 as stubs first, then flesh them out.

- [ ] **Step 2: Create stub files for all commands so index.ts can compile**

Create each of the following files with this exact stub (adjust the exported function name per file):

`specfirst/cli/commands/init.ts`:
```typescript
import { Command } from "commander";
export function initCommand(): Command {
  return new Command("init").description("Create specfirst.config.json").action(() => {
    console.log("init — not yet implemented");
  });
}
```

Repeat the same stub pattern for:
- `specfirst/cli/commands/run.ts` — function `runCommand`, command name `"run"`, description `"Run the full pipeline for a component file"`
- `specfirst/cli/commands/baseline.ts` — function `baselineCommand`, command name `"baseline"`, description `"Re-run Phase 6 baseline"`
- `specfirst/cli/commands/bobPrompt.ts` — function `bobPromptCommand`, command name `"bob-prompt"`, description `"Generate or reprint the Bob remediation prompt"`
- `specfirst/cli/commands/patchGuard.ts` — function `patchGuardCommand`, command name `"patch-guard"`, description `"Verify Bob did not edit forbidden files"`
- `specfirst/cli/commands/verify.ts` — function `verifyCommand`, command name `"verify"`, description `"Run patch-guard then final verification"`
- `specfirst/cli/commands/report.ts` — function `reportCommand`, command name `"report"`, description `"Generate evidenceReport.md"`
- `specfirst/cli/commands/watch.ts` — function `watchCommand`, command name `"watch"`, description `"Watch a directory and run the pipeline on .tsx changes"`

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Smoke test the help output**

```bash
npm run specfirst:cli -- --help
```

Expected (approximately):
```
Usage: specfirst [options] [command]

Deterministic accessibility compliance pipeline for React components

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  init            Create specfirst.config.json
  run             Run the full pipeline for a component file
  baseline        Re-run Phase 6 baseline
  bob-prompt      Generate or reprint the Bob remediation prompt
  patch-guard     Verify Bob did not edit forbidden files
  verify          Run patch-guard then final verification
  report          Generate evidenceReport.md
  watch           Watch a directory and run the pipeline on .tsx changes
```

- [ ] **Step 5: Commit**

```bash
git add specfirst/cli/index.ts specfirst/cli/commands/
git commit -m "Add CLI entry point and command stubs"
```

Body: "Registers all 8 commands with commander. Stubs allow the entry point to typecheck and the --help output to be verified before implementing command logic. Commands will be fleshed out in subsequent tasks."

---

## Task 7: Implement `init` Command

**Files:**
- Modify: `specfirst/cli/commands/init.ts`

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// specfirst/cli/commands/init.ts
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { fatal, info } from "../shared/logger.js";

const DEFAULT_CONFIG = {
  watch: "src/components",
  testOutput: "tests/a11y",
  reportOutput: "specfirst/runs",
  wcagLevel: "AA",
  wcagVersion: "2.2",
  maxRetries: 3,
  testHarnessUrl: "http://localhost:5173",
};

export function initCommand(): Command {
  return new Command("init")
    .description("Create specfirst.config.json in the project root")
    .action(() => {
      const configPath = path.resolve(process.cwd(), "specfirst.config.json");
      if (fs.existsSync(configPath)) {
        fatal("specfirst.config.json already exists. Delete it to reinitialize.");
      }
      fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
      info("Created specfirst.config.json");
    });
}
```

- [ ] **Step 2: Test it**

```bash
npm run specfirst:cli -- init
```

Expected: `Created specfirst.config.json` and the file appears in the project root.

Run again to test the guard:
```bash
npm run specfirst:cli -- init
```

Expected: `✗ specfirst.config.json already exists. Delete it to reinitialize.` and exit 1.

Clean up after testing:
```bash
rm specfirst.config.json
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add specfirst/cli/commands/init.ts
git commit -m "Implement specfirst init command"
```

Body: "Creates specfirst.config.json with default configuration values. Guards against accidental overwrite by failing early if the file already exists. Follows the fatal()/info() pattern from logger.ts."

---

## Task 8: Implement `run` Command — Phases 1–5

**Files:**
- Modify: `specfirst/cli/commands/run.ts`

- [ ] **Step 1: Replace stub with phases 1–5 implementation**

```typescript
// specfirst/cli/commands/run.ts
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import chalk from "chalk";
import { analyzeComponent } from "../../core/analysis/analyzeComponent.js";
import { classifyComponent } from "../../core/classification/classifyComponent.js";
import { loadManifestForClassification } from "../../core/manifest/loadManifest.js";
import { freezeSpec } from "../../core/spec/freezeSpec.js";
import { generateTests } from "../../core/test-generation/generateTests.js";
import { step, printChecks, printNextAction, fatal, warn } from "../shared/logger.js";
import { getRunContext } from "../shared/runContext.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";

function createTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function runCommand(): Command {
  return new Command("run")
    .description("Run the full pipeline for a component file (phases 1–6 + Bob prompt)")
    .argument("<file>", "Path to the React component file")
    .option("--debug", "Write stack traces to debug.log on failure")
    .option("--interactive", "Prompt for confirmation before generating Bob prompt")
    .action(async (file: string, options: { debug: boolean; interactive: boolean }) => {
      const projectRoot = process.cwd();
      const absoluteFile = path.resolve(projectRoot, file);

      if (!fs.existsSync(absoluteFile)) {
        fatal(`File not found: ${file}`);
      }

      const componentName = path.basename(file, ".tsx");
      console.log(chalk.bold(`SpecFirst Run: ${path.basename(file)}`));
      console.log("");

      // Create run folder
      const runId = `${createTimestamp()}-analyze`;
      const runDir = path.resolve(projectRoot, "specfirst", "runs", runId);
      fs.mkdirSync(runDir, { recursive: true });
      const ctx = getRunContext(runId, projectRoot);

      try {
        // Phase 1 — Analyze
        const s1 = step("Analyze component");
        const analysis = analyzeComponent(absoluteFile, projectRoot);
        fs.writeFileSync(ctx.componentAnalysisPath, JSON.stringify(analysis, null, 2) + "\n");
        s1.succeed(chalk.green(`✓`) + ` Analyze component`);

        // Phase 2 — Classify
        const s2 = step("Classify pattern");
        const classification = classifyComponent(analysis);
        fs.writeFileSync(ctx.classificationPath, JSON.stringify(classification, null, 2) + "\n");
        if (!classification.nextPhase.canContinue) {
          s2.fail(chalk.red(`✗`) + ` Classify pattern — ${classification.classification.pattern} (cannot continue)`);
          fatal(`Classification blocked: ${classification.blockers.map(b => b.reason).join(", ")}`);
        }
        s2.succeed(chalk.green(`✓`) + ` Classify pattern: ${classification.classification.pattern}`);

        // Phase 3 — Load manifest
        const s3 = step("Load manifest");
        const manifestResult = loadManifestForClassification({
          classificationPath: ctx.classificationPath,
          projectRoot,
        });
        assertStatus(manifestResult, ["loaded"]);
        s3.succeed(chalk.green(`✓`) + ` Load manifest: ${manifestResult.manifest.requirements.length} checks`);

        // Phase 4 — Freeze spec
        const s4 = step("Freeze spec");
        const specResult = freezeSpec({ input: runId, projectRoot });
        assertStatus(specResult, ["locked"]);
        s4.succeed(chalk.green(`✓`) + ` Freeze spec`);

        // Phase 5 — Generate tests
        const s5 = step("Generate tests");
        const testResult = generateTests({ input: runId, projectRoot });
        assertStatus(testResult, ["generated"]);
        s5.succeed(chalk.green(`✓`) + ` Generate tests`);

        // Phases 6–7 are implemented in a parallel PR.
        // Once that PR merges, uncomment and wire these steps:
        //
        // const s6 = step("Baseline");
        // const baselineResult = runBaseline({ input: runId, projectRoot });
        // assertStatus(baselineResult, ["red-confirmed"]);
        // s6.fail(chalk.red(`✗`) + ` Baseline red-confirmed: ${baselineResult.failureCount} failed checks`);
        // printChecks(baselineResult.failedCheckIds);
        //
        // if (options.interactive) {
        //   const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        //   const answer = await new Promise<string>(resolve =>
        //     rl.question("\nGenerate Bob remediation prompt? (Y/n) ", resolve)
        //   );
        //   rl.close();
        //   if (answer.toLowerCase() === "n") {
        //     info("Skipped. Run `specfirst bob-prompt " + runId + "` to generate later.");
        //     return;
        //   }
        // }
        //
        // const s7 = step("Generate Bob prompt");
        // const promptResult = generateBobPrompt({ input: runId, projectRoot });
        // assertStatus(promptResult, ["generated"]);
        // s7.succeed(chalk.green(`✓`) + ` Bob prompt generated`);
        //
        // printNextAction(
        //   `  Open ${path.relative(projectRoot, ctx.bobPromptPath)} in IBM Bob.\n` +
        //   `  After Bob patches the component, run:\n\n` +
        //   `  specfirst verify ${runId}`
        // );

        // Temporary: print the run ID so the developer can use other commands
        console.log("");
        console.log(chalk.bold("Run ID:"), runId);
        warn("Phases 6–7 not yet wired (awaiting parallel PR). Run `specfirst baseline` and `specfirst bob-prompt` manually.");

      } catch (err) {
        handleCommandError(err, ctx, options.debug ?? false);
      }
    });
}
```

- [ ] **Step 2: Test with the existing Picker fixture**

```bash
npm run specfirst:cli -- run src/specfirst-demo/App.tsx
```

If there's no component file at that path, find a real one:

```bash
ls src/
```

Then use the correct path. Expected output shows 5 green checkmarks and a run ID.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add specfirst/cli/commands/run.ts
git commit -m "Implement specfirst run command for phases 1-5"
```

Body: "Implements the main demo command, running phases 1-5 in sequence with animated spinners and coloured status output. Phases 6-7 are stubbed with commented-out code that will be uncommented once the parallel phase 6-8 PR merges. Each phase failure prints a clean user-facing error and exits 1."

---

## Task 9: Implement `baseline` Command

**Files:**
- Modify: `specfirst/cli/commands/baseline.ts`

> **Note:** This command imports `runBaseline` from the phase 6-8 PR. The import path shown below is the expected location — confirm against that PR once it merges.

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// specfirst/cli/commands/baseline.ts
import { Command } from "commander";
import chalk from "chalk";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, printChecks } from "../shared/logger.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";

// Import from the phase 6-8 PR once merged:
// import { runBaseline } from "../../core/baseline/runBaseline.js";

export function baselineCommand(): Command {
  return new Command("baseline")
    .description("Re-run Phase 6 baseline (useful for debugging)")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action((runId: string, options: { debug: boolean }) => {
      const ctx = getRunContext(runId);
      try {
        assertRunExists(ctx);

        const s = step("Baseline");

        // TODO: uncomment once phase 6-8 PR merges
        // const result = runBaseline({ input: runId, projectRoot: process.cwd() });
        // assertStatus(result, ["red-confirmed"]);
        // s.fail(chalk.red("✗") + ` Baseline red-confirmed: ${result.failureCount} failed checks`);
        // printChecks(result.failedCheckIds);

        s.warn("Phase 6 not yet implemented — awaiting PR merge");
      } catch (err) {
        handleErr(err, ctx, options.debug ?? false);
      }
    });
}
```

- [ ] **Step 2: Verify it resolves an existing run**

```bash
npm run specfirst:cli -- baseline 2026-05-16T20-01-11-151Z-analyze
```

(Use a real run ID from `ls specfirst/runs/`)

Expected: no crash, stub message printed.

- [ ] **Step 3: Verify it fails cleanly for a nonexistent run**

```bash
npm run specfirst:cli -- baseline fake-run-id
```

Expected: `✗ Run not found: fake-run-id` and exit 1.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add specfirst/cli/commands/baseline.ts
git commit -m "Add baseline command (stub for phase 6)"
```

Body: "Implements the CLI wrapper for phase 6 baseline. The core runBaseline() import is commented out pending the parallel phase 6-8 PR. assertRunExists() provides clean user-facing error for invalid run IDs."

---

## Task 10: Implement `bob-prompt` Command

**Files:**
- Modify: `specfirst/cli/commands/bobPrompt.ts`

> **Note:** Imports `generateBobPrompt` from the phase 6-8 PR.

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// specfirst/cli/commands/bobPrompt.ts
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, warn, info } from "../shared/logger.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";

// import { generateBobPrompt } from "../../core/bob-prompt/generateBobPrompt.js";

export function bobPromptCommand(): Command {
  return new Command("bob-prompt")
    .description("Generate or reprint the Bob remediation prompt")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action((runId: string, options: { debug: boolean }) => {
      const ctx = getRunContext(runId);
      try {
        assertRunExists(ctx);

        if (fs.existsSync(ctx.bobPromptPath)) {
          warn("Bob prompt already exists, overwriting...");
        }

        const s = step("Generate Bob prompt");

        // TODO: uncomment once phase 6-8 PR merges
        // const result = generateBobPrompt({ input: runId, projectRoot: process.cwd() });
        // assertStatus(result, ["generated"]);
        // s.succeed("✓ Bob prompt generated");
        // info(`  ${path.relative(process.cwd(), ctx.bobPromptPath)}`);

        s.warn("Phase 7 not yet implemented — awaiting PR merge");
      } catch (err) {
        handleCommandError(err, ctx, options.debug ?? false);
      }
    });
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add specfirst/cli/commands/bobPrompt.ts
git commit -m "Add bob-prompt command (stub for phase 7)"
```

Body: "CLI wrapper for phase 7 Bob prompt generation. Warns (does not fail) if bobPrompt.md already exists before overwriting, matching the design spec. Core import is commented out pending the phase 6-8 PR."

---

## Task 11: Implement `patch-guard` Command

**Files:**
- Modify: `specfirst/cli/commands/patchGuard.ts`

> **Note:** Imports `runPatchGuard` from the phase 6-8 PR.

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// specfirst/cli/commands/patchGuard.ts
import { Command } from "commander";
import chalk from "chalk";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, info } from "../shared/logger.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";

// import { runPatchGuard } from "../../core/patch-guard/runPatchGuard.js";

export function patchGuardCommand(): Command {
  return new Command("patch-guard")
    .description("Verify Bob did not edit forbidden files (standalone debug tool)")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action((runId: string, options: { debug: boolean }) => {
      const ctx = getRunContext(runId);
      try {
        assertRunExists(ctx);

        const s = step("Patch guard");

        // TODO: uncomment once phase 6-8 PR merges
        // const result = runPatchGuard({ input: runId, projectRoot: process.cwd() });
        // assertStatus(result, ["passed"]);
        // s.succeed(chalk.green("✓") + " Patch guard passed — no forbidden files modified");

        s.warn("Phase 8 patch-guard not yet implemented — awaiting PR merge");
      } catch (err) {
        handleCommandError(err, ctx, options.debug ?? false);
      }
    });
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add specfirst/cli/commands/patchGuard.ts
git commit -m "Add patch-guard command (stub for phase 8)"
```

Body: "CLI wrapper for the phase 8 hash integrity check. Kept as a standalone command for debugging even though verify calls it internally. Core import commented out pending the phase 6-8 PR."

---

## Task 12: Implement `verify` Command

**Files:**
- Modify: `specfirst/cli/commands/verify.ts`

> **Note:** `verify` internally calls patch-guard then runs final verification. Both come from the phase 6-8 PR.

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// specfirst/cli/commands/verify.ts
import { Command } from "commander";
import chalk from "chalk";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, info, printNextAction } from "../shared/logger.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";

// import { runPatchGuard } from "../../core/patch-guard/runPatchGuard.js";
// import { runVerification } from "../../core/verification/runVerification.js";

export function verifyCommand(): Command {
  return new Command("verify")
    .description("Run patch-guard then final verification (Phase 8)")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action((runId: string, options: { debug: boolean }) => {
      const ctx = getRunContext(runId);
      try {
        assertRunExists(ctx);

        // Step 1: patch guard
        const s1 = step("Patch guard");
        // const guardResult = runPatchGuard({ input: runId, projectRoot: process.cwd() });
        // assertStatus(guardResult, ["passed"]);
        // s1.succeed(chalk.green("✓") + " Patch guard passed");
        s1.warn("Patch guard not yet implemented — awaiting PR merge");

        // Step 2: final verification
        const s2 = step("Final verification");
        // const verifyResult = runVerification({ input: runId, projectRoot: process.cwd() });
        // assertStatus(verifyResult, ["passed", "failed", "invalidated"]);
        // if (verifyResult.status === "passed") {
        //   s2.succeed(chalk.green("✓") + ` Verification passed: ${verifyResult.passedCount}/${verifyResult.testCount} checks`);
        //   printNextAction(`  specfirst report ${runId}`);
        // } else {
        //   s2.fail(chalk.red("✗") + ` Verification ${verifyResult.status}: ${verifyResult.reason}`);
        // }
        s2.warn("Verification not yet implemented — awaiting PR merge");

      } catch (err) {
        handleCommandError(err, ctx, options.debug ?? false);
      }
    });
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add specfirst/cli/commands/verify.ts
git commit -m "Add verify command (stub for phase 8)"
```

Body: "CLI wrapper for phase 8 verification. Internally composes patch-guard + final Playwright rerun so developers only need one command after Bob patches. Both steps are stubbed pending the phase 6-8 PR. printNextAction() guides the developer to specfirst report on success."

---

## Task 13: Implement `report` Command

**Files:**
- Modify: `specfirst/cli/commands/report.ts`

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// specfirst/cli/commands/report.ts
import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, info } from "../shared/logger.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";

// import { generateReport } from "../../core/report/generateReport.js";

export function reportCommand(): Command {
  return new Command("report")
    .description("Generate evidenceReport.md for a verified run")
    .argument("<run-id>", "Run ID from a verified specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action((runId: string, options: { debug: boolean }) => {
      const ctx = getRunContext(runId);
      try {
        assertRunExists(ctx);

        const s = step("Generate evidence report");

        // TODO: uncomment once phase 6-8 PR merges
        // const result = generateReport({ input: runId, projectRoot: process.cwd() });
        // assertStatus(result, ["generated"]);
        // s.succeed(chalk.green("✓") + " Evidence report generated");
        // info(`  ${path.relative(process.cwd(), ctx.evidenceReportPath)}`);

        s.warn("Report generation not yet implemented — awaiting PR merge");
      } catch (err) {
        handleCommandError(err, ctx, options.debug ?? false);
      }
    });
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add specfirst/cli/commands/report.ts
git commit -m "Add report command (stub for phase 8)"
```

Body: "CLI wrapper for evidence report generation. The report enforces the claim boundary — it never claims WCAG compliance, only that the SpecFirst automated contract was passed. Core import stubbed pending the phase 6-8 PR."

---

## Task 14: Implement `watch` Command

**Files:**
- Modify: `specfirst/cli/commands/watch.ts`

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// specfirst/cli/commands/watch.ts
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { info, warn } from "../shared/logger.js";

export function watchCommand(): Command {
  return new Command("watch")
    .description("Watch a directory and run the pipeline on .tsx file saves")
    .argument("[dir]", "Directory to watch (default: src/components)", "src/components")
    .action((dir: string) => {
      const projectRoot = process.cwd();
      const watchDir = path.resolve(projectRoot, dir);

      if (!fs.existsSync(watchDir)) {
        warn(`Directory not found: ${dir}`);
        return;
      }

      info(chalk.bold(`Watching ${dir}...`));
      info("Save a .tsx file to trigger the pipeline.\n");

      // Debounce: don't re-trigger for saves within 500ms of each other
      const debounceMap = new Map<string, ReturnType<typeof setTimeout>>();

      fs.watch(watchDir, { recursive: true }, (event, filename) => {
        if (!filename || !filename.endsWith(".tsx")) return;

        const existing = debounceMap.get(filename);
        if (existing) clearTimeout(existing);

        debounceMap.set(filename, setTimeout(async () => {
          debounceMap.delete(filename);
          const filePath = path.join(dir, filename);
          info(`\nDETECTED ${filename}`);

          // Dynamically import run logic to share the same pipeline as `specfirst run`
          const { runCommand } = await import("./run.js");
          const cmd = runCommand();
          // Parse the command as if the user typed: specfirst run <file>
          await cmd.parseAsync([filePath], { from: "user" });
        }, 500));
      });
    });
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Smoke test**

```bash
npm run specfirst:cli -- watch src
```

Expected: `Watching src...` printed. Touch a `.tsx` file in `src/` and verify the pipeline triggers. Ctrl+C to exit.

- [ ] **Step 4: Commit**

```bash
git add specfirst/cli/commands/watch.ts
git commit -m "Implement specfirst watch command"
```

Body: "Watches a directory for .tsx file saves using Node's built-in fs.watch. A 500ms debounce prevents double-triggers from editors that write files in multiple steps. Reuses the run command's pipeline so watch behaviour stays in sync with the run command automatically."

---

## Task 15: Wire Phases 6–7 into `run` Once Phase 6-8 PR Merges

> **Do this task after the parallel phase 6-8 PR is merged.**

**Files:**
- Modify: `specfirst/cli/commands/run.ts`
- Modify: `specfirst/cli/commands/baseline.ts`
- Modify: `specfirst/cli/commands/bobPrompt.ts`
- Modify: `specfirst/cli/commands/patchGuard.ts`
- Modify: `specfirst/cli/commands/verify.ts`
- Modify: `specfirst/cli/commands/report.ts`

- [ ] **Step 1: Confirm the core function paths from the merged PR**

Check:
```bash
ls specfirst/core/
```

Expected new directories: `baseline/`, `bob-prompt/` (or similar — confirm actual names from the PR).

- [ ] **Step 2: In `run.ts`, uncomment the phase 6–7 steps**

Remove the stub warning. Uncomment the `runBaseline` and `generateBobPrompt` import and call blocks. Update import paths to match the actual file locations from the PR.

- [ ] **Step 3: In each of baseline.ts, bobPrompt.ts, patchGuard.ts, verify.ts, report.ts — uncomment the core import and call block**

Remove the `s.warn("... awaiting PR merge")` line in each file. Uncomment the core function import and the result handling block below it.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 5: End-to-end test**

```bash
npm run specfirst:cli -- run src/specfirst-demo/App.tsx
```

Expected: 7 steps printed (phases 1–6 + Bob prompt), with `specfirst verify <run-id>` printed at the end.

```bash
# (After Bob patches the component)
npm run specfirst:cli -- verify <run-id>
npm run specfirst:cli -- report <run-id>
```

- [ ] **Step 6: Commit**

```bash
git add specfirst/cli/commands/
git commit -m "Wire phases 6-8 into CLI commands"
```

Body: "Connects the CLI commands to the phase 6-8 core functions now that the parallel PR has merged. The run command now completes the full pipeline through Bob prompt generation and prints the verify command as the next step."

---

## Self-Review Checklist (run by the author before marking complete)

- [ ] All 8 commands are registered in `index.ts`
- [ ] No command file calls `console.log` directly — all output goes through `logger.ts`
- [ ] No command file constructs a path manually — all paths come from `getRunContext()`
- [ ] `assertStatus()` is called with phase-specific allowed statuses in every command
- [ ] `handleCommandError()` is called in every command's catch block
- [ ] `fatal()` used for all unrecoverable errors; `warn()` used for non-fatal notices
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run test:cli-shared` passes with zero failures
- [ ] `npm run specfirst:cli -- --help` shows all 8 commands
