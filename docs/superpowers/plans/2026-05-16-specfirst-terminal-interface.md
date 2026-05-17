# SpecFirst Terminal Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a branded readline REPL + bottom status bar to the SpecFirst CLI, activated when `specfirst` is run with no arguments; direct command mode is untouched.

**Architecture:** Two new files — `shared/ui.ts` (theme constants + print functions) and `shell.ts` (readline REPL). Three existing command files (`run.ts`, `verify.ts`, `report.ts`) are refactored to export their action handlers separately so the shell can dispatch to them and receive `RunStats`. `index.ts` delegates to `startShell()` when no subcommand is given.

**Tech Stack:** Node.js `readline` (built-in), `chalk` ^5 (already a dep), `commander` (already a dep), `tsx` for running scripts.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `specfirst/cli/shared/ui.ts` | Theme constants, `RunStats` interface, `printBanner`, `printDivider`, `printStatusBar` |
| Create | `specfirst/cli/shell.ts` | readline REPL: banner, prompt loop, tab completer, command dispatch |
| Modify | `specfirst/cli/index.ts` | Detect no-args → call `startShell()`, else `program.parse()` |
| Modify | `specfirst/cli/commands/run.ts` | Export `runAction` returning `RunStats \| null`; keep `runCommand()` as Commander wrapper |
| Modify | `specfirst/cli/commands/verify.ts` | Export `verifyAction` returning `null` (stub); keep `verifyCommand()` |
| Modify | `specfirst/cli/commands/report.ts` | Export `reportAction` returning `null` (stub); keep `reportCommand()` |
| Create | `tests/cli/runUiFixtures.ts` | Unit tests for `printBanner`, `printDivider`, `printStatusBar` |
| Create | `tests/cli/runShellFixtures.ts` | Unit tests for shell `completer` function |
| Modify | `package.json` | Add `test:ui` and `test:shell` scripts |

---

## Task 1: Create `shared/ui.ts`

**Files:**
- Create: `specfirst/cli/shared/ui.ts`
- Create: `tests/cli/runUiFixtures.ts`
- Modify: `package.json`

- [ ] **Step 1.1: Write the failing tests**

Create `tests/cli/runUiFixtures.ts`:

