# SpecFirst Terminal Interface — Design Spec

**Date:** 2026-05-16
**Status:** Approved
**Scope:** Claude Code-style terminal interface layer for the SpecFirst CLI — branded header, interactive REPL, bottom status bar

---

## 1. Goal

Add a pipeline-first terminal interface to the existing SpecFirst CLI. When `specfirst` is run with no arguments, it launches a branded interactive REPL. When run with a subcommand (`specfirst run src/...`), it runs normally and exits — direct command mode is untouched. Both modes print a bottom status bar after commands that produce pipeline results.

---

## 2. Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Rendering library | `readline` + `chalk` (no Ink) | No new deps; fits existing logger.ts pattern |
| Banner in direct mode | No — interactive only | Keeps direct commands clean for scripts and CI |
| Status bar in direct mode | Yes — printed at end of command | Gives consistent feedback without a persistent UI |
| REPL features | History + tab completion | Node built-in readline, no extra deps |

---

## 3. Brand

```
Symbol:  ◈  (chalk.hex("#A61E5C").bold)   — magenta, matches logo key shape
Brand:   SpecFirst (chalk.hex("#5B1D87").bold)  — purple
```

Logo reference: `dd2029a4-1219-464a-9c46-b2b916f909b0.png` — geometric key, purple/magenta gradient. The `◈` symbol mirrors the circular bow with diamond cutout.

Color palette:

```ts
brandPurple:  "#5B1D87"   // "SpecFirst" label
brandMagenta: "#A61E5C"   // ◈ symbol
successGreen: "#22C55E"   // ✓
failureRed:   "#EF4444"   // ✗
warningYellow:"#FACC15"   // ⚠
mutedGray:    "#8A8A8A"   // path, subtitles, divider
textWhite:    "#F5F5F5"   // body text
```

---

## 4. Visual Design

### Banner (interactive mode only)

```
◈  SpecFirst v0.1.0
   Accessibility TDD Agent
   .\Documents\SpecFirst-React-a11y

──────────────────────────────────────────────────────────────

>
```

- `◈` in brandMagenta bold
- `SpecFirst` in brandPurple bold
- Subtitle and path in mutedGray
- Divider: 62× `─` in mutedGray

### Pipeline output (both modes)

```
SpecFirst Run: Picker.tsx

✓ Analyze component
✓ Classify pattern: react-select-only-combobox
✓ Load manifest: 11 checks
✓ Freeze spec
✓ Generate tests
✗ Baseline red-confirmed: 3 failed checks
✓ Bob prompt generated

Failed checks:
  - keyboard-arrow-down-opens
  - keyboard-enter-selects
  - keyboard-escape-closes

Next:
  Open specfirst/runs/<run-id>/bobPrompt.md in IBM Bob.
  After Bob patches the component, run:

  specfirst verify <run-id>
```

### Status bar (both modes, after pipeline commands)

After `run`:
```
◈ SpecFirst │ run 2026-05-16T20-01 │ 11 checks │ 3 failed │ frozen ✓ │ Bob prompt ready
```

After `verify`:
```
◈ SpecFirst │ final verify │ 11/11 passed │ manual review required │ evidenceReport.md
```

---

## 5. File Structure

Two new files; two files modified:

```
specfirst/cli/
  index.ts          ← modified: detect no-args, delegate to startShell()
  shell.ts          ← new: readline REPL loop
  shared/
    ui.ts           ← new: theme constants + printBanner / printDivider / printStatusBar
    logger.ts       ← unchanged
    runContext.ts   ← unchanged
    errorHandling.ts ← unchanged
  commands/
    run.ts          ← modified: action handler returns RunStats
    verify.ts       ← modified: action handler returns RunStats
    report.ts       ← modified: action handler returns RunStats
    (others unchanged)
```

---

## 6. `RunStats` Interface

Defined in `shared/ui.ts`. Commands that produce pipeline results return this; commands that don't return `null`.

```ts
export interface RunStats {
  phase: "run" | "verify" | "report";
  runId: string;
  totalChecks: number;
  failedChecks: number;
  frozen: boolean;
  bobPromptReady: boolean;
  artifactPath?: string;  // e.g. path to evidenceReport.md
}
```

---

## 7. `ui.ts` — Visual Primitives

Owns theme constants and the three print functions. Only imported by `index.ts` and `shell.ts`.

```ts
printBanner(version: string, projectPath: string): void
printDivider(): void
printStatusBar(stats: RunStats): void
```

`printStatusBar` formats output contextually:
- `phase: "run"` → shows check counts, frozen flag, Bob prompt status
- `phase: "verify"` → shows pass rate, "manual review required"
- `phase: "report"` → shows artifact path

---

## 8. `shell.ts` — REPL

Startup: `printBanner` → `printDivider` → readline prompt loop.

Tab completion:
- Command names: `run`, `verify`, `report`, `baseline`, `bob-prompt`, `help`, `exit`
- Path completion: one-level `fs.readdirSync` of the partial path's parent directory when input starts with `run ` or `verify `, filtered to `.tsx` files for `run` and to run-ID folder names for `verify`

Dispatch: each line is parsed as `command [args...]` and routed directly to the command's exported action handler — not re-parsed through Commander.

Error handling: catches command errors, prints via `logger`-style output, returns to `>` prompt without exiting. Session stays alive across errors.

Exit: `exit`, Ctrl+C, Ctrl+D → `readline.close()` → `process.exit(0)`.

---

## 9. `index.ts` — No-args Detection

```ts
if (process.argv.length <= 2) {
  startShell();
} else {
  program.parse();
}
```

Direct command mode is completely unchanged — no banner, full Commander parsing.

---

## 10. Command Refactor Contract

Commands that produce stats (`run`, `verify`, `report`) split their logic:

```ts
// Exported for Commander:
export function runCommand(): Command { ... }

// Exported for shell dispatch:
export async function runAction(file: string, options: RunOptions): Promise<RunStats | null> { ... }
```

The Commander `.action()` wrapper calls `runAction` and discards the return value. The shell dispatcher calls `runAction` and passes the return value to `printStatusBar`.

Commands that don't produce stats (`init`, `baseline`, `bob-prompt`, `patch-guard`, `watch`) keep their current structure — action handlers return `void`.

---

## 11. Out of Scope

- Ink / React-based terminal rendering
- Persistent live-updating status bar (requires Ink)
- VS Code extension
- Web UI
- Bob API integration
