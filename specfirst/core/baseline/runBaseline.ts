import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { TestGenerationResult } from "../test-generation/types.js";
import { classifyBaselineStatus } from "./classifyBaselineStatus.js";
import { parsePlaywrightJson } from "./parsePlaywrightJson.js";
import type {
  BaselineFailed,
  BaselineInfraFailed,
  BaselineInvalidated,
  BaselineRedConfirmed,
  BaselineGreenUnexpected,
  BaselineResult,
  BaselineSkipped,
  BaselineValidation,
  HashMismatch,
  RunBaselineOptions,
} from "./types.js";

export function runBaseline(options: RunBaselineOptions): BaselineResult {
  const projectRoot = options.projectRoot ?? process.cwd();
  const writeArtifacts = options.writeArtifacts ?? true;
  const playwrightTimeout = options.playwrightTimeout ?? 180_000;

  const testGenPath = resolveTestGenPath(options.input, projectRoot);
  const runDir = path.dirname(testGenPath);
  const runId = path.basename(runDir);
  const resultPath = path.join(runDir, "baselineResult.json");
  const outputJsonPath = path.join(runDir, "baselineOutput.json");
  const outputTxtPath = path.join(runDir, "baselineOutput.txt");
  const relTestGenPath = relativePath(projectRoot, testGenPath);

  const fail = (reason: string, message: string, details?: unknown): BaselineFailed => {
    const result: BaselineFailed = {
      schemaVersion: "1.0.0",
      phase: "baseline",
      status: "failed",
      reason,
      message,
      ...(details === undefined ? {} : { details }),
      nextPhase: { canContinue: false },
    };
    if (writeArtifacts) writeJson(resultPath, result);
    return result;
  };

  if (!fs.existsSync(testGenPath)) {
    return fail("test_generation_result_not_found", `testGenerationResult.json not found at ${relTestGenPath}.`);
  }

  const testGenRead = readJson<TestGenerationResult>(testGenPath);
  if (!testGenRead.ok) {
    return fail("test_generation_result_malformed", `testGenerationResult.json could not be parsed at ${relTestGenPath}.`, testGenRead.error);
  }

  const testGen = testGenRead.value;

  if (testGen.status === "skipped") {
    const skipped: BaselineSkipped = {
      schemaVersion: "1.0.0",
      phase: "baseline",
      status: "skipped",
      reason: "test_generation_skipped",
      message: "Phase 5 was skipped. Phase 6 cannot run baseline without generated tests.",
      nextPhase: { canContinue: false },
    };
    if (writeArtifacts) writeJson(resultPath, skipped);
    return skipped;
  }

  if (testGen.status !== "generated") {
    return fail("test_generation_not_generated", `testGenerationResult.json status is '${testGen.status}'. Phase 6 requires status 'generated'.`);
  }

  if (!testGen.nextPhase.canContinue) {
    const skipped: BaselineSkipped = {
      schemaVersion: "1.0.0",
      phase: "baseline",
      status: "skipped",
      reason: "test_generation_blocked",
      message: "Phase 5 nextPhase.canContinue is false. Phase 6 skipped.",
      nextPhase: { canContinue: false },
    };
    if (writeArtifacts) writeJson(resultPath, skipped);
    return skipped;
  }

  const { testFilePath, harnessFilePath, lockedSpecPath } = testGen;
  const absTestFile = path.resolve(projectRoot, testFilePath);
  const absHarnessFile = path.resolve(projectRoot, harnessFilePath);
  const absLockedSpec = path.resolve(projectRoot, lockedSpecPath);
  const command = `npx playwright test ${testFilePath} --reporter=json`;

  const baseBase = {
    schemaVersion: "1.0.0" as const,
    phase: "baseline" as const,
    runId,
    lockedSpecPath,
    testFilePath,
    harnessFilePath,
    command,
  };

  if (!fs.existsSync(absTestFile)) {
    return fail("test_file_missing", `Generated test file not found: ${testFilePath}`);
  }

  if (!fs.existsSync(absHarnessFile)) {
    return fail("harness_file_missing", `Generated harness file not found: ${harnessFilePath}`);
  }

  if (!fs.existsSync(absLockedSpec)) {
    return fail("locked_spec_missing", `Locked spec not found: ${lockedSpecPath}`);
  }

  // Step 3: Verify artifact hashes before running
  const currentLockedSpecHash = hashFile(absLockedSpec);
  const currentTestFileHash = hashFile(absTestFile);
  const currentHarnessFileHash = hashFile(absHarnessFile);

  const hashMismatches: HashMismatch[] = [];

  if (currentLockedSpecHash !== testGen.lockedSpecHash) {
    hashMismatches.push({ artifact: "lockedSpec", expected: testGen.lockedSpecHash, actual: currentLockedSpecHash });
  }

  if (currentTestFileHash !== testGen.testFileHash) {
    hashMismatches.push({ artifact: "testFile", expected: testGen.testFileHash, actual: currentTestFileHash });
  }

  if (currentHarnessFileHash !== testGen.harnessFileHash) {
    hashMismatches.push({ artifact: "harnessFile", expected: testGen.harnessFileHash, actual: currentHarnessFileHash });
  }

  if (hashMismatches.length > 0) {
    const invalidated: BaselineInvalidated = {
      ...baseBase,
      status: "invalidated",
      reason: "artifact_hash_mismatch",
      message: "One or more generated artifacts were modified after Phase 5. Cannot run baseline on tampered artifacts.",
      hashMismatches,
      nextPhase: { canContinue: false },
    };
    if (writeArtifacts) writeJson(resultPath, invalidated);
    return invalidated;
  }

  // Step 4: Run Playwright with JSON reporter
  const playwrightResult = spawnSync(
    "npx",
    ["playwright", "test", testFilePath, "--reporter=json"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: playwrightTimeout,
      shell: true,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    },
  );

  const rawJson = playwrightResult.stdout ?? "";
  const rawTxt = playwrightResult.stderr ?? "";
  const exitCode = playwrightResult.status;

  if (writeArtifacts) {
    writeText(outputTxtPath, rawTxt);
    if (rawJson.trim()) {
      writeText(outputJsonPath, rawJson);
    }
  }

  if (playwrightResult.error) {
    const infra: BaselineInfraFailed = {
      ...baseBase,
      status: "infra-failed",
      reason: "playwright_spawn_error",
      message: `Playwright process could not be spawned: ${playwrightResult.error.message}`,
      rawOutput: rawTxt,
      nextPhase: { canContinue: false },
    };
    if (writeArtifacts) writeJson(resultPath, infra);
    return infra;
  }

  // Step 5: Parse test results
  const parsed = parsePlaywrightJson(rawJson);
  const classification = classifyBaselineStatus(parsed, exitCode, rawTxt + rawJson);

  if (classification === "infra-failed") {
    const infra: BaselineInfraFailed = {
      ...baseBase,
      status: "infra-failed",
      reason: "playwright_infra_failure",
      message: "Playwright ran but tests did not execute. Likely a Vite server, browser, or import error.",
      rawOutput: rawTxt.slice(0, 4000),
      nextPhase: { canContinue: false },
    };
    if (writeArtifacts) writeJson(resultPath, infra);
    return infra;
  }

  const testSummary = parsed!.testSummary;
  const passedChecks = parsed!.passedChecks;
  const failedChecks = parsed!.failedChecks;

  const validation: BaselineValidation = {
    testsRan: parsed!.testsRan,
    testFileUnchanged: true,
    harnessFileUnchanged: true,
    lockedSpecUnchanged: true,
    meaningfulFailureCount: failedChecks.length,
    redConfirmed: classification === "red-confirmed",
  };

  if (classification === "red-confirmed") {
    const result: BaselineRedConfirmed = {
      ...baseBase,
      status: "red-confirmed",
      lockedSpecHash: currentLockedSpecHash,
      testFileHashBeforeRun: currentTestFileHash,
      harnessFileHashBeforeRun: currentHarnessFileHash,
      testSummary,
      passedChecks,
      failedChecks,
      baselineValidation: validation,
      nextPhase: {
        canContinue: true,
        bobPromptInput: relativePath(projectRoot, resultPath),
      },
    };
    if (writeArtifacts) writeJson(resultPath, result);
    return result;
  }

  // green-unexpected
  const result: BaselineGreenUnexpected = {
    ...baseBase,
    status: "green-unexpected",
    lockedSpecHash: currentLockedSpecHash,
    testFileHashBeforeRun: currentTestFileHash,
    harnessFileHashBeforeRun: currentHarnessFileHash,
    testSummary,
    passedChecks,
    failedChecks,
    baselineValidation: validation,
    nextPhase: {
      canContinue: false,
      reason: "All generated tests passed before Bob patched the component. The component may already satisfy the contract, or the tests may be too weak.",
    },
  };
  if (writeArtifacts) writeJson(resultPath, result);
  return result;
}

function resolveTestGenPath(input: string, projectRoot: string): string {
  if (input.endsWith(".json")) {
    return path.resolve(projectRoot, input);
  }
  return path.resolve(projectRoot, "specfirst", "runs", input, "testGenerationResult.json");
}

function hashFile(filePath: string): string {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function readJson<T>(filePath: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, "utf8")) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function relativePath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}