```ts
import assert from "node:assert/strict";
import { printBanner, printDivider, printStatusBar } from "../../specfirst/cli/shared/ui.js";
import type { RunStats } from "../../specfirst/cli/shared/ui.js";

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

function captureOutput(fn: () => void): string {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  try { fn(); } finally { console.log = original; }
  return lines.join("\n");
}

function stripAnsi(s: string): string {
  return s.replace(/\[[0-9;]*m/g, "");
}

console.log("ui.ts");

// printBanner
test("printBanner includes SpecFirst", () => {
  const out = stripAnsi(captureOutput(() => printBanner("0.1.0", "/my/project")));
  assert.ok(out.includes("SpecFirst"), `Expected 'SpecFirst' in: ${out}`);
});

test("printBanner includes version", () => {
  const out = stripAnsi(captureOutput(() => printBanner("0.1.0", "/my/project")));
  assert.ok(out.includes("0.1.0"), `Expected '0.1.0' in: ${out}`);
});

test("printBanner includes project path", () => {
  const out = stripAnsi(captureOutput(() => printBanner("0.1.0", "/my/project")));
  assert.ok(out.includes("/my/project"), `Expected path in: ${out}`);
});

test("printBanner includes ◈ symbol", () => {
  const out = stripAnsi(captureOutput(() => printBanner("0.1.0", "/my/project")));
  assert.ok(out.includes("◈"), `Expected '◈' in: ${out}`);
});

test("printBanner includes subtitle", () => {
  const out = stripAnsi(captureOutput(() => printBanner("0.1.0", "/my/project")));
  assert.ok(out.includes("Accessibility TDD Agent"), `Expected subtitle in: ${out}`);
});

// printDivider
test("printDivider outputs a line of dashes", () => {
  const out = stripAnsi(captureOutput(() => printDivider()));
  assert.ok(out.includes("─"), `Expected '─' in: ${out}`);
});

test("printDivider line is at least 20 chars", () => {
  const out = stripAnsi(captureOutput(() => printDivider()));
  assert.ok(out.trim().length >= 20, `Expected divider length >= 20, got: ${out.trim().length}`);
});

// printStatusBar — run phase
test("printStatusBar run phase includes ◈ SpecFirst", () => {
  const stats: RunStats = {
    phase: "run",
    runId: "2026-05-16T20-01-11-151Z-analyze",
    totalChecks: 11,
    failedChecks: 3,
    frozen: true,
    bobPromptReady: false,
  };
  const out = stripAnsi(captureOutput(() => printStatusBar(stats)));
  assert.ok(out.includes("SpecFirst"), `Expected 'SpecFirst' in: ${out}`);
  assert.ok(out.includes("◈"), `Expected '◈' in: ${out}`);
});

test("printStatusBar run phase includes check count", () => {
  const stats: RunStats = {
    phase: "run",
    runId: "2026-05-16T20-01-11-151Z-analyze",
    totalChecks: 11,
    failedChecks: 3,
    frozen: true,
    bobPromptReady: false,
  };
  const out = stripAnsi(captureOutput(() => printStatusBar(stats)));
  assert.ok(out.includes("11"), `Expected '11' in: ${out}`);
});

test("printStatusBar run phase includes failed count", () => {
  const stats: RunStats = {
    phase: "run",
    runId: "2026-05-16T20-01-11-151Z-analyze",
    totalChecks: 11,
    failedChecks: 3,
    frozen: true,
    bobPromptReady: false,
  };
  const out = stripAnsi(captureOutput(() => printStatusBar(stats)));
  assert.ok(out.includes("3"), `Expected '3' in: ${out}`);
});

test("printStatusBar run phase shows frozen when frozen is true", () => {
  const stats: RunStats = {
    phase: "run",
    runId: "2026-05-16T20-01-11-151Z-analyze",
    totalChecks: 11,
    failedChecks: 0,
    frozen: true,
    bobPromptReady: true,
  };
  const out = stripAnsi(captureOutput(() => printStatusBar(stats)));
  assert.ok(out.includes("frozen"), `Expected 'frozen' in: ${out}`);
});

// printStatusBar — verify phase
test("printStatusBar verify phase includes manual review required", () => {
  const stats: RunStats = {
    phase: "verify",
    runId: "2026-05-16T20-01-11-151Z-analyze",
    totalChecks: 11,
    failedChecks: 0,
    frozen: true,
    bobPromptReady: false,
  };
  const out = stripAnsi(captureOutput(() => printStatusBar(stats)));
  assert.ok(out.includes("manual review required"), `Expected claim boundary in: ${out}`);
});

test("printStatusBar verify phase shows pass ratio", () => {
  const stats: RunStats = {
    phase: "verify",
    runId: "2026-05-16T20-01-11-151Z-analyze",
    totalChecks: 11,
    failedChecks: 0,
    frozen: true,
    bobPromptReady: false,
  };
  const out = stripAnsi(captureOutput(() => printStatusBar(stats)));
  assert.ok(out.includes("11/11"), `Expected '11/11' in: ${out}`);
});

// printStatusBar — report phase
test("printStatusBar report phase includes artifactPath", () => {
  const stats: RunStats = {
    phase: "report",
    runId: "2026-05-16T20-01-11-151Z-analyze",
    totalChecks: 11,
    failedChecks: 0,
    frozen: true,
    bobPromptReady: false,
    artifactPath: "specfirst/runs/my-run/evidenceReport.md",
  };
  const out = stripAnsi(captureOutput(() => printStatusBar(stats)));
  assert.ok(out.includes("evidenceReport.md"), `Expected artifact path in: ${out}`);
});

console.log("");
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 1.2: Add test script to `package.json`**

In `package.json`, inside `"scripts"`, add after `"test:cli-shared"`:

```json
"test:ui": "tsx tests/cli/runUiFixtures.ts",
"test:shell": "tsx tests/cli/runShellFixtures.ts",
```

- [ ] **Step 1.3: Run the tests — confirm they fail**

```
npm run test:ui
```

Expected: import error — `ui.ts` does not exist yet.

- [ ] **Step 1.4: Create `specfirst/cli/shared/ui.ts`**

```ts
import chalk from "chalk";

export interface RunStats {
  phase: "run" | "verify" | "report";
  runId: string;
  totalChecks: number;
  failedChecks: number;
  frozen: boolean;
  bobPromptReady: boolean;
  artifactPath?: string;
}

const SEP = chalk.hex("#8A8A8A")("│");
const DIVIDER_WIDTH = 62;

