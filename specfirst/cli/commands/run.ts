import { Command } from "commander";

export function runCommand(): Command {
  return new Command("run")
    .description("Run the full pipeline for a component file")
    .action(() => {
      console.log("run — not yet implemented");
    });
}
