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
  assert.ok(ctx.runDir.endsWith(path.join("specfirst", "runs", "2026-05-16T20-01-11-151Z-analyze")));
});

test("getRunContext sets lockedSpecPath inside runDir", () => {
  const ctx = getRunContext("my-run", "/project");
  assert.equal(ctx.lockedSpecPath, path.join(ctx.runDir, "lockedSpec.json"));
});

test("getRunContext sets bobPromptPath inside runDir", () => {
  const ctx = getRunContext("my-run", "/project");
  assert.equal(ctx.bobPromptPath, path.join(ctx.runDir, "bobPrompt.md"));
});

test("getRunContext sets all expected paths in context", () => {
  const ctx = getRunContext("test-run", "/project");
  assert.ok(ctx.componentAnalysisPath.includes("componentAnalysis.json"));
  assert.ok(ctx.classificationPath.includes("classification.json"));
  assert.ok(ctx.manifestLoadResultPath.includes("manifestLoadResult.json"));
  assert.ok(ctx.manifestUsedPath.includes("manifestUsed.json"));
  assert.ok(ctx.testGenerationResultPath.includes("testGenerationResult.json"));
  assert.ok(ctx.baselineResultPath.includes("baselineResult.json"));
  assert.ok(ctx.finalVerificationResultPath.includes("finalVerificationResult.json"));
  assert.ok(ctx.evidenceReportPath.includes("evidenceReport.md"));
  assert.ok(ctx.debugLogPath.includes("debug.log"));
});

test("getRunContext includes runId in context", () => {
  const ctx = getRunContext("my-special-run", "/project");
  assert.equal(ctx.runId, "my-special-run");
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

test("assertStatus includes the result reason in the error when message is missing", () => {
  assert.throws(
    () => assertStatus({ status: "failed", reason: "validation failed" }, ["locked"]),
    /validation failed/
  );
});

test("assertStatus handles multiple allowed statuses", () => {
  assertStatus({ status: "passed" }, ["passed", "failed", "invalidated"]);
  assertStatus({ status: "failed" }, ["passed", "failed", "invalidated"]);
  assertStatus({ status: "invalidated" }, ["passed", "failed", "invalidated"]);
});

test("assertStatus throws with all expected statuses in error message", () => {
  assert.throws(
    () => assertStatus({ status: "unknown" }, ["passed", "failed", "skipped"]),
    /Expected one of: passed, failed, skipped/
  );
});

// Summary
console.log("");
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