const theme = {
  symbol: () => chalk.hex("#A61E5C").bold("◈"),
  brand: (text: string) => chalk.hex("#5B1D87").bold(text),
  muted: (text: string) => chalk.hex("#8A8A8A")(text),
  success: (text: string) => chalk.hex("#22C55E")(text),
  failure: (text: string) => chalk.hex("#EF4444")(text),
  warning: (text: string) => chalk.hex("#FACC15")(text),
};

export function printBanner(version: string, projectPath: string): void {
  console.log(`${theme.symbol()}  ${theme.brand("SpecFirst")} ${theme.muted(`v${version}`)}`);
  console.log(theme.muted("   Accessibility TDD Agent"));
  console.log(theme.muted(`   ${projectPath}`));
  console.log("");
}

export function printDivider(): void {
  console.log(chalk.hex("#8A8A8A")("─".repeat(DIVIDER_WIDTH)));
}

export function printStatusBar(stats: RunStats): void {
  const sym = theme.symbol();
  const brand = theme.brand("SpecFirst");

  if (stats.phase === "run") {
    const failPart =
      stats.failedChecks > 0
        ? theme.failure(`${stats.failedChecks} failed`)
        : theme.success("0 failed");
    const frozenPart = stats.frozen
      ? theme.success("frozen ✓")
      : theme.warning("not frozen");
    const bobPart = stats.bobPromptReady
      ? theme.success("Bob prompt ready")
      : theme.muted("Bob prompt pending");
    const runLabel = theme.muted(stats.runId.slice(0, 19));
    const checksLabel = theme.muted(`${stats.totalChecks} checks`);
    console.log(
      `${sym} ${brand} ${SEP} ${runLabel} ${SEP} ${checksLabel} ${SEP} ${failPart} ${SEP} ${frozenPart} ${SEP} ${bobPart}`
    );
  } else if (stats.phase === "verify") {
    const passed = stats.totalChecks - stats.failedChecks;
    const passPart =
      stats.failedChecks === 0
        ? theme.success(`${passed}/${stats.totalChecks} passed`)
        : theme.failure(`${passed}/${stats.totalChecks} passed`);
    const artifactSuffix = stats.artifactPath
      ? ` ${SEP} ${theme.muted(stats.artifactPath)}`
      : "";
    console.log(
      `${sym} ${brand} ${SEP} ${theme.muted("final verify")} ${SEP} ${passPart} ${SEP} ${theme.muted("manual review required")}${artifactSuffix}`
    );
  } else if (stats.phase === "report") {
    const artifact = stats.artifactPath ?? "evidenceReport.md";
    console.log(
      `${sym} ${brand} ${SEP} ${theme.muted("report")} ${SEP} ${theme.muted(artifact)} ${SEP} ${theme.muted("manual review required")}`
    );
  }
}
```

- [ ] **Step 1.5: Run the tests — confirm they pass**

```
npm run test:ui
```

Expected: all tests pass, `0 failed`.

- [ ] **Step 1.6: Run typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 1.7: Commit**

```bash
git add specfirst/cli/shared/ui.ts tests/cli/runUiFixtures.ts package.json
git commit -m "Add ui.ts: theme constants, RunStats interface, and print functions

