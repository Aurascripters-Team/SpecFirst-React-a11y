import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { getRunContext, assertRunExists } from "../shared/runContext.js";
import { step, warn, info } from "../shared/logger.js";
import { assertStatus, handleCommandError } from "../shared/errorHandling.js";

// import { generateBobPrompt } from "../../core/bob-prompt/generateBobPrompt.js";

export function bobPromptCommand(): Command {
  return new Command("bob-prompt")
    .description("Generate or reprint the Bob remediation prompt")
    .argument("<run-id>", "Run ID from a previous specfirst run")
    .option("--debug", "Write stack traces to debug.log on failure")
    .action((runId: string, options: { debug: boolean }) => {
      const ctx = getRunContext(runId);
      try {
        assertRunExists(ctx);

        if (fs.existsSync(ctx.bobPromptPath)) {
          warn("Bob prompt already exists, overwriting...");
        }

        const s = step("Generate Bob prompt");

        // TODO: uncomment once phase 6-8 PR merges
        // const result = generateBobPrompt({ input: runId, projectRoot: process.cwd() });
        // assertStatus(result, ["generated"]);
        // s.succeed("✓ Bob prompt generated");
        // info(`  ${path.relative(process.cwd(), ctx.bobPromptPath)}`);

        s.warn("Phase 7 not yet implemented — awaiting PR merge");
      } catch (err) {
        handleCommandError(err, ctx, options.debug ?? false);
      }
    });
}
