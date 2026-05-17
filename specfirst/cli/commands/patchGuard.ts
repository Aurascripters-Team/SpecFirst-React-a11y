import { Command } from "commander";
import chalk from "chalk";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, info } from "../shared/logger.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";

// import { runPatchGuard } from "../../core/patch-guard/runPatchGuard.js";

export function patchGuardCommand(): Command {
  return new Command("patch-guard")
    .description("Verify Bob did not edit forbidden files (standalone debug tool)")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action((runId: string, options: { debug: boolean }) => {
      const ctx = getRunContext(runId);
      try {
        assertRunExists(ctx);

        const s = step("Patch guard");

        // TODO: uncomment once phase 6-8 PR merges
        // const result = runPatchGuard({ input: runId, projectRoot: process.cwd() });
        // assertStatus(result, ["passed"]);
        // s.succeed(chalk.green("✓") + " Patch guard passed — no forbidden files modified");

        s.warn("Phase 8 patch-guard not yet implemented — awaiting PR merge");
      } catch (err) {
        handleCommandError(err, ctx, options.debug ?? false);
      }
    });
}
