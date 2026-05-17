import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, info } from "../shared/logger.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";
import { printDivider, printStatusBar } from "../shared/ui.js";
import type { RunStats } from "../shared/ui.js";

// import { generateReport } from "../../core/report/generateReport.js";

export async function reportAction(
  runId: string,
  options: { debug: boolean }
): Promise<RunStats | null> {
  const ctx = getRunContext(runId);
  try {
    assertRunExists(ctx);

    const s = step("Generate evidence report");
    s.warn("Report generation not yet implemented — awaiting PR merge");

    return null;

  } catch (err) {
    handleCommandError(err, ctx, options.debug ?? false);
    return null;
  }
}

export function reportCommand(): Command {
  return new Command("report")
    .description("Generate evidenceReport.md for a verified run")
    .argument("<run-id>", "Run ID from a verified specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action(async (runId: string, options: { debug: boolean }) => {
      const stats = await reportAction(runId, options);
      if (stats) {
        console.log("");
        printDivider();
        printStatusBar(stats);
      }
    });
}
