import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { analyzeComponent } from "../../core/analysis/analyzeComponent.js";
import { classifyComponent } from "../../core/classification/classifyComponent.js";
import { loadManifestForClassification } from "../../core/manifest/loadManifest.js";
import type { ManifestLoadSuccess } from "../../core/manifest/types.js";
import { freezeSpec } from "../../core/spec/freezeSpec.js";
import { generateTests } from "../../core/test-generation/generateTests.js";
import { step, printChecks, printNextAction, fatal, warn, info } from "../shared/logger.js";
import { getRunContext } from "../shared/runContext.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";
import { printResult } from "../shared/ui.js";
import type { RunStats } from "../shared/ui.js";

function createTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function runAction(
  file: string,
  options: { debug: boolean; interactive: boolean }
): Promise<RunStats | null> {
  const projectRoot = process.cwd();
  const absoluteFile = path.resolve(projectRoot, file);

  if (!fs.existsSync(absoluteFile)) {
    fatal(`File not found: ${file}`);
  }

  info(chalk.bold(`SpecFirst Run: ${path.basename(file)}`));
  info("");

  const runId = `${createTimestamp()}-analyze`;
  const ctx = getRunContext(runId, projectRoot);
  fs.mkdirSync(ctx.runDir, { recursive: true });

  let totalChecks = 0;

  try {
    const s1 = step("Analyze component");
    const analysis = analyzeComponent(absoluteFile, projectRoot);
    fs.writeFileSync(ctx.componentAnalysisPath, JSON.stringify(analysis, null, 2) + "\n");
    s1.succeed(chalk.green(`✓`) + ` Analyze component`);

    const s2 = step("Classify pattern");
    const classification = classifyComponent(analysis);
    fs.writeFileSync(ctx.classificationPath, JSON.stringify(classification, null, 2) + "\n");
    if (!classification.nextPhase.canContinue) {
      s2.fail(chalk.red(`✗`) + ` Classify pattern — ${classification.classification.pattern} (cannot continue)`);
      fatal(`Classification blocked: ${classification.blockers.map(b => b.reason).join(", ")}`);
    }
    s2.succeed(chalk.green(`✓`) + ` Classify pattern: ${classification.classification.pattern}`);

    const s3 = step("Load manifest");
    const manifestResult = loadManifestForClassification({
      classificationPath: ctx.classificationPath,
      projectRoot,
    });
    assertStatus(manifestResult, ["loaded"]);
    const loadedManifest = manifestResult as ManifestLoadSuccess;
    totalChecks = loadedManifest.manifestSummary.requirementCount;
    s3.succeed(chalk.green(`✓`) + ` Load manifest: ${totalChecks} checks`);

    const s4 = step("Freeze spec");
    const specResult = freezeSpec({ input: runId, projectRoot });
    assertStatus(specResult, ["locked"]);
    s4.succeed(chalk.green(`✓`) + ` Freeze spec`);

    const s5 = step("Generate tests");
    const testResult = generateTests({ input: runId, projectRoot });
    assertStatus(testResult, ["generated"]);
    s5.succeed(chalk.green(`✓`) + ` Generate tests`);

    info("");
    info(`${chalk.bold("Run ID:")} ${runId}`);
    warn("Phases 6–7 not yet wired (awaiting parallel PR). Run `specfirst baseline` and `specfirst bob-prompt` manually.");

    return {
      phase: "run",
      runId,
      totalChecks,
      failedChecks: 0,
      frozen: true,
      bobPromptReady: false,
    };

  } catch (err) {
    handleCommandError(err, ctx, options.debug ?? false);
    return null;
  }
}

export function runCommand(): Command {
  return new Command("run")
    .description("Run the full pipeline for a component file (phases 1–6 + Bob prompt)")
    .argument("<file>", "Path to the React component file")
    .option("--debug", "Write stack traces to debug.log on failure")
    .option("--interactive", "Prompt for confirmation before generating Bob prompt")
    .action(async (file: string, options: { debug: boolean; interactive: boolean }) => {
      const stats = await runAction(file, options);
      printResult(stats);
    });
}
