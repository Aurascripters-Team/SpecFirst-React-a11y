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
  return s.replace(/\[[0-9;]*m/g, "");
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