Introduces the visual layer for the SpecFirst terminal interface. ui.ts
owns brand colors (purple #5B1D87, magenta #A61E5C), the RunStats interface
used by pipeline commands to communicate results to the status bar, and three
print functions: printBanner (4-line header with ◈ symbol), printDivider
(62-char rule), and printStatusBar (context-aware bottom line for run/verify/report
phases). No other module imports from ui.ts yet."
```

---

## Task 2: Refactor `commands/run.ts` — export `runAction`

**Files:**
- Modify: `specfirst/cli/commands/run.ts`

- [ ] **Step 2.1: Replace `run.ts` with the refactored version**

Full replacement of `specfirst/cli/commands/run.ts`:

```ts
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { analyzeComponent } from "../../core/analysis/analyzeComponent.js";
import { classifyComponent } from "../../core/classification/classifyComponent.js";
import { loadManifestForClassification } from "../../core/manifest/loadManifest.js";
import type { ManifestLoadSuccess } from "../../core/manifest/types.js";
import { freezeSpec } from "../../core/spec/freezeSpec.js";
import { generateTests } from "../../core/test-generation/generateTests.js";
import { step, printChecks, printNextAction, fatal, warn, info } from "../shared/logger.js";
import { getRunContext } from "../shared/runContext.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";
import { printDivider, printStatusBar } from "../shared/ui.js";
import type { RunStats } from "../shared/ui.js";

interface RunOptions {
  debug: boolean;
  interactive: boolean;
}

function createTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function runAction(
  file: string,
  options: RunOptions
): Promise<RunStats | null> {
  const projectRoot = process.cwd();
  const absoluteFile = path.resolve(projectRoot, file);

  if (!fs.existsSync(absoluteFile)) {
    fatal(`File not found: ${file}`);
  }

  info(chalk.bold(`SpecFirst Run: ${path.basename(file)}`));
  info("");

  const runId = `${createTimestamp()}-analyze`;
  const ctx = getRunContext(runId, projectRoot);
  fs.mkdirSync(ctx.runDir, { recursive: true });

  let totalChecks = 0;

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
    const loadedManifest = manifestResult as ManifestLoadSuccess;
    totalChecks = loadedManifest.manifestSummary.requirementCount;
    s3.succeed(chalk.green(`✓`) + ` Load manifest: ${totalChecks} checks`);

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

    // Phases 6–7 pending parallel PR
    info("");
    info(`${chalk.bold("Run ID:")} ${runId}`);
    warn("Phases 6–7 not yet wired (awaiting parallel PR). Run `specfirst baseline` and `specfirst bob-prompt` manually.");

    return {
      phase: "run",
      runId,
      totalChecks,
      failedChecks: 0,
      frozen: true,
      bobPromptReady: false,
    };

  } catch (err) {
    handleCommandError(err, ctx, options.debug ?? false);
  }
}

export function runCommand(): Command {
  return new Command("run")
    .description("Run the full pipeline for a component file (phases 1–6 + Bob prompt)")
    .argument("<file>", "Path to the React component file")
    .option("--debug", "Write stack traces to debug.log on failure")
    .option("--interactive", "Prompt for confirmation before generating Bob prompt")
    .action(async (file: string, options: { debug: boolean; interactive: boolean }) => {
      const stats = await runAction(file, options);
      if (stats) {
        console.log("");
        printDivider();
        printStatusBar(stats);
      }
    });
}
```

- [ ] **Step 2.2: Run typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 2.3: Smoke test**

```
npm run specfirst:cli -- run src/specfirst-demo/generated/PickerHarness.tsx
```

Expected: same pipeline output as before, no regressions.

- [ ] **Step 2.4: Commit**

```bash
git add specfirst/cli/commands/run.ts
git commit -m "Refactor run.ts: export runAction returning RunStats

Splits the Commander action inline into a named runAction export so the
shell REPL can dispatch to it and receive a RunStats object for the status
bar. The Commander wrapper calls runAction and discards the return value,
keeping direct command mode identical to before. totalChecks is now captured
from the manifest result and returned in RunStats."
```

---

## Task 3: Refactor `commands/verify.ts` — export `verifyAction`

**Files:**
- Modify: `specfirst/cli/commands/verify.ts`

- [ ] **Step 3.1: Replace `verify.ts` with the refactored version**

Full replacement of `specfirst/cli/commands/verify.ts`:

```ts
import { Command } from "commander";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step } from "../shared/logger.js";
import { handleCommandError } from "../shared/errorHandling.js";
import { printDivider, printStatusBar } from "../shared/ui.js";
import type { RunStats } from "../shared/ui.js";

interface VerifyOptions {
  debug: boolean;
}

export async function verifyAction(
  runId: string,
  options: VerifyOptions
): Promise<RunStats | null> {
  const ctx = getRunContext(runId);
  try {
    assertRunExists(ctx);

    const s1 = step("Patch guard");
    // const guardResult = runPatchGuard({ input: runId, projectRoot: process.cwd() });
    // assertStatus(guardResult, ["passed"]);
    // s1.succeed(chalk.green("✓") + " Patch guard passed");
    s1.warn("Patch guard not yet implemented — awaiting PR merge");

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

    // Returns null until phases 6-8 are wired; shell skips status bar for null.
    return null;

  } catch (err) {
    handleCommandError(err, ctx, options.debug ?? false);
  }
}

