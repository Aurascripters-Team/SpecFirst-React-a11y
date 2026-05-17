import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { BaselineRedConfirmed } from "../baseline/types.js";
import { parsePlaywrightJson } from "../baseline/parsePlaywrightJson.js";
import { classifyBaselineStatus } from "../baseline/classifyBaselineStatus.js";
import type { BobPatchResult, BobPatched, BobSessionMissing } from "../bob/types.js";
import type { LockedSpecSuccess } from "../spec/types.js";
import type { TestGenerationGenerated } from "../test-generation/types.js";
import { compareBaselineToFinal } from "./compareBaselineToFinal.js";
import type {
  ArtifactVerification,
  BobSessionEvidence,
  FinalFailed,
  FinalInfraFailed,
  FinalInvalidated,
  FinalPassed,
  FinalSkipped,
  FinalVerificationResult,
  RunFinalVerificationOptions,
} from "./types.js";

export function runFinalVerification(options: RunFinalVerificationOptions): FinalVerificationResult {
  const projectRoot = options.projectRoot ?? process.cwd();
  const writeArtifacts = options.writeArtifacts ?? true;
  const playwrightTimeout = options.playwrightTimeout ?? 180_000;

  const bobPatchResultPath = resolveBobPatchPath(options.input, projectRoot);
  const runDir = path.dirname(bobPatchResultPath);
  const runId = path.basename(runDir);
  const finalResultPath = path.join(runDir, "finalVerificationResult.json");
  const finalOutputJsonPath = path.join(runDir, "finalOutput.json");
  const finalOutputTxtPath = path.join(runDir, "finalOutput.txt");

  const skip = (reason: string, message: string): FinalSkipped => {
    const r: FinalSkipped = {
      schemaVersion: "1.0.0",
      phase: "final-verification",
      status: "skipped",
      reason,
      message,
      nextPhase: { canContinue: false },
    };
    if (writeArtifacts) writeJson(finalResultPath, r);
    return r;
  };

  if (!fs.existsSync(bobPatchResultPath)) {
    return skip("bob_patch_result_not_found", `bobPatchResult.json not found. Run Phase 7 first.`);
  }

  const bobPatchRead = readJson<BobPatchResult>(bobPatchResultPath);
  if (!bobPatchRead.ok) {
    const r: FinalInvalidated = {
      schemaVersion: "1.0.0",
      phase: "final-verification",
      status: "invalidated",
      reason: "bob_patch_result_malformed",
      message: "bobPatchResult.json could not be parsed.",
      nextPhase: { canContinue: false },
    };
    if (writeArtifacts) writeJson(finalResultPath, r);
    return r;
  }

  const bobPatch = (bobPatchRead as { ok: true; value: BobPatchResult }).value;

  if (bobPatch.status === "skipped" || bobPatch.status === "failed" || bobPatch.status === "patch-scope-failed" || bobPatch.status === "invalidated") {
    return skip("bob_patch_blocked", `bobPatchResult status is '${bobPatch.status}'. Phase 8 requires 'patched' or 'bob-session-missing'.`);
  }

  if (bobPatch.status !== "patched" && bobPatch.status !== "bob-session-missing") {
    return skip("bob_patch_not_complete", `bobPatchResult status is '${bobPatch.status}'. Phase 8 skipped.`);
  }

  const bv = bobPatch as (BobPatched | BobSessionMissing);

  const baselineResultPath = path.join(runDir, "baselineResult.json");
  const lockedSpecPath = path.resolve(projectRoot, bv.inputs.lockedSpecPath);
  const testGenPath = path.join(runDir, "testGenerationResult.json");

  if (!fs.existsSync(baselineResultPath) || !fs.existsSync(lockedSpecPath) || !fs.existsSync(testGenPath)) {
    return skip("missing_inputs", "One or more required input artifacts are missing from the run directory.");
  }

  const baseline = readJson<BaselineRedConfirmed>(baselineResultPath);
  const lockedSpec = readJson<LockedSpecSuccess>(lockedSpecPath);
  const testGen = readJson<TestGenerationGenerated>(testGenPath);

  if (!baseline.ok || !lockedSpec.ok || !testGen.ok) {
    return skip("malformed_inputs", "One or more input artifacts could not be parsed.");
  }

  const bline = baseline.value;
  const lspec = lockedSpec.value;
  const tgen = testGen.value;

  const absLockedSpec = path.resolve(projectRoot, bline.lockedSpecPath);
  const absTestFile = path.resolve(projectRoot, tgen.testFilePath);
  const absHarnessFile = path.resolve(projectRoot, tgen.harnessFilePath);

  // Verify immutable artifacts have not changed
  const currentLockedSpecHash = hashFile(absLockedSpec);
  const currentTestFileHash = hashFile(absTestFile);
  const currentHarnessFileHash = hashFile(absHarnessFile);

  const artifactVerification: ArtifactVerification = {
    lockedSpecPath: bline.lockedSpecPath,
    lockedSpecHash: currentLockedSpecHash,
    lockedSpecUnchanged: currentLockedSpecHash === bline.lockedSpecHash,
    testFilePath: tgen.testFilePath,
    testFileUnchanged: currentTestFileHash === bline.testFileHashBeforeRun,
    harnessFilePath: tgen.harnessFilePath,
    harnessFileUnchanged: currentHarnessFileHash === bline.harnessFileHashBeforeRun,
  };

  if (!artifactVerification.lockedSpecUnchanged || !artifactVerification.testFileUnchanged || !artifactVerification.harnessFileUnchanged) {
    const r: FinalInvalidated = {
      schemaVersion: "1.0.0",
      phase: "final-verification",
      status: "invalidated",
      reason: "artifact_integrity_failed",
      message: "Immutable artifacts changed between Phase 5 and Phase 8. The evidence chain is broken.",
      nextPhase: { canContinue: false },
    };
    if (writeArtifacts) writeJson(finalResultPath, r);
    return r;
  }

  // Run final Playwright test
  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const playwrightResult = spawnSync(
    npxCmd,
    ["playwright", "test", tgen.testFilePath, "--reporter=json"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: playwrightTimeout,
      shell: false,
    },
  );

  const rawJson = playwrightResult.stdout ?? "";
  const rawTxt = playwrightResult.stderr ?? "";

  if (writeArtifacts) {
    writeText(finalOutputTxtPath, rawTxt);
    if (rawJson.trim()) writeText(finalOutputJsonPath, rawJson);
  }

  if (playwrightResult.error) {
    const r: FinalInfraFailed = {
      schemaVersion: "1.0.0",
      phase: "final-verification",
      status: "infra-failed",
      reason: "playwright_spawn_error",
      message: `Playwright process could not be spawned: ${playwrightResult.error.message}`,
      rawOutput: rawTxt,
      nextPhase: { canContinue: false },
    };
    if (writeArtifacts) writeJson(finalResultPath, r);
    return r;
  }

  const parsed = parsePlaywrightJson(rawJson);
  const classification = classifyBaselineStatus(parsed, playwrightResult.status, rawTxt + rawJson);

  if (classification === "infra-failed") {
    const r: FinalInfraFailed = {
      schemaVersion: "1.0.0",
      phase: "final-verification",
      status: "infra-failed",
      reason: "playwright_infra_failure",
      message: "Playwright ran but tests did not execute properly.",
      rawOutput: rawTxt.slice(0, 4000),
      nextPhase: { canContinue: false },
    };
    if (writeArtifacts) writeJson(finalResultPath, r);
    return r;
  }

  const finalSummary = parsed!.testSummary;
  const finalFailedIds = parsed!.failedChecks.map((c) => c.id);
  const baselineFailedIds = bline.failedChecks.map((c) => c.id);
  const checkComparison = compareBaselineToFinal(baselineFailedIds, finalFailedIds);

  const manualReviewRequired: string[] = Array.isArray(lspec.manualReviewRequired)
    ? lspec.manualReviewRequired.map((item) =>
        typeof item === "object" && item !== null && "id" in item ? String((item as { id: string }).id) : String(item),
      )
    : [];

  const allowedClaims = lspec.accessibilityClaimBoundary?.allowedClaims ?? ["Passed SpecFirst automated contract. Manual review required."];
  const forbiddenClaims = lspec.accessibilityClaimBoundary?.forbiddenClaims ?? [
    "WCAG 2.2 AA compliant",
    "fully accessible",
    "accessibility guaranteed",
    "screen reader compatible",
    "Component passed WCAG",
  ];

  const patchScope = bv.patchScope ?? { changedFiles: [], status: "passed" };
  const bobSessionEvidence: BobSessionEvidence = {
    present: bobPatch.status === "patched" && Boolean((bobPatch as BobPatched).bobSession.sessionExportPath),
    sessionExportPath: bobPatch.status === "patched" ? (bobPatch as BobPatched).bobSession.sessionExportPath : null,
    status: bobPatch.status === "patched" && Boolean((bobPatch as BobPatched).bobSession.sessionExportPath) ? "present" : "incomplete",
  };

  const baseProps = {
    schemaVersion: "1.0.0" as const,
    phase: "final-verification" as const,
    component: lspec.component,
    lockedSpec: {
      path: bline.lockedSpecPath,
      hash: currentLockedSpecHash,
      unchanged: true,
    },
    generatedArtifacts: artifactVerification,
    baseline: {
      status: "red-confirmed",
      failedCheckIds: baselineFailedIds,
    },
    bobPatch: {
      sessionExportPath: bobSessionEvidence.sessionExportPath,
      patchScopePassed: patchScope.status === "passed",
      changedFiles: patchScope.changedFiles,
    },
    finalTestSummary: finalSummary,
    checkComparison,
    manualReviewRequired,
    claimBoundary: { allowedClaims, forbiddenClaims },
    bobSessionEvidence,
  };

  const allPassed = finalSummary.failed === 0;
  const evidenceReportInput = relativePath(projectRoot, path.join(runDir, "finalVerificationResult.json"));

  if (allPassed) {
    const r: FinalPassed = {
      ...baseProps,
      status: "passed",
      nextPhase: { canContinue: true, evidenceReportInput },
    };
    if (writeArtifacts) writeJson(finalResultPath, r);
    return r;
  }

  const r: FinalFailed = {
    ...baseProps,
    status: "failed",
    stillFailingChecks: finalFailedIds,
    nextPhase: { canContinue: true, evidenceReportInput },
  };
  if (writeArtifacts) writeJson(finalResultPath, r);
  return r;
}

function resolveBobPatchPath(input: string, projectRoot: string): string {
  if (input.endsWith(".json")) return path.resolve(projectRoot, input);
  return path.resolve(projectRoot, "specfirst", "runs", input, "bobPatchResult.json");
}

function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return "sha256:file-not-found";
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
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

function writeText(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function relativePath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}
