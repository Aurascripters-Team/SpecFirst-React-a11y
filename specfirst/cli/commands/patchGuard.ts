import { Command } from "commander";

export function patchGuardCommand(): Command {
  return new Command("patch-guard")
    .description("Verify Bob did not edit forbidden files")
    .action(() => {
      console.log("patch-guard — not yet implemented");
    });
}
