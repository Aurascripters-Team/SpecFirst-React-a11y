import { Command } from "commander";
import chalk from "chalk";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, printChecks } from "../shared/logger.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";

// Import from the phase 6-8 PR once merged:
// import { runBaseline } from "../../core/baseline/runBaseline.js";

export async function baselineAction(runId: string, options: { debug: boolean }): Promise<void> {
  const ctx = getRunContext(runId);
  try {
    assertRunExists(ctx);

    const s = step("Baseline");

    // TODO: uncomment once phase 6-8 PR merges
    // const result = runBaseline({ input: runId, projectRoot: process.cwd() });
    // assertStatus(result, ["red-confirmed"]);
    // s.fail(chalk.red("✗") + ` Baseline red-confirmed: ${result.failureCount} failed checks`);
    // printChecks(result.failedCheckIds);

    s.warn("Phase 6 not yet implemented — awaiting PR merge");
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
