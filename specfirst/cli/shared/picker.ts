import readline from "node:readline";
import chalk from "chalk";

export interface CommandDef {
  name: string;        // "run", "verify", etc.
  args: string;        // "<file>" | "<run-id>" | "" (empty = no args)
  description: string;
}

// Module-level picker state
let _active = false;
let _commands: CommandDef[] = [];
let _filtered: CommandDef[] = [];
let _selectedIndex = 0;
let _rl: readline.Interface | null = null;
let _onSelect: ((cmd: CommandDef) => void) | null = null;
let _onDismiss: (() => void) | null = null;

export function isPickerActive(): boolean {
  return _active;
}

export function activatePicker(
  rl: readline.Interface,
  commands: CommandDef[],
  onSelect: (cmd: CommandDef) => void,
  onDismiss: () => void
): void {
  _active = true;
  _rl = rl;
  _commands = commands;
  _filtered = [...commands];
  _selectedIndex = 0;
  _onSelect = onSelect;
  _onDismiss = onDismiss;
  render();
}

export function updatePicker(filter: string): void {
  if (!_active) return;
  _filtered = filter
    ? _commands.filter(c => c.name.startsWith(filter))
    : [..._commands];
  _selectedIndex = 0;
  render();
}

export function navigatePicker(dir: "up" | "down"): void {
  if (!_active || _filtered.length === 0) return;
  if (dir === "down") {
    _selectedIndex = (_selectedIndex + 1) % _filtered.length;
  } else {
    _selectedIndex = (_selectedIndex - 1 + _filtered.length) % _filtered.length;
  }
  render();
}

export function confirmPicker(): void {
  if (!_active) return;
  if (_filtered.length === 0) return; // no-op when 0 results
  const cmd = _filtered[_selectedIndex];
  const onSelect = _onSelect!;
  clear();
  _reset();
  onSelect(cmd);
}

export function dismissPicker(): void {
  if (!_active) return;
  const onDismiss = _onDismiss!;
  clear();
  _reset();
  onDismiss();
}

function _reset(): void {
  _active = false;
  _rl = null;
  _commands = [];
  _filtered = [];
  _selectedIndex = 0;
  _onSelect = null;
  _onDismiss = null;
}

function clear(): void {
  process.stdout.write("\x1b[s"); // save cursor
  process.stdout.write("\x1b[J"); // erase from cursor to end of screen
  process.stdout.write("\x1b[u"); // restore cursor
}

function render(): void {
  const DIVIDER_WIDTH = 50;
  const muted   = (s: string) => chalk.hex("#8A8A8A")(s);
  const white   = (s: string) => chalk.hex("#F5F5F5")(s);
  const magenta = (s: string) => chalk.hex("#A61E5C").bold(s);

  clear();
  process.stdout.write("\x1b[s"); // save cursor at prompt line

  if (_filtered.length === 0) {
    process.stdout.write("\n  " + muted("no matching commands") + "\n");
  } else {
    process.stdout.write("\n");
    for (let i = 0; i < _filtered.length; i++) {
      const cmd = _filtered[i];
      const isSelected = i === _selectedIndex;
      const marker = isSelected ? magenta("> ") : "  ";
      const name   = isSelected
        ? magenta(cmd.name.padEnd(14))
        : muted(cmd.name.padEnd(14));
      const desc = white(cmd.description);
      process.stdout.write(marker + name + desc + "\n");
    }
  }

  process.stdout.write("  " + muted("─".repeat(DIVIDER_WIDTH)) + "\n");
  process.stdout.write("  " + muted(`${_filtered.length}/${_commands.length} commands`) + "\n");
  process.stdout.write("\x1b[u"); // restore cursor to prompt
}
