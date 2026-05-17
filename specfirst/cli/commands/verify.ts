import { Command } from "commander";
import chalk from "chalk";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, info, printChecks } from "../shared/logger.js";
import { handleCommandError } from "../shared/errorHandling.js";
import { printResult } from "../shared/ui.js";
import type { RunStats } from "../shared/ui.js";
import { runFinalVerification } from "../../core/final-verification/runFinalVerification.js";

export async function verifyAction(
  runId: string,
  options: { debug: boolean; fromShell?: boolean }
): Promise<RunStats | null> {
  const ctx = getRunContext(runId);
  try {
    assertRunExists(ctx);

    const s = step("Final verification");
    const result = runFinalVerification({ input: runId, projectRoot: process.cwd() });

    if (result.status === "passed") {
      s.succeed(chalk.green("✓") + ` All checks passed`);
      info("");
      info(options.fromShell
        ? `  Next: report ${runId}`
        : `  Next: npm run specfirst:report -- ${runId}`);
      return {
        phase: "verify",
        runId,
        totalChecks: result.finalTestSummary.total,
        failedChecks: result.finalTestSummary.failed,
        frozen: true,
        bobPromptReady: false,
      };
    } else if (result.status === "failed") {
      s.warn(`Some checks still failing after Bob patch`);
      printChecks(result.stillFailingChecks ?? []);
      info("");
      info(options.fromShell
        ? `  Next: report ${runId}`
        : `  Next: npm run specfirst:report -- ${runId}`);
      return {
        phase: "verify",
        runId,
        totalChecks: result.finalTestSummary.total,
        failedChecks: result.finalTestSummary.failed,
        frozen: true,
        bobPromptReady: false,
      };
    } else if (result.status === "skipped") {
      s.warn(`Skipped: ${result.reason}`);
    } else if (result.status === "invalidated") {
      s.fail(chalk.red("✗") + ` Chain of custody broken — artifacts were modified`);
    } else if (result.status === "infra-failed") {
      s.fail(chalk.red("✗") + ` Infrastructure failure: ${(result as { reason?: string }).reason ?? "unknown"}`);
    }

    return null;

  } catch (err) {
    handleCommandError(err, ctx, options.debug ?? false);
    return null;
  }
}

export function verifyCommand(): Command {
  return new Command("verify")
    .description("Run final verification (Phase 8)")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action(async (runId: string, options: { debug: boolean }) => {
      const stats = await verifyAction(runId, options);
      printResult(stats);
    });
}
