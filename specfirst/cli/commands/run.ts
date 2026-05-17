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

function createTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function runCommand(): Command {
  return new Command("run")
    .description("Run the full pipeline for a component file (phases 1–6 + Bob prompt)")
    .argument("<file>", "Path to the React component file")
    .option("--debug", "Write stack traces to debug.log on failure")
    .option("--interactive", "Prompt for confirmation before generating Bob prompt")
    .action(async (file: string, options: { debug: boolean; interactive: boolean }) => {
      const projectRoot = process.cwd();
      const absoluteFile = path.resolve(projectRoot, file);

      if (!fs.existsSync(absoluteFile)) {
        fatal(`File not found: ${file}`);
      }

      info(chalk.bold(`SpecFirst Run: ${path.basename(file)}`));
      info("");

      // Create run folder
      const runId = `${createTimestamp()}-analyze`;
      const ctx = getRunContext(runId, projectRoot);
      fs.mkdirSync(ctx.runDir, { recursive: true });

      try {
        // Phase 1 — Analyze
        const s1 = step("Analyze component");
        const analysis = analyzeComponent(absoluteFile, projectRoot);
        fs.writeFileSync(ctx.componentAnalysisPath, JSON.stringify(analysis, null, 2) + "\n");
        s1.succeed(chalk.green(`✓`) + ` Analyze component`);

        // Phase 2 — Classify
        const s2 = step("Classify pattern");
        const classification = classifyComponent(analysis);
        fs.writeFileSync(ctx.classificationPath, JSON.stringify(classification, null, 2) + "\n");
        if (!classification.nextPhase.canContinue) {
          s2.fail(chalk.red(`✗`) + ` Classify pattern — ${classification.classification.pattern} (cannot continue)`);
          fatal(`Classification blocked: ${classification.blockers.map(b => b.reason).join(", ")}`);
        }
        s2.succeed(chalk.green(`✓`) + ` Classify pattern: ${classification.classification.pattern}`);

        // Phase 3 — Load manifest
        const s3 = step("Load manifest");
        const manifestResult = loadManifestForClassification({
          classificationPath: ctx.classificationPath,
          projectRoot,
        });
        assertStatus(manifestResult, ["loaded"]);
        const loadedManifest = manifestResult as ManifestLoadSuccess;
        s3.succeed(chalk.green(`✓`) + ` Load manifest: ${loadedManifest.manifestSummary.requirementCount} checks`);

        // Phase 4 — Freeze spec
        const s4 = step("Freeze spec");
        const specResult = freezeSpec({ input: runId, projectRoot });
        assertStatus(specResult, ["locked"]);
        s4.succeed(chalk.green(`✓`) + ` Freeze spec`);

        // Phase 5 — Generate tests
        const s5 = step("Generate tests");
        const testResult = generateTests({ input: runId, projectRoot });
        assertStatus(testResult, ["generated"]);
        s5.succeed(chalk.green(`✓`) + ` Generate tests`);

        // Phases 6–7 are implemented in a parallel PR.
        // Once that PR merges, uncomment and wire these steps:
        //
        // const s6 = step("Baseline");
        // const baselineResult = runBaseline({ input: runId, projectRoot });
        // assertStatus(baselineResult, ["red-confirmed"]);
        // s6.fail(chalk.red(`✗`) + ` Baseline red-confirmed: ${baselineResult.failureCount} failed checks`);
        // printChecks(baselineResult.failedCheckIds);
        //
        // if (options.interactive) {
        //   const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        //   const answer = await new Promise<string>(resolve =>
        //     rl.question("\nGenerate Bob remediation prompt? (Y/n) ", resolve)
        //   );
        //   rl.close();
        //   if (answer.toLowerCase() === "n") {
        //     info("Skipped. Run `specfirst bob-prompt " + runId + "` to generate later.");
        //     return;
        //   }
        // }
        //
        // const s7 = step("Generate Bob prompt");
        // const promptResult = generateBobPrompt({ input: runId, projectRoot });
        // assertStatus(promptResult, ["generated"]);
        // s7.succeed(chalk.green(`✓`) + ` Bob prompt generated`);
        //
        // printNextAction(
        //   `  Open ${path.relative(projectRoot, ctx.bobPromptPath)} in IBM Bob.\n` +
        //   `  After Bob patches the component, run:\n\n` +
        //   `  specfirst verify ${runId}`
        // );

        // Temporary: print the run ID so the developer can use other commands
        info("");
        info(`${chalk.bold("Run ID:")} ${runId}`);
        warn("Phases 6–7 not yet wired (awaiting parallel PR). Run `specfirst baseline` and `specfirst bob-prompt` manually.");

      } catch (err) {
        handleCommandError(err, ctx, options.debug ?? false);
      }
    });
}
