import { Command } from "commander";
import chalk from "chalk";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, printChecks, info } from "../shared/logger.js";
import { handleCommandError } from "../shared/errorHandling.js";
import { runBaseline } from "../../core/baseline/runBaseline.js";

export async function baselineAction(runId: string, options: { debug: boolean; fromShell?: boolean }): Promise<void> {
  const ctx = getRunContext(runId);
  try {
    assertRunExists(ctx);

    const s = step("Baseline");
    const result = runBaseline({ input: runId, projectRoot: process.cwd() });

    if (result.status === "red-confirmed") {
      s.succeed(chalk.green("✓") + ` Baseline red-confirmed: ${result.failedChecks.length} failed checks`);
      printChecks(result.failedChecks.map(c => c.id));
      info("");
      info(options.fromShell
        ? `  Next: bob-prompt ${runId}`
        : `  Next: npm run specfirst:bob-prompt -- ${runId}`);
    } else if (result.status === "green-unexpected") {
      s.warn("All tests passed before patching — check if component is already compliant.");
    } else if (result.status === "infra-failed") {
      s.fail(chalk.red("✗") + ` Infrastructure failure: ${result.reason}`);
    } else if (result.status === "invalidated") {
      s.fail(chalk.red("✗") + ` Artifact hashes changed since Phase 5. Chain of custody broken.`);
    } else {
      s.fail(chalk.red("✗") + ` Baseline ${result.status}: ${(result as { reason?: string }).reason ?? ""}`);
    }
  } catch (err) {
    handleCommandError(err, ctx, options.debug ?? false);
  }
}

export function baselineCommand(): Command {
  return new Command("baseline")
    .description("Re-run Phase 6 baseline (useful for debugging)")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action((runId: string, options: { debug: boolean }) => {
      baselineAction(runId, options);
    });
}
