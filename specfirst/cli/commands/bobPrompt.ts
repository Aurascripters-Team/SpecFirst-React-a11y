import { Command } from "commander";

export function bobPromptCommand(): Command {
  return new Command("bob-prompt")
    .description("Generate or reprint the Bob remediation prompt")
    .action(() => {
      console.log("bob-prompt — not yet implemented");
    });
}
