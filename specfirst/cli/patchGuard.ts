import fs from "node:fs";
import path from "node:path";
import { runPatchScopeGuard } from "../core/bob/patchScopeGuard.js";
import { verifyArtifactIntegrity } from "../core/bob/verifyArtifactIntegrity.js";
import type { BaselineRedConfirmed } from "../core/baseline/types.js";
import type { LockedSpecSuccess } from "../core/spec/types.js";
import type { TestGenerationGenerated } from "../core/test-generation/types.js";
import type {
  BobFailed,
  BobInvalidated,
  BobPatched,
  BobPatchScopeFailed,
  BobSessionMissing,
} from "../core/bob/types.js";

const [, , input, bobSessionPathArg] = process.argv;

if (!input) {
  console.error("Usage: tsx specfirst/cli/patchGuard.ts <run-id|path-to-baselineResult.json> [bob-session-path]");
  process.exit(1);
}

const projectRoot = process.cwd();
console.log(`[Phase 7] Running patch scope guard for: ${input}`);

const baselineResultPath = resolveBaselinePath(input, projectRoot);
const runDir = path.dirname(baselineResultPath);
const bobPatchResultPath = path.join(runDir, "bobPatchResult.json");

const fail = (reason: string, message: string, details?: unknown): never => {
  const result: BobFailed = {
    schemaVersion: "1.0.0",
    status: "failed",
    reason,
    message,
    ...(details === undefined ? {} : { details }),
    nextPhase: { canContinue: false },
  };
  writeJson(bobPatchResultPath, result);
  console.error(`[Phase 7] FAILED: ${reason} — ${message}`);
  process.exit(1);
};

if (!fs.existsSync(baselineResultPath)) {
  fail("baseline_result_not_found", `baselineResult.json not found. Run Phase 6 first.`);
}

const baseline = readJson<BaselineRedConfirmed>(baselineResultPath);
if (!baseline.ok || baseline.value.status !== "red-confirmed") {
  fail("baseline_not_red_confirmed", `baseline status must be 'red-confirmed' to run patch guard.`);
}

const bv = (baseline as { ok: true; value: BaselineRedConfirmed }).value;
const lockedSpecPath = path.resolve(projectRoot, bv.lockedSpecPath);
const testGenPath = path.join(runDir, "testGenerationResult.json");
const lockedSpec = readJson<LockedSpecSuccess>(lockedSpecPath);
const testGen = readJson<TestGenerationGenerated>(testGenPath);

if (!lockedSpec.ok) fail("locked_spec_malformed", "lockedSpec.json could not be parsed.");
if (!testGen.ok) fail("test_gen_malformed", "testGenerationResult.json could not be parsed.");

const lv = (lockedSpec as { ok: true; value: LockedSpecSuccess }).value;
const tv = (testGen as { ok: true; value: TestGenerationGenerated }).value;

const absLockedSpec = path.resolve(projectRoot, bv.lockedSpecPath);
const absTestFile = path.resolve(projectRoot, tv.testFilePath);
const absHarnessFile = path.resolve(projectRoot, tv.harnessFilePath);

// Verify immutable artifact hashes
const integrity = verifyArtifactIntegrity(
  absLockedSpec,
  absTestFile,
  absHarnessFile,
  bv.lockedSpecHash,
  bv.testFileHashBeforeRun,
  bv.harnessFileHashBeforeRun,
);

const base = {
  schemaVersion: "1.0.0" as const,
  component: lv.component,
  inputs: {
    lockedSpecPath: bv.lockedSpecPath,
    baselineResultPath: rel(projectRoot, baselineResultPath),
    testGenerationResultPath: rel(projectRoot, testGenPath),
  },
  bobPromptPath: rel(projectRoot, path.join(runDir, "bobPrompt.md")),
};

if (!integrity.lockedSpecUnchanged || !integrity.testFileUnchanged || !integrity.harnessFileUnchanged) {
  const invalidated: BobInvalidated = {
    ...base,
    status: "invalidated",
    reason: "artifact_integrity_failed",
    message: "Immutable artifacts (lockedSpec, test file, or harness) were changed after Phase 5. This invalidates the pipeline.",
    artifactIntegrity: integrity,
    nextPhase: { canContinue: false },
  };
  writeJson(bobPatchResultPath, invalidated);
  console.error("[Phase 7] INVALIDATED: Immutable artifacts changed.");
  if (!integrity.lockedSpecUnchanged) console.error("  - lockedSpec.json was modified.");
  if (!integrity.testFileUnchanged) console.error(`  - ${tv.testFilePath} was modified.`);
  if (!integrity.harnessFileUnchanged) console.error(`  - ${tv.harnessFilePath} was modified.`);
  process.exit(1);
}

// Patch scope guard
const patchScope = runPatchScopeGuard(
  lv.component.path,
  bv.lockedSpecPath,
  tv.testFilePath,
  tv.harnessFilePath,
  projectRoot,
);

console.log(`[Phase 7] Changed files: ${patchScope.changedFiles.join(", ") || "(none)"}`);

if (patchScope.status === "failed") {
  const scopeFailed: BobPatchScopeFailed = {
    ...base,
    status: "patch-scope-failed",
    patchScope,
    artifactIntegrity: integrity,
    nextPhase: { canContinue: false },
  };
  writeJson(bobPatchResultPath, scopeFailed);
  console.error("[Phase 7] PATCH SCOPE FAILED: Bob edited forbidden files.");
  for (const f of patchScope.forbiddenChangedFiles) {
    console.error(`  - FORBIDDEN: ${f}`);
  }
  process.exit(1);
}

// Bob session evidence
const bobSessionPath = bobSessionPathArg ?? null;
const sessionExportPath = bobSessionPath ? rel(projectRoot, bobSessionPath) : null;

if (!bobSessionPath || !fs.existsSync(path.resolve(projectRoot, bobSessionPath))) {
  const sessionMissing: BobSessionMissing = {
    ...base,
    status: "bob-session-missing",
    patchScope,
    artifactIntegrity: integrity,
    nextPhase: {
      canContinue: true,
      warning: "Bob session export not provided. Evidence is incomplete for hackathon submission.",
      finalVerificationCommand: `npx playwright test ${tv.testFilePath}`,
    },
  };
  writeJson(bobPatchResultPath, sessionMissing);
  console.warn("[Phase 7] WARNING: No Bob session export provided. Evidence incomplete.");
  console.warn("  Patch scope passed. Continuing to Phase 8 but Bob evidence is missing.");
  console.log(`[Phase 7] Next: verify ${input}`);
  process.exit(0);
}

const patched: BobPatched = {
  ...base,
  status: "patched",
  mode: "bob-ide-manual",
  bobSession: {
    required: true,
    sessionExportPath,
    consumptionSummaryPath: null,
  },
  patchScope,
  artifactIntegrity: integrity,
  nextPhase: {
    canContinue: true,
    finalVerificationCommand: `npx playwright test ${tv.testFilePath}`,
  },
};
writeJson(bobPatchResultPath, patched);
console.log(`[Phase 7] Patch scope PASSED. Bob session recorded.`);
console.log(`[Phase 7] bobPatchResult.json written to: ${rel(projectRoot, bobPatchResultPath)}`);
console.log(`[Phase 7] Next: npm run specfirst:verify-final -- ${input}`);

function resolveBaselinePath(inp: string, root: string): string {
  if (inp.endsWith(".json")) return path.resolve(root, inp);
  return path.resolve(root, "specfirst", "runs", inp, "baselineResult.json");
}

function readJson<T>(filePath: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, "utf8")) as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function rel(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, "/");
}
