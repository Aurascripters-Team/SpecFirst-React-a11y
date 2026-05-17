import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, info, warn } from "../shared/logger.js";
import { handleCommandError } from "../shared/errorHandling.js";
import { printResult } from "../shared/ui.js";
import type { RunStats } from "../shared/ui.js";
import { generateEvidenceReport } from "../../core/final-verification/generateEvidenceReport.js";
import type { FinalVerificationResult } from "../../core/final-verification/types.js";

export async function reportAction(
  runId: string,
  options: { debug: boolean }
): Promise<RunStats | null> {
  const ctx = getRunContext(runId);
  try {
    assertRunExists(ctx);

    const s = step("Generate evidence report");

    if (!fs.existsSync(ctx.finalVerificationResultPath)) {
      s.fail(chalk.red("✗") + ` finalVerificationResult.json not found — run 'verify ${runId}' first`);
      return null;
    }

    const result = JSON.parse(
      fs.readFileSync(ctx.finalVerificationResultPath, "utf8")
    ) as FinalVerificationResult;

    const reportContent = generateEvidenceReport(result);
    fs.writeFileSync(ctx.evidenceReportPath, reportContent);

    s.succeed(chalk.green("✓") + ` Evidence report generated`);
    info(`  ${path.relative(process.cwd(), ctx.evidenceReportPath)}`);
    info("");
    info("  Passed SpecFirst automated accessibility contract.");
    info("  Manual review required.");

    if ((result as { bobSessionEvidence?: { present?: boolean } }).bobSessionEvidence?.present === false) {
      warn("  Bob session evidence missing — upload bob_sessions/ exports before submission.");
    }

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
      printResult(stats);
    });
}