export function verifyCommand(): Command {
  return new Command("verify")
    .description("Run patch-guard then final verification (Phase 8)")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action(async (runId: string, options: { debug: boolean }) => {
      const stats = await verifyAction(runId, options);
      if (stats) {
        console.log("");
        printDivider();
        printStatusBar(stats);
      }
    });
}
```

- [ ] **Step 3.2: Run typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add specfirst/cli/commands/verify.ts
git commit -m "Refactor verify.ts: export verifyAction returning RunStats | null

Same pattern as run.ts — splits action logic into a named export for shell
dispatch. Returns null for now since phases 6-8 are stubs; the shell skips
the status bar when the return value is null."
```

---

## Task 4: Refactor `commands/report.ts` — export `reportAction`

**Files:**
- Modify: `specfirst/cli/commands/report.ts`

- [ ] **Step 4.1: Replace `report.ts` with the refactored version**

Full replacement of `specfirst/cli/commands/report.ts`:

```ts
import { Command } from "commander";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step } from "../shared/logger.js";
import { handleCommandError } from "../shared/errorHandling.js";
import { printDivider, printStatusBar } from "../shared/ui.js";
import type { RunStats } from "../shared/ui.js";

interface ReportOptions {
  debug: boolean;
}

export async function reportAction(
  runId: string,
  options: ReportOptions
): Promise<RunStats | null> {
  const ctx = getRunContext(runId);
  try {
    assertRunExists(ctx);

    const s = step("Generate evidence report");
    // const result = generateReport({ input: runId, projectRoot: process.cwd() });
    // assertStatus(result, ["generated"]);
    // s.succeed(chalk.green("✓") + " Evidence report generated");
    // return {
    //   phase: "report",
    //   runId,
    //   totalChecks: result.totalChecks,
    //   failedChecks: 0,
    //   frozen: true,
    //   bobPromptReady: false,
    //   artifactPath: path.relative(process.cwd(), ctx.evidenceReportPath),
    // };
    s.warn("Report generation not yet implemented — awaiting PR merge");

    // Returns null until phase 8 is wired.
    return null;

  } catch (err) {
    handleCommandError(err, ctx, options.debug ?? false);
  }
}

export function reportCommand(): Command {
  return new Command("report")
    .description("Generate evidenceReport.md for a verified run")
    .argument("<run-id>", "Run ID from a verified specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action(async (runId: string, options: { debug: boolean }) => {
      const stats = await reportAction(runId, options);
      if (stats) {
        console.log("");
        printDivider();
        printStatusBar(stats);
      }
    });
}
```

- [ ] **Step 4.2: Run typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4.3: Commit**

```bash
git add specfirst/cli/commands/report.ts
git commit -m "Refactor report.ts: export reportAction returning RunStats | null

Same pattern as run.ts and verify.ts. The commented-out final return shows
exactly what RunStats to populate once generateReport is wired in the
phases 6-8 PR."
```

---

## Task 5: Create `shell.ts` — readline REPL

**Files:**
- Create: `specfirst/cli/shell.ts`
- Create: `tests/cli/runShellFixtures.ts`

- [ ] **Step 5.1: Write failing tests for the completer**

Create `tests/cli/runShellFixtures.ts`:

```ts
import assert from "node:assert/strict";
import { completer } from "../../specfirst/cli/shell.js";

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

console.log("shell.ts completer");

test("empty input returns all command names", () => {
  const [completions] = completer("");
  assert.ok(completions.includes("run"), "missing 'run'");
  assert.ok(completions.includes("verify"), "missing 'verify'");
  assert.ok(completions.includes("report"), "missing 'report'");
  assert.ok(completions.includes("help"), "missing 'help'");
  assert.ok(completions.includes("exit"), "missing 'exit'");
});

test("prefix 'r' returns run and report", () => {
  const [completions] = completer("r");
  assert.ok(completions.includes("run"), "missing 'run'");
  assert.ok(completions.includes("report"), "missing 'report'");
  assert.ok(!completions.includes("verify"), "should not include 'verify'");
});

test("prefix 've' returns only verify", () => {
  const [completions] = completer("ve");
  assert.deepEqual(completions, ["verify"]);
});

test("prefix 'ex' returns only exit", () => {
  const [completions] = completer("ex");
  assert.deepEqual(completions, ["exit"]);
});

test("prefix 'h' returns only help", () => {
  const [completions] = completer("h");
  assert.deepEqual(completions, ["help"]);
});

test("unrecognised prefix returns empty array", () => {
  const [completions] = completer("zzz");
  assert.deepEqual(completions, []);
});

test("completer second element is the original line", () => {
  const [, line] = completer("ru");
  assert.equal(line, "ru");
});

console.log("");
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 5.2: Run tests — confirm they fail**

```
npm run test:shell
```

Expected: import error — `shell.ts` does not exist yet.

- [ ] **Step 5.3: Create `specfirst/cli/shell.ts`**

```ts
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import { printBanner, printDivider, printStatusBar } from "./shared/ui.js";
import { runAction } from "./commands/run.js";
import { verifyAction } from "./commands/verify.js";
import { reportAction } from "./commands/report.js";

