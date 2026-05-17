import { Command } from "commander";
import path from "node:path";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, info } from "../shared/logger.js";
import { handleCommandError } from "../shared/errorHandling.js";
import { generateBobPrompt } from "../../core/bob/generateBobPrompt.js";
import type { BaselineRedConfirmed } from "../../core/baseline/types.js";
import type { LockedSpecSuccess } from "../../core/spec/types.js";
import type { TestGenerationGenerated } from "../../core/test-generation/types.js";
import fs from "node:fs";
import chalk from "chalk";

export async function bobPromptAction(runId: string, options: { debug: boolean }): Promise<void> {
  const ctx = getRunContext(runId);
  try {
    assertRunExists(ctx);

    const s = step("Generate Bob prompt");

    const baselineRaw = readJson<BaselineRedConfirmed>(ctx.baselineResultPath);
    if (!baselineRaw.ok) {
      s.fail(chalk.red("✗") + ` baselineResult.json missing or malformed — run 'baseline ${runId}' first`);
      return;
    }
    const baseline = baselineRaw.value;

    if (baseline.status !== "red-confirmed") {
      s.fail(chalk.red("✗") + ` Baseline status is '${baseline.status}'. Must be 'red-confirmed' to generate Bob prompt.`);
      return;
    }

    const lockedSpecRaw = readJson<LockedSpecSuccess>(ctx.lockedSpecPath);
    const testGenRaw = readJson<TestGenerationGenerated>(ctx.testGenerationResultPath);
    if (!lockedSpecRaw.ok || !testGenRaw.ok) {
      s.fail(chalk.red("✗") + ` lockedSpec.json or testGenerationResult.json missing`);
      return;
    }

    const { promptText } = generateBobPrompt(
      lockedSpecRaw.value,
      baseline,
      testGenRaw.value,
      process.cwd(),
      ctx.bobPromptPath,
    );

    s.succeed(chalk.green("✓") + ` Bob prompt generated`);
    info(`  ${path.relative(process.cwd(), ctx.bobPromptPath)}`);
    info("");
    info("  Next steps:");
    info("  1. Open IBM Bob IDE in this project");
    info(`  2. Use the prompt at: ${path.relative(process.cwd(), ctx.bobPromptPath)}`);
    info(`  3. Bob should patch only: ${lockedSpecRaw.value.component.path}`);
    info("  4. Export the Bob session markdown to bob_sessions/");
    info(`  5. Run: specfirst:patch-guard -- ${runId} bob_sessions/<session>.md`);

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

export function bobPromptCommand(): Command {
  return new Command("bob-prompt")
    .description("Generate the Bob remediation prompt from baseline failures")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action((runId: string, options: { debug: boolean }) => {
      bobPromptAction(runId, options);
    });
}
