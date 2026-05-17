import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { printBanner, printResult } from "./shared/ui.js";
import { info } from "./shared/logger.js";
import {
  CommandDef,
  activatePicker,
  updatePicker,
  navigatePicker,
  confirmPicker,
  dismissPicker,
  isPickerActive,
} from "./shared/picker.js";
import { runAction } from "./commands/run.js";
import { verifyAction } from "./commands/verify.js";
import { reportAction } from "./commands/report.js";
import { baselineAction } from "./commands/baseline.js";
import { bobPromptAction } from "./commands/bobPrompt.js";
import { patchGuardAction } from "./commands/patchGuard.js";

const VERSION = "0.1.0";

const COMMANDS: CommandDef[] = [
  { name: "run",         args: "<file>",              description: "Phases 1-5: analyze → generate tests" },
  { name: "baseline",    args: "<run-id>",            description: "Phase 6: prove tests fail before Bob" },
  { name: "bob-prompt",  args: "<run-id>",            description: "Phase 7a: generate Bob prompt" },
  { name: "patch-guard", args: "<run-id> [session]",  description: "Phase 7b: verify Bob stayed in scope" },
  { name: "verify",      args: "<run-id>",            description: "Phase 8: rerun tests after Bob patch" },
  { name: "report",      args: "<run-id>",            description: "Phase 8: generate evidence report" },
  { name: "help",        args: "",                    description: "Show this message" },
  { name: "exit",        args: "",                    description: "Exit SpecFirst" },
];

export function completer(line: string): [string[], string] {
  const parts = line.split(" ");
  const cmd = parts[0];
  const commandNames = COMMANDS.map(c => c.name);

  // No space yet — complete command name (bare or slash-prefixed)
  if (parts.length <= 1) {
    if (cmd.startsWith("/")) {
      const filter = cmd.slice(1);
      const hits = commandNames
        .filter(n => n.startsWith(filter))
        .map(n => "/" + n);
      return [hits.length ? hits : [], line];
    }
    const hits = commandNames.filter(n => n.startsWith(cmd));
    return [hits.length ? hits : [], line];
  }

  // Strip leading "/" for argument completion so "/run" and "run" both work
  const bareCmd = cmd.replace(/^\//, "");

  // "run <partial>" or "/run <partial>" — complete .tsx paths one level deep
  if (bareCmd === "run" && parts.length === 2) {
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
          return `${cmd} ${joined}`;
        })
        .filter(h => h.startsWith(line.replace(/\\/g, "/")));
      return [hits, line];
    } catch {
      return [[], line];
    }
  }

  // "verify <partial>" or "/verify <partial>" — complete run IDs from specfirst/runs/
  if (bareCmd === "verify" && parts.length === 2) {
    const partial = parts[1];
    try {
      const runsDir = path.join(process.cwd(), "specfirst", "runs");
      const entries = fs.readdirSync(runsDir, { withFileTypes: true });
      const hits = entries
        .filter(e => e.isDirectory() && e.name.startsWith(partial))
        .map(e => `${cmd} ${e.name}`);
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
  for (const c of COMMANDS) {
    const usage = c.args ? `${c.name} ${c.args}` : c.name;
    info(`  ${usage.padEnd(22)} ${c.description}`);
  }
  info("");
}

async function dispatch(line: string): Promise<import("./shared/ui.js").RunStats | null> {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0].replace(/^\//, "");
  const args = parts.slice(1);

  switch (cmd) {
    case "run": {
      if (!args[0]) { info("Usage: run <file>"); return null; }
      return runAction(args[0], { debug: false, interactive: false, fromShell: true });
    }
    case "verify": {
      if (!args[0]) { info("Usage: verify <run-id>"); return null; }
      return verifyAction(args[0], { debug: false, fromShell: true });
    }
    case "report": {
      if (!args[0]) { info("Usage: report <run-id>"); return null; }
      return reportAction(args[0], { debug: false });
    }
    case "baseline": {
      if (!args[0]) { info("Usage: baseline <run-id>"); return null; }
      await baselineAction(args[0], { debug: false, fromShell: true });
      return null;
    }
    case "bob-prompt": {
      if (!args[0]) { info("Usage: bob-prompt <run-id>"); return null; }
      await bobPromptAction(args[0], { debug: false });
      return null;
    }
    case "patch-guard": {
      if (!args[0]) { info("Usage: patch-guard <run-id> [session-path]"); return null; }
      await patchGuardAction(args[0], { debug: false, fromShell: true }, args[1]);
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

  const magenta = chalk.hex("#A61E5C");
  const gray = chalk.hex("#8A8A8A");
  const prompt = magenta("◈ ");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: (line: string) => [[], line],
    historySize: 100,
    prompt,
    terminal: true,
  });

  function printDivider(): void {
    const W = process.stdout.columns || 80;
    console.log(gray("─".repeat(W)));
  }

  readline.emitKeypressEvents(process.stdin);

  const onSelect = async (cmd: CommandDef): Promise<void> => {
    if (cmd.args === "") {
      if (cmd.name === "exit") {
        rl.close();
        return;
      }
      try {
        const stats = await dispatch(cmd.name);
        printResult(stats);
      } catch (err) {
        info(err instanceof Error ? err.message : String(err));
      }
      console.log("");
      printDivider();
      rl.prompt();
    } else {
      (rl as any).line = "/" + cmd.name + " ";
      (rl as any).cursor = cmd.name.length + 2;
      (rl as any)._refreshLine();
    }
  };

  const onDismiss = (): void => {};

  process.stdin.prependListener("keypress", (char: string, key: { name: string }) => {
    const line = (rl as any).line as string;

    if (char === "/" && line === "") {
      activatePicker(rl, COMMANDS, onSelect, onDismiss);
      return;
    }

    if (isPickerActive()) {
      if (key.name === "up" || key.name === "down") {
        navigatePicker(key.name as "up" | "down");
        process.nextTick(() => {
          const filter = ((rl as any).line as string).replace(/^\//, "");
          (rl as any).line = "/" + filter;
          (rl as any).cursor = filter.length + 1;
        });
        return;
      }
      if (key.name === "escape") { dismissPicker(); return; }
      if (key.name !== "return") {
        process.nextTick(() => {
          const newLine = (rl as any).line as string;
          if (newLine === "") updatePicker("");
          else if (!newLine.startsWith("/")) dismissPicker();
          else updatePicker(newLine.slice(1));
        });
      }
      return;
    }
  });

  printDivider();
  rl.prompt();

  rl.on("line", async (line: string) => {
    const trimmed = line.trim();

    // Picker active: Enter confirms the current selection — skip normal dispatch
    if (isPickerActive()) {
      confirmPicker();
      return;
    }

    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed === "exit" || trimmed === "/exit") {
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
    printDivider();
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("");
    process.exit(0);
  });
}
