import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { info, warn } from "../shared/logger.js";

export function watchCommand(): Command {
  return new Command("watch")
    .description("Watch a directory and run the pipeline on .tsx file saves")
    .argument("[dir]", "Directory to watch (default: src/components)", "src/components")
    .action((dir: string) => {
      const projectRoot = process.cwd();
      const watchDir = path.resolve(projectRoot, dir);

      if (!fs.existsSync(watchDir)) {
        warn(`Directory not found: ${dir}`);
        return;
      }

      info(chalk.bold(`Watching ${dir}...`));
      info("Save a .tsx file to trigger the pipeline.\n");

      // Debounce: don't re-trigger for saves within 500ms of each other
      const debounceMap = new Map<string, ReturnType<typeof setTimeout>>();

      fs.watch(watchDir, { recursive: true }, (event, filename) => {
        if (!filename || !filename.endsWith(".tsx")) return;

        const existing = debounceMap.get(filename);
        if (existing) clearTimeout(existing);

        debounceMap.set(filename, setTimeout(async () => {
          debounceMap.delete(filename);
          const filePath = path.join(dir, filename);
          info(`\nDETECTED ${filename}`);

          // Dynamically import run logic to share the same pipeline as `specfirst run`
          const { runCommand } = await import("./run.js");
          const cmd = runCommand();
          // Parse the command as if the user typed: specfirst run <file>
          await cmd.parseAsync([filePath], { from: "user" });
        }, 500));
      });
    });
}
