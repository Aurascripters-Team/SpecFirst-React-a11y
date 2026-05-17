import { Command } from "commander";

export function watchCommand(): Command {
  return new Command("watch")
    .description("Watch a directory and run the pipeline on .tsx changes")
    .action(() => {
      console.log("watch — not yet implemented");
    });
}
