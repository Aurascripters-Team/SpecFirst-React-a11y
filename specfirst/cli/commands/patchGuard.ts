import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, info, warn } from "../shared/logger.js";
import { handleCommandError } from "../shared/errorHandling.js";
import { runPatchScopeGuard } from "../../core/bob/patchScopeGuard.js";
import { verifyArtifactIntegrity } from "../../core/bob/verifyArtifactIntegrity.js";
import type {
  BobPatched,
  BobSessionMissing,
  BobPatchScopeFailed,
  BobInvalidated,
} from "../../core/bob/types.js";
import type { BaselineRedConfirmed } from "../../core/baseline/types.js";
import type { LockedSpecSuccess } from "../../core/spec/types.js";
import type { TestGenerationGenerated } from "../../core/test-generation/types.js";

export async function patchGuardAction(
  runId: string,
  options: { debug: boolean; fromShell?: boolean },
  bobSessionPath?: string
): Promise<void> {
  const ctx = getRunContext(runId);
  try {
    assertRunExists(ctx);

    // Read required artifacts
    const baseline = readJson<BaselineRedConfirmed>(ctx.baselineResultPath);
    if (!baseline.ok) {
      console.log(chalk.red("✗") + ` baselineResult.json missing — run 'baseline ${runId}' first`);
      return;
    }

    const lockedSpec = readJson<LockedSpecSuccess>(ctx.lockedSpecPath);
    const testGen = readJson<TestGenerationGenerated>(ctx.testGenerationResultPath);
    if (!lockedSpec.ok || !testGen.ok) {
      console.log(chalk.red("✗") + ` Missing artifacts — run 'run' and 'baseline' first`);
      return;
    }

    const bv = (baseline as { ok: true; value: BaselineRedConfirmed }).value;
    const lv = (lockedSpec as { ok: true; value: LockedSpecSuccess }).value;
    const tv = (testGen as { ok: true; value: TestGenerationGenerated }).value;

    const projectRoot = process.cwd();
    const absLockedSpec = path.resolve(projectRoot, bv.lockedSpecPath);
    const absTestFile = path.resolve(projectRoot, tv.testFilePath);
    const absHarnessFile = path.resolve(projectRoot, tv.harnessFilePath);

    // Step 1: Verify artifact integrity
    const s1 = step("Artifact integrity");
    const integrity = verifyArtifactIntegrity(
      absLockedSpec, absTestFile, absHarnessFile,
      bv.lockedSpecHash, bv.testFileHashBeforeRun, bv.harnessFileHashBeforeRun,
    );

    if (!integrity.lockedSpecUnchanged || !integrity.testFileUnchanged || !integrity.harnessFileUnchanged) {
      s1.fail(chalk.red("✗") + ` Immutable artifacts were modified after Phase 5`);
      const result: BobInvalidated = {
        schemaVersion: "1.0.0",
        status: "invalidated",
        reason: "artifact_integrity_failed",
        message: "Locked spec, test file, or harness was modified after Phase 5.",
        component: lv.component,
        inputs: { lockedSpecPath: bv.lockedSpecPath, baselineResultPath: ctx.baselineResultPath, testGenerationResultPath: ctx.testGenerationResultPath },
        bobPromptPath: ctx.bobPromptPath,
        artifactIntegrity: integrity,
        nextPhase: { canContinue: false },
      };
      writeJson(ctx.runDir + "/bobPatchResult.json", result);
      return;
    }
    s1.succeed(chalk.green("✓") + ` Locked spec, tests, harness unchanged`);

    // Step 2: Patch scope guard
    const s2 = step("Patch scope");
    const patchScope = runPatchScopeGuard(
      lv.component.path,
      bv.lockedSpecPath,
      tv.testFilePath,
      tv.harnessFilePath,
      projectRoot,
    );

    if (patchScope.status === "failed") {
      s2.fail(chalk.red("✗") + ` Bob edited forbidden files: ${patchScope.forbiddenChangedFiles.join(", ")}`);
      const result: BobPatchScopeFailed = {
        schemaVersion: "1.0.0",
        status: "patch-scope-failed",
        component: lv.component,
        inputs: { lockedSpecPath: bv.lockedSpecPath, baselineResultPath: ctx.baselineResultPath, testGenerationResultPath: ctx.testGenerationResultPath },
        bobPromptPath: ctx.bobPromptPath,
        patchScope,
        artifactIntegrity: integrity,
        nextPhase: { canContinue: false },
      };
      writeJson(ctx.runDir + "/bobPatchResult.json", result);
      return;
    }
    s2.succeed(chalk.green("✓") + ` Bob patched only allowed files`);
    info(`  Changed: ${patchScope.changedFiles.join(", ") || "(none)"}`);

    // Step 3: Write bobPatchResult.json
    const sessionPath = bobSessionPath ?? null;
    const hasSession = sessionPath !== null && fs.existsSync(sessionPath);

    if (hasSession) {
      const result: BobPatched = {
        schemaVersion: "1.0.0",
        status: "patched",
        mode: "bob-ide-manual",
        component: lv.component,
        inputs: { lockedSpecPath: bv.lockedSpecPath, baselineResultPath: ctx.baselineResultPath, testGenerationResultPath: ctx.testGenerationResultPath },
        bobPromptPath: ctx.bobPromptPath,
        bobSession: { required: true, sessionExportPath: sessionPath, consumptionSummaryPath: null },
        patchScope,
        artifactIntegrity: integrity,
        nextPhase: { canContinue: true, finalVerificationCommand: `verify ${runId}` },
      };
      writeJson(ctx.runDir + "/bobPatchResult.json", result);
    } else {
      warn("  No Bob session export provided — evidence incomplete for submission");
      const result: BobSessionMissing = {
        schemaVersion: "1.0.0",
        status: "bob-session-missing",
        component: lv.component,
        inputs: { lockedSpecPath: bv.lockedSpecPath, baselineResultPath: ctx.baselineResultPath, testGenerationResultPath: ctx.testGenerationResultPath },
        bobPromptPath: ctx.bobPromptPath,
        patchScope,
        artifactIntegrity: integrity,
        nextPhase: { canContinue: true, warning: "Bob session export missing", finalVerificationCommand: `verify ${runId}` },
      };
      writeJson(ctx.runDir + "/bobPatchResult.json", result);
    }

    info("");
    info(options.fromShell
      ? `  Next: verify ${runId}`
      : `  Next: npm run specfirst:verify-final -- ${runId}`);

  } catch (err) {
    handleCommandError(err, ctx, options.debug ?? false);
  }
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
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

export function patchGuardCommand(): Command {
  return new Command("patch-guard")
    .description("Verify Bob patched only the allowed file (Phase 7b)")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .argument("[session]", "Path to Bob session export .md file (optional)")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action(async (runId: string, session: string | undefined, options: { debug: boolean }) => {
      await patchGuardAction(runId, options, session);
    });
}
