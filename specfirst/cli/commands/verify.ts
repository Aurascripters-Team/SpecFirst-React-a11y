import { Command } from "commander";

export function verifyCommand(): Command {
  return new Command("verify")
    .description("Run patch-guard then final verification")
    .action(() => {
      console.log("verify — not yet implemented");
    });
}
