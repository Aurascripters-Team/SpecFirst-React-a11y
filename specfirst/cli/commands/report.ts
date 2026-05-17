import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, info } from "../shared/logger.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";

// import { generateReport } from "../../core/report/generateReport.js";

export function reportCommand(): Command {
  return new Command("report")
    .description("Generate evidenceReport.md for a verified run")
    .argument("<run-id>", "Run ID from a verified specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action((runId: string, options: { debug: boolean }) => {
      const ctx = getRunContext(runId);
      try {
        assertRunExists(ctx);

        const s = step("Generate evidence report");

        // TODO: uncomment once phase 6-8 PR merges
        // const result = generateReport({ input: runId, projectRoot: process.cwd() });
        // assertStatus(result, ["generated"]);
        // s.succeed(chalk.green("✓") + " Evidence report generated");
        // info(`  ${path.relative(process.cwd(), ctx.evidenceReportPath)}`);

        s.warn("Report generation not yet implemented — awaiting PR merge");
      } catch (err) {
        handleCommandError(err, ctx, options.debug ?? false);
      }
    });
}
