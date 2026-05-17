import { Command } from "commander";

export function initCommand(): Command {
  return new Command("init")
    .description("Create specfirst.config.json")
    .action(() => {
      console.log("init — not yet implemented");
    });
}
