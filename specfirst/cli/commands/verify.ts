import { Command } from "commander";
import chalk from "chalk";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, info, printNextAction } from "../shared/logger.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";
import { printDivider, printStatusBar } from "../shared/ui.js";
import type { RunStats } from "../shared/ui.js";

// import { runPatchGuard } from "../../core/patch-guard/runPatchGuard.js";
// import { runVerification } from "../../core/verification/runVerification.js";

export async function verifyAction(
  runId: string,
  options: { debug: boolean }
): Promise<RunStats | null> {
  const ctx = getRunContext(runId);
  try {
    assertRunExists(ctx);

    const s1 = step("Patch guard");
    s1.warn("Patch guard not yet implemented — awaiting PR merge");

    const s2 = step("Final verification");
    s2.warn("Verification not yet implemented — awaiting PR merge");

    return null;

  } catch (err) {
    handleCommandError(err, ctx, options.debug ?? false);
    return null;
  }
}

export function verifyCommand(): Command {
  return new Command("verify")
    .description("Run patch-guard then final verification (Phase 8)")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action(async (runId: string, options: { debug: boolean }) => {
      const stats = await verifyAction(runId, options);
      if (stats) {
        console.log("");
        printDivider();
        printStatusBar(stats);
      }
    });
}
