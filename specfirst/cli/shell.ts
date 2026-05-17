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

const VERSION = "0.1.0";

const COMMANDS: CommandDef[] = [
  { name: "run",        args: "<file>",    description: "Run the full pipeline for a component" },
  { name: "verify",     args: "<run-id>",  description: "Run patch-guard + final verification" },
  { name: "report",     args: "<run-id>",  description: "Generate evidenceReport.md" },
  { name: "baseline",   args: "<run-id>",  description: "Re-run baseline only" },
  { name: "bob-prompt", args: "<run-id>",  description: "Regenerate Bob prompt" },
  { name: "help",       args: "",          description: "Show this message" },
  { name: "exit",       args: "",          description: "Exit SpecFirst" },
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
  console.log("");

  const magenta = chalk.hex("#A61E5C");
  const boxPrompt = magenta("┃ ");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: (line: string) => [[], line], // Tab inserts a space (no completions)
    historySize: 100,
    prompt: boxPrompt,
    terminal: true,
  });

  // Draws the right-side ┃ at the terminal's right edge on the current input line.
  // Uses cursor save/restore so readline's cursor position is unchanged.
  function drawRightBorder(): void {
    const W = process.stdout.columns || 80;
    const lineLen = ((rl as any).line || "").length;
    // terminal row = ┃(1) + space(1) [prompt] + lineLen [rl.line] + rightSpaces + ┃(1) [right border]
    const rightSpaces = Math.max(0, W - lineLen - 3);
    process.stdout.write("\x1b[s");
    process.stdout.write(" ".repeat(rightSpaces) + magenta("┃"));
    process.stdout.write("\x1b[u");
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
      rl.prompt();
    } else {
      (rl as any).line = "/" + cmd.name + " ";
      (rl as any).cursor = cmd.name.length + 2;
      (rl as any)._refreshLine();
      process.nextTick(() => drawRightBorder());
    }
  };

  const onDismiss = (): void => {};

  process.stdin.prependListener("keypress", (char: string, key: { name: string }) => {
    const line = (rl as any).line as string;

    // Activate picker when "/" is typed on an empty line
    if (char === "/" && line === "") {
      activatePicker(rl, COMMANDS, onSelect, onDismiss);
      return;
    }

    if (isPickerActive()) {
      if (key.name === "up" || key.name === "down") {
        navigatePicker(key.name as "up" | "down");
        // readline also processes up/down as history navigation;
        // restore rl.line to the current filter on next tick to undo that
        process.nextTick(() => {
          const filter = ((rl as any).line as string).replace(/^\//, "");
          (rl as any).line = "/" + filter;
          (rl as any).cursor = filter.length + 1;
        });
        return;
      }

      if (key.name === "escape") {
        dismissPicker();
        return;
      }

      if (key.name !== "return") {
        // Printable char or backspace while picker is active:
        // let readline process the key, then sync picker state + redraw right border
        process.nextTick(() => {
          const newLine = (rl as any).line as string;
          if (newLine === "") {
            updatePicker("");
          } else if (!newLine.startsWith("/")) {
            dismissPicker();
          } else {
            updatePicker(newLine.slice(1));
          }
          drawRightBorder();
        });
      }
      return;
    }

    // Picker not active: redraw right border after readline redraws the line
    if (key.name !== "return") {
      process.nextTick(() => {
        drawRightBorder();
      });
    }
  });

  const originalPrompt = rl.prompt.bind(rl);
  rl.prompt = function(preserveCursor?: boolean) {
    const W = process.stdout.columns || 80;
    // Draw the full 3-row box: top border, blank input row, bottom border
    process.stdout.write(magenta("┏" + "━".repeat(W - 2) + "┓") + "\n");
    process.stdout.write("\n");
    process.stdout.write(magenta("┗" + "━".repeat(W - 2) + "┛") + "\n");
    // Move cursor up 2 rows to the blank input row, then go to column 0
    process.stdout.write("\x1b[2A\r");
    // Let readline write its prompt ("┃ ") on the input row
    originalPrompt(preserveCursor);
    // Draw the right border after readline finishes rendering
    process.nextTick(() => {
      drawRightBorder();
    });
  };

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
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("");
    process.exit(0);
  });
}