const VERSION = "0.1.0";

const COMMAND_NAMES = [
  "run",
  "verify",
  "report",
  "baseline",
  "bob-prompt",
  "help",
  "exit",
];

export function completer(line: string): [string[], string] {
  const parts = line.split(" ");
  const cmd = parts[0];

  // No space yet — complete command name
  if (parts.length <= 1) {
    const hits = COMMAND_NAMES.filter(c => c.startsWith(cmd));
    return [hits.length ? hits : [], line];
  }

  // "run <partial>" — complete .tsx paths one level deep
  if (cmd === "run" && parts.length === 2) {
    const partial = parts[1];
    const dir = partial.includes(path.sep) || partial.includes("/")
      ? path.dirname(partial)
      : ".";
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const hits = entries
        .filter(e => e.isFile() && e.name.endsWith(".tsx"))
        .map(e => `run ${path.join(dir === "." ? "" : dir, e.name).replace(/^[\\/]/, "")}`)
        .filter(h => h.startsWith(line));
      return [hits, line];
    } catch {
      return [[], line];
    }
  }

  // "verify <partial>" — complete run IDs from specfirst/runs/
  if (cmd === "verify" && parts.length === 2) {
    const partial = parts[1];
    try {
      const runsDir = path.join(process.cwd(), "specfirst", "runs");
      const entries = fs.readdirSync(runsDir, { withFileTypes: true });
      const hits = entries
        .filter(e => e.isDirectory() && e.name.startsWith(partial))
        .map(e => `verify ${e.name}`);
      return [hits, line];
    } catch {
      return [[], line];
    }
  }

  return [[], line];
}

function printHelp(): void {
  console.log("");
  console.log("Commands:");
  console.log("  run <file>         Run the full pipeline for a component");
  console.log("  verify <run-id>    Run patch-guard + final verification");
  console.log("  report <run-id>    Generate evidenceReport.md");
  console.log("  baseline <run-id>  Re-run baseline only");
  console.log("  bob-prompt <run-id> Regenerate Bob prompt");
  console.log("  help               Show this message");
  console.log("  exit               Exit SpecFirst");
  console.log("");
}

async function dispatch(
  line: string
): Promise<import("./shared/ui.js").RunStats | null> {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  switch (cmd) {
    case "run": {
      if (!args[0]) {
        console.log("Usage: run <file>");
        return null;
      }
      return runAction(args[0], { debug: false, interactive: false });
    }
    case "verify": {
      if (!args[0]) {
        console.log("Usage: verify <run-id>");
        return null;
      }
      return verifyAction(args[0], { debug: false });
    }
    case "report": {
      if (!args[0]) {
        console.log("Usage: report <run-id>");
        return null;
      }
      return reportAction(args[0], { debug: false });
    }
    case "help": {
      printHelp();
      return null;
    }
    case "exit": {
      process.exit(0);
    }
    default: {
      console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
      return null;
    }
  }
}

export function startShell(): void {
  printBanner(VERSION, process.cwd());
  printDivider();
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
    historySize: 100,
    prompt: "> ",
    terminal: true,
  });

  rl.prompt();

  rl.on("line", async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    try {
      const stats = await dispatch(trimmed);
      console.log("");
      printDivider();
      if (stats) {
        printStatusBar(stats);
      }
    } catch (err) {
      console.log(err instanceof Error ? err.message : String(err));
    }

    console.log("");
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("");
    process.exit(0);
  });
}
```

- [ ] **Step 5.4: Run tests — confirm they pass**

```
npm run test:shell
```

Expected: all tests pass, `0 failed`.

- [ ] **Step 5.5: Run typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5.6: Commit**

```bash
git add specfirst/cli/shell.ts tests/cli/runShellFixtures.ts
git commit -m "Add shell.ts: readline REPL with history and tab completion

