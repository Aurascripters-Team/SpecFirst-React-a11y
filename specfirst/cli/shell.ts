import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import { printBanner, printDivider, printStatusBar } from "./shared/ui.js";
import { runAction } from "./commands/run.js";
import { verifyAction } from "./commands/verify.js";
import { reportAction } from "./commands/report.js";

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
        .map(e => `run ${path.join(dir === "." ? "" : dir, e.name).replace(/^[\\/]/, "")}`)
        .filter(h => h.startsWith(line));
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
  console.log("");
  console.log("Commands:");
  console.log("  run <file>          Run the full pipeline for a component");
  console.log("  verify <run-id>     Run patch-guard + final verification");
  console.log("  report <run-id>     Generate evidenceReport.md");
  console.log("  baseline <run-id>   Re-run baseline only");
  console.log("  bob-prompt <run-id> Regenerate Bob prompt");
  console.log("  help                Show this message");
  console.log("  exit                Exit SpecFirst");
  console.log("");
}

async function dispatch(line: string): Promise<import("./shared/ui.js").RunStats | null> {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  switch (cmd) {
    case "run": {
      if (!args[0]) { console.log("Usage: run <file>"); return null; }
      return runAction(args[0], { debug: false, interactive: false });
    }
    case "verify": {
      if (!args[0]) { console.log("Usage: verify <run-id>"); return null; }
      return verifyAction(args[0], { debug: false });
    }
    case "report": {
      if (!args[0]) { console.log("Usage: report <run-id>"); return null; }
      return reportAction(args[0], { debug: false });
    }
    case "help": {
      printHelp();
      return null;
    }
    case "exit": {
      process.exit(0);
    }
    default: {
      console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
      return null;
    }
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

    try {
      const stats = await dispatch(trimmed);
      console.log("");
      printDivider();
      if (stats) {
        printStatusBar(stats);
      }
    } catch (err) {
      console.log(err instanceof Error ? err.message : String(err));
    }

    console.log("");
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("");
    process.exit(0);
  });
}
