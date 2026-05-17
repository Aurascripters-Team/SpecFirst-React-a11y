import { Command } from "commander";
import chalk from "chalk";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, info, printNextAction } from "../shared/logger.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";

// import { runPatchGuard } from "../../core/patch-guard/runPatchGuard.js";
// import { runVerification } from "../../core/verification/runVerification.js";

export function verifyCommand(): Command {
  return new Command("verify")
    .description("Run patch-guard then final verification (Phase 8)")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action((runId: string, options: { debug: boolean }) => {
      const ctx = getRunContext(runId);
      try {
        assertRunExists(ctx);

        // Step 1: patch guard
        const s1 = step("Patch guard");
        // const guardResult = runPatchGuard({ input: runId, projectRoot: process.cwd() });
        // assertStatus(guardResult, ["passed"]);
        // s1.succeed(chalk.green("✓") + " Patch guard passed");
        s1.warn("Patch guard not yet implemented — awaiting PR merge");

        // Step 2: final verification
        const s2 = step("Final verification");
        // const verifyResult = runVerification({ input: runId, projectRoot: process.cwd() });
        // assertStatus(verifyResult, ["passed", "failed", "invalidated"]);
        // if (verifyResult.status === "passed") {
        //   s2.succeed(chalk.green("✓") + ` Verification passed: ${verifyResult.passedCount}/${verifyResult.testCount} checks`);
        //   printNextAction(`  specfirst report ${runId}`);
        // } else {
        //   s2.fail(chalk.red("✗") + ` Verification ${verifyResult.status}: ${verifyResult.reason}`);
        // }
        s2.warn("Verification not yet implemented — awaiting PR merge");

      } catch (err) {
        handleCommandError(err, ctx, options.debug ?? false);
      }
    });
}
