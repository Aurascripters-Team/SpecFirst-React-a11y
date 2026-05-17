# SpecFirst Slash Command Picker — Design Spec

**Date:** 2026-05-17
**Status:** Approved
**Scope:** Claude Code-style `/command` picker for the SpecFirst interactive REPL — inline filtered list, keyboard navigation, fill-and-wait for argument commands

---

## 1. Goal

When the user types `/` in the SpecFirst REPL, display an inline filtered command picker (like Claude Code's slash command menu). Typing more characters after `/` filters the list in real time. Arrow keys navigate. Enter on a command with arguments populates the prompt and waits for the argument; Enter on a no-argument command executes immediately.

Bare commands (`run`, `verify`, etc.) continue to work unchanged. The slash prefix is additive, not a replacement.

---

## 2. Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Slash + bare both supported | Yes | Backwards compatible; slash is the new primary path |
| Picker rendering | ANSI cursor movement + chalk | No new deps; fits existing ui.ts pattern |
| Keypress interception | `prependListener` on `process.stdin` + `process.nextTick` restore | Works alongside readline without pausing it |
| `COMMANDS` registry | Single `CommandDef[]` in `shell.ts` | Eliminates completion/help/dispatch drift |
| Selected item color | `brandMagenta` | Consistent with existing brand palette |

---

## 3. Visual Design

### Picker — full list (`/`)

```
> /

  run           Run the full pipeline for a component
  verify        Run patch-guard + final verification
  report        Generate evidenceReport.md
  baseline      Re-run baseline only
  bob-prompt    Regenerate Bob prompt
  help          Show this message
  exit          Exit SpecFirst
  ──────────────────────────────────────────────────
  7/7 commands
```

### Picker — filtered (`/ru`)

```
> /ru

> run           Run the full pipeline for a component
  ──────────────────────────────────────────────────
  1/7 commands
```

### Picker — no results (`/xyz`)

```
> /xyz

  no matching commands
  ──────────────────────────────────────────────────
  0/7 commands
```

### After selecting `run` (fill-and-wait)

```
> /run 
```

User types the file argument and presses Enter to execute.

### Color palette

| Element | Color |
|---|---|
| `>` marker + selected command name | `brandMagenta` `#A61E5C` |
| Non-selected command name | `mutedGray` `#8A8A8A` |
| Command description | `textWhite` `#F5F5F5` |
| Divider + footer count | `mutedGray` `#8A8A8A` |

---

## 4. Interaction Model

| Input | Picker state | Behavior |
|---|---|---|
| `/` | → activate | Show all 7 commands, selection at index 0 |
| Any char after `/` | active | Re-filter list, reset selection to 0 |
| `↑` | active | Move selection up, wrap to bottom |
| `↓` | active | Move selection down, wrap to top |
| `Enter` (command has args) | active | Dismiss picker, populate `> /run ` — user types argument |
| `Enter` (no-arg: `help`, `exit`) | active | Dismiss picker, execute command immediately |
| `Enter` (0 results) | active | No-op |
| `Escape` | active | Dismiss picker, leave `/filter` text in line |
| `Backspace` past `/` | active | Dismiss picker when `rl.line` becomes `""` after readline processes the backspace |

---

## 5. File Structure

One new file; one file modified:

```
specfirst/cli/
  shell.ts           ← modified: COMMANDS registry, picker wiring, dispatch strip
  shared/
    picker.ts        ← new: picker state, rendering, keypress API
    ui.ts            ← unchanged
    logger.ts        ← unchanged
    runContext.ts    ← unchanged
    errorHandling.ts ← unchanged
```

---

## 6. `CommandDef` Interface & `COMMANDS` Registry

Defined in `picker.ts`, imported by `shell.ts`. Replaces the flat `COMMAND_NAMES` string array. Becomes the single source of truth for completion, help output, picker display, and dispatch.

```ts
export interface CommandDef {
  name: string;       // "run", "verify", etc.
  args: string;       // "<file>" | "<run-id>" | "" (empty = no args)
  description: string;
}
```

Registry (defined in `shell.ts`, passed to picker):

```ts
const COMMANDS: CommandDef[] = [
  { name: "run",        args: "<file>",    description: "Run the full pipeline for a component" },
  { name: "verify",     args: "<run-id>",  description: "Run patch-guard + final verification" },
  { name: "report",     args: "<run-id>",  description: "Generate evidenceReport.md" },
  { name: "baseline",   args: "<run-id>",  description: "Re-run baseline only" },
  { name: "bob-prompt", args: "<run-id>",  description: "Regenerate Bob prompt" },
  { name: "help",       args: "",          description: "Show this message" },
  { name: "exit",       args: "",          description: "Exit SpecFirst" },
];
```

---

## 7. `picker.ts` — Public API

Owns all picker state and terminal rendering. No knowledge of command execution — communicates back via callbacks.

```ts
export interface CommandDef { ... }

export function activatePicker(
  rl: readline.Interface,
  commands: CommandDef[],
  onSelect: (cmd: CommandDef) => void,
  onDismiss: () => void
): void

export function updatePicker(filter: string): void
export function navigatePicker(dir: "up" | "down"): void
export function confirmPicker(): void
export function dismissPicker(): void
export function isPickerActive(): boolean
```

### Internal rendering

`render()`:
1. Save cursor: `\x1b[s`
2. Move cursor down one line, column 0
3. Write each filtered row (selected with `>` + brandMagenta, others with `  ` + mutedGray)
4. Write divider + footer count
5. Restore cursor: `\x1b[u`

`clear()`:
1. Save cursor: `\x1b[s`
2. Erase from cursor to end of screen: `\x1b[J`
3. Restore cursor: `\x1b[u`

Every call to `render()` calls `clear()` first.

---

## 8. `shell.ts` Changes

### `COMMANDS` registry

Replaces `COMMAND_NAMES: string[]` with `COMMANDS: CommandDef[]` (defined above). All references to command names are derived from this array.

### `completer()`

Updated to handle `/`-prefixed input:

- If `line` starts with `/`, complete against `/commandname` prefix
- If `line` is bare, complete against bare command names (unchanged)
- Path and run-ID argument completion unchanged (space after command)

### `dispatch()`

Strips a leading `/` before matching so both `run` and `/run` resolve to the same case:

```ts
const cmd = parts[0].replace(/^\//, "");
```

### `startShell()`

**Keypress interception** — added before `rl.on("line", ...)`:

```ts
readline.emitKeypressEvents(process.stdin);

process.stdin.prependListener("keypress", (char, key) => {
  const line = rl.line;

  // Activate picker when '/' is the first character typed
  if (char === "/" && line === "") {
    activatePicker(rl, COMMANDS, onSelect, onDismiss);
    return;
  }

  if (!isPickerActive()) return;

  if (key.name === "up" || key.name === "down") {
    navigatePicker(key.name);
    // readline will also process this as history navigation —
    // restore rl.line to current filter on next tick
    // (currentFilter is the substring after '/' in rl.line, tracked by picker.ts)
    process.nextTick(() => {
      const filter = rl.line.replace(/^\//, "");
      (rl as any).line = "/" + filter;
      (rl as any).cursor = filter.length + 1;
    });
    return;
  }

  if (key.name === "escape") {
    dismissPicker();
    return;
  }
});
```

**`line` handler** — when picker is active and Enter is pressed, readline fires `line` with the current `/filter` text. The handler checks `isPickerActive()`, calls `confirmPicker()`, and returns early (skips normal dispatch).

**`exit` handling** — updated to match both `exit` and `/exit`:

```ts
if (trimmed === "exit" || trimmed === "/exit") {
  rl.close();
  return;
}
```

---

## 9. Out of Scope

- Mouse support
- Scrolling (all 7 commands fit without scrolling; can be added later if command count grows)
- Multi-column layout
- Persistent command history filtering
