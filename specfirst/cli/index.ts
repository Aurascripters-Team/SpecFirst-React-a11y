import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { runCommand } from "./commands/run.js";
import { baselineCommand } from "./commands/baseline.js";
import { bobPromptCommand } from "./commands/bobPrompt.js";
import { patchGuardCommand } from "./commands/patchGuard.js";
import { verifyCommand } from "./commands/verify.js";
import { reportCommand } from "./commands/report.js";
import { watchCommand } from "./commands/watch.js";

const program = new Command();

program
  .name("specfirst")
  .description(
    "Deterministic accessibility compliance pipeline for React components"
  )
  .version("0.1.0");

program.addCommand(initCommand());
program.addCommand(runCommand());
program.addCommand(baselineCommand());
program.addCommand(bobPromptCommand());
program.addCommand(patchGuardCommand());
program.addCommand(verifyCommand());
program.addCommand(reportCommand());
program.addCommand(watchCommand());

program.parse();
