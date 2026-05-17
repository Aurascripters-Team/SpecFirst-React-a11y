import { Command } from "commander";

export function reportCommand(): Command {
  return new Command("report")
    .description("Generate evidenceReport.md")
    .action(() => {
      console.log("report — not yet implemented");
    });
}
