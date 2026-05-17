import { Command } from "commander";

export function baselineCommand(): Command {
  return new Command("baseline")
    .description("Re-run Phase 6 baseline")
    .action(() => {
      console.log("baseline — not yet implemented");
    });
}
