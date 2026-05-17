import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { fatal, info } from "../shared/logger.js";

const DEFAULT_CONFIG = {
  watch: "src/components",
  testOutput: "tests/a11y",
  reportOutput: "specfirst/runs",
  wcagLevel: "AA",
  wcagVersion: "2.2",
  maxRetries: 3,
  testHarnessUrl: "http://localhost:5173",
};

export function initCommand(): Command {
  return new Command("init")
    .description("Create specfirst.config.json in the project root")
    .action(() => {
      const configPath = path.resolve(process.cwd(), "specfirst.config.json");
      if (fs.existsSync(configPath)) {
        fatal("specfirst.config.json already exists. Delete it to reinitialize.");
      }
      fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
      info("Created specfirst.config.json");
    });
}
