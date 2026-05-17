import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import { printBanner, printDivider, printResult } from "./shared/ui.js";
import { info } from "./shared/logger.js";
import { runAction } from "./commands/run.js";
import { verifyAction } from "./commands/verify.js";
import { reportAction } from "./commands/report.js";
import { baselineAction } from "./commands/baseline.js";
import { bobPromptAction } from "./commands/bobPrompt.js";

const VERSION = "0.1.0";

const COMMAND_NAMES = [
  "run",
  "verify",
  "report",
  "baseline",
  "bob-prompt",
  "help",
  "exit",
];

export function completer(line: string): [string[], string] {
  const parts = line.split(" ");
  const cmd = parts[0];

  // No space yet — complete command name
  if (parts.length <= 1) {
    const hits = COMMAND_NAMES.filter(c => c.startsWith(cmd));
    return [hits.length ? hits : [], line];
  }

  // "run <partial>" — complete .tsx paths one level deep
  if (cmd === "run" && parts.length === 2) {
    const partial = parts[1];
    const dir = partial.includes(path.sep) || partial.includes("/")
      ? path.dirname(partial)
      : ".";
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const hits = entries
        .filter(e => e.isFile() && e.name.endsWith(".tsx"))
        .map(e => {
          const joined = path.join(dir === "." ? "" : dir, e.name).replace(/\\/g, "/").replace(/^\//, "");
          return `run ${joined}`;
        })
        .filter(h => h.startsWith(line.replace(/\\/g, "/")));
      return [hits, line];
    } catch {
      return [[], line];
    }
  }

  // "verify <partial>" — complete run IDs from specfirst/runs/
  if (cmd === "verify" && parts.length === 2) {
    const partial = parts[1];
    try {
      const runsDir = path.join(process.cwd(), "specfirst", "runs");
      const entries = fs.readdirSync(runsDir, { withFileTypes: true });
      const hits = entries
        .filter(e => e.isDirectory() && e.name.startsWith(partial))
        .map(e => `verify ${e.name}`);
      return [hits, line];
    } catch {
      return [[], line];
    }
  }

  return [[], line];
}

function printHelp(): void {
  info("");
  info("Commands:");
  info("  run <file>          Run the full pipeline for a component");
  info("  verify <run-id>     Run patch-guard + final verification");
  info("  report <run-id>     Generate evidenceReport.md");
  info("  baseline <run-id>   Re-run baseline only");
  info("  bob-prompt <run-id> Regenerate Bob prompt");
  info("  help                Show this message");
  info("  exit                Exit SpecFirst");
  info("");
}

async function dispatch(line: string): Promise<import("./shared/ui.js").RunStats | null> {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  switch (cmd) {
    case "run": {
      if (!args[0]) { info("Usage: run <file>"); return null; }
      return runAction(args[0], { debug: false, interactive: false });
    }
    case "verify": {
      if (!args[0]) { info("Usage: verify <run-id>"); return null; }
      return verifyAction(args[0], { debug: false });
    }
    case "report": {
      if (!args[0]) { info("Usage: report <run-id>"); return null; }
      return reportAction(args[0], { debug: false });
    }
    case "baseline": {
      if (!args[0]) { info("Usage: baseline <run-id>"); return null; }
      await baselineAction(args[0], { debug: false });
      return null;
    }
    case "bob-prompt": {
      if (!args[0]) { info("Usage: bob-prompt <run-id>"); return null; }
      await bobPromptAction(args[0], { debug: false });
      return null;
    }
    case "help": {
      printHelp();
      return null;
    }
    default:
      info(`Unknown command: ${cmd}. Type 'help' for available commands.`);
      return null;
  }
}

export function startShell(): void {
  printBanner(VERSION, process.cwd());
  printDivider();
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
    historySize: 100,
    prompt: "> ",
    terminal: true,
  });

  rl.prompt();

  rl.on("line", async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed === "exit") {
      rl.close();
      return;
    }

    try {
      const stats = await dispatch(trimmed);
      printResult(stats);
    } catch (err) {
      info(err instanceof Error ? err.message : String(err));
    }

    console.log("");
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("");
    process.exit(0);
  });
}