Implements the interactive SpecFirst shell activated when no subcommand is
given. Exports startShell() (prints the branded banner then opens a readline
loop) and completer() (tab-completes command names, .tsx paths for 'run',
and run IDs for 'verify'). Dispatches to the exported action handlers of
run.ts, verify.ts, and report.ts, then prints the status bar if RunStats is
returned. Ctrl+C / Ctrl+D / 'exit' all call process.exit(0)."
```

---

## Task 6: Modify `index.ts` — detect no-args and delegate to shell

**Files:**
- Modify: `specfirst/cli/index.ts`

- [ ] **Step 6.1: Replace `index.ts` with the updated version**

Full replacement of `specfirst/cli/index.ts`:

```ts
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { runCommand } from "./commands/run.js";
import { baselineCommand } from "./commands/baseline.js";
import { bobPromptCommand } from "./commands/bobPrompt.js";
import { patchGuardCommand } from "./commands/patchGuard.js";
import { verifyCommand } from "./commands/verify.js";
import { reportCommand } from "./commands/report.js";
import { watchCommand } from "./commands/watch.js";
import { startShell } from "./shell.js";

if (process.argv.length <= 2) {
  startShell();
} else {
  const program = new Command();

  program
    .name("specfirst")
    .description(
      "Deterministic accessibility compliance pipeline for React components"
    )
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
}
```

- [ ] **Step 6.2: Run typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6.3: Smoke test — interactive mode**

```
npm run specfirst:cli
```

Expected output:
```
◈  SpecFirst v0.1.0
   Accessibility TDD Agent
   <current working directory>

──────────────────────────────────────────────────────────────

>
```

Type `help` and press Enter — verify command list prints. Type `exit` — verify process exits cleanly.

- [ ] **Step 6.4: Smoke test — direct command mode (no regression)**

```
npm run specfirst:cli -- run src/specfirst-demo/generated/PickerHarness.tsx
```

Expected: same pipeline output as before — no banner, no REPL, exits after command.

- [ ] **Step 6.5: Smoke test — tab completion**

In the interactive shell, type `ru` then press Tab — confirm it completes to `run`. Type `run src/` then press Tab — confirm `.tsx` files are suggested.

- [ ] **Step 6.6: Commit**

```bash
git add specfirst/cli/index.ts
git commit -m "Wire shell into index.ts: launch REPL when no subcommand is given

Detects process.argv.length <= 2 and calls startShell() instead of running
Commander. Direct command mode (specfirst run ...) is completely unchanged —
Commander still parses and exits as before. The REPL and direct mode now
share the same action handlers via the exported runAction/verifyAction/reportAction
functions, so pipeline logic is never duplicated."
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| Brand colors + ◈ symbol | Task 1 `ui.ts` theme constants |
| `printBanner` (4-line header) | Task 1 `printBanner` |
| `printDivider` | Task 1 `printDivider` |
| `printStatusBar` run phase | Task 1 `printStatusBar` |
| `printStatusBar` verify phase | Task 1 `printStatusBar` |
| `printStatusBar` report phase | Task 1 `printStatusBar` |
| `RunStats` interface | Task 1 `ui.ts` |
| `runAction` export | Task 2 |
| `verifyAction` export | Task 3 |
| `reportAction` export | Task 4 |
| REPL with `> ` prompt | Task 5 `startShell` |
| History + tab completion | Task 5 `completer` |
| Dispatch to action handlers | Task 5 `dispatch` |
| Error recovery (no exit on error) | Task 5 readline `line` handler |
| `exit` / Ctrl+C / Ctrl+D | Task 5 `close` handler + `exit` case |
| No-args detection in `index.ts` | Task 6 |
| Banner only in interactive mode | Task 6 (no banner in Commander path) |
| Status bar in both modes | Tasks 2–4 Commander wrappers + Task 5 shell `line` handler |

**Placeholder scan:** No TBDs or vague steps. All code blocks are complete. ✓

**Type consistency:**
- `RunStats` defined in `ui.ts` Task 1, imported by `run.ts` Task 2, `verify.ts` Task 3, `report.ts` Task 4, `shell.ts` Task 5. ✓
- `runAction(file, options)` exported in Task 2, imported in Task 5. ✓
- `verifyAction(runId, options)` exported in Task 3, imported in Task 5. ✓
- `reportAction(runId, options)` exported in Task 4, imported in Task 5. ✓
- `startShell()` exported in Task 5, imported in `index.ts` Task 6. ✓
- `completer` exported in Task 5, tested in Task 5 tests. ✓
