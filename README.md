# SpecFirst React A11y

**Deterministic accessibility compliance pipeline for React components, powered by IBM Bob.**

SpecFirst turns a React component file into a frozen, hashed accessibility contract, generates Playwright tests from that contract, proves the current component fails those tests, hands a constrained remediation task to IBM Bob, and then verifies the result — producing a tamper-evident evidence report.

> Built for the IBM Bob Hackathon. Theme: **Turn idea into impact faster.**

---

## How it works

The pipeline runs in 8 phases. Each phase reads the output of the previous one and refuses to continue if the chain of custody is broken.

```
Phase 1  Analyze component      Static ts-morph analysis — props, state, JSX tree, ARIA signals
Phase 2  Classify pattern       Confidence-scored UI pattern detection (select-only combobox, etc.)
Phase 3  Load rule manifest     Validates a 7-layer WCAG rulebook against the classified pattern
Phase 4  Freeze spec            Binds manifest requirements to component elements → lockedSpec.json (SHA-256 signed)
Phase 5  Generate tests         Deterministic Playwright + axe-core tests from the frozen contract
Phase 6  Run baseline test      Proves the unpatched component fails the contract (baseline-red)
Phase 7  Bob patches component  IBM Bob receives a constrained prompt and patches only the target file
Phase 8  Verify + report        Reruns the same tests, compares to baseline, writes evidenceReport.md
```

**Trust model:** SpecFirst constrains → Bob patches → SpecFirst verifies.
Bob never defines the rules, edits the tests, or decides whether the component passed.

---

## Prerequisites

- Node.js 20+
- npm 10+
- IBM Bob IDE (required for Phase 7 and hackathon submission)

```bash
npm install
npx playwright install chromium
```

---

## Quick start

### Interactive terminal (recommended)

```bash
npm run specfirst:cli
```

This opens the branded SpecFirst REPL:

```
◈  SpecFirst v0.1.0
   Accessibility TDD Agent
   /your/project/path

──────────────────────────────────────────────────────────────

>
```

At the prompt, run the pipeline against any React component:

```
> run tests/fixtures/ArrowComponentWithAria.tsx
```

Tab completion works for command names, `.tsx` file paths, and run IDs.

### Direct command mode

```bash
npm run specfirst:cli -- run tests/fixtures/ArrowComponentWithAria.tsx
```

Exits after the command. No banner, no REPL. Same pipeline output.

### Shell commands

| Command | What it does |
|---|---|
| `run <file>` | Phases 1–5: analyze → classify → manifest → freeze → generate tests |
| `verify <run-id>` | Phases 7b–8: patch guard + final verification |
| `report <run-id>` | Generate `evidenceReport.md` |
| `baseline <run-id>` | Phase 6: run baseline test only |
| `bob-prompt <run-id>` | Phase 7a: generate `bobPrompt.md` for IBM Bob |
| `help` | Show available commands |
| `exit` | Exit the terminal |

---

## Full pipeline walkthrough

### Step 1 — Run phases 1–5

```bash
npm run specfirst:cli -- run tests/fixtures/ArrowComponentWithAria.tsx
```

Output (example):

```
SpecFirst Run: ArrowComponentWithAria.tsx

✓ Analyze component
✓ Classify pattern: react-select-only-combobox
✓ Load manifest: 11 checks
✓ Freeze spec
✓ Generate tests

Run ID: 2026-05-16T20-01-11-151Z-analyze
```

Everything is written to `specfirst/runs/<run-id>/`.

### Step 2 — Run the baseline test (Phase 6)

```bash
npm run specfirst:baseline -- 2026-05-16T20-01-11-151Z-analyze
```

Runs `npx playwright test tests/a11y/Picker.spec.ts --reporter=json` against the **unpatched** component. Expects failures. Writes `baselineResult.json`.

The Vite demo server starts automatically (serves `src/specfirst-demo/` on port 4173).

### Step 3 — Generate the Bob prompt (Phase 7a)

```bash
npm run specfirst:bob-prompt -- 2026-05-16T20-01-11-151Z-analyze
```

Writes `specfirst/runs/<run-id>/bobPrompt.md` — a constrained remediation task for IBM Bob that names exactly which checks failed, which files Bob must not touch, and the ARIA patch constraints from the manifest.

### Step 4 — Open IBM Bob IDE and patch the component

1. Open IBM Bob IDE in this project
2. Start a new task using the generated `bobPrompt.md`
3. Bob patches **only** the target component file
4. Export the Bob session markdown from Bob IDE history
5. Save it to `bob_sessions/`

### Step 5 — Run the patch guard (Phase 7b)

```bash
npm run specfirst:patch-guard -- 2026-05-16T20-01-11-151Z-analyze bob_sessions/session.md
```

Verifies:
- `lockedSpec.json`, the test file, and the harness are unchanged
- Bob only edited the allowed component file (via `git diff`)
- Bob session export is recorded

### Step 6 — Final verification and evidence report (Phase 8)

```bash
npm run specfirst:verify-final -- 2026-05-16T20-01-11-151Z-analyze
npm run specfirst:report -- 2026-05-16T20-01-11-151Z-analyze
```

Reruns the exact same Playwright tests against the patched component. Computes which checks Bob resolved and whether Bob introduced new failures. Writes `finalVerificationResult.json` and `evidenceReport.md`.

The evidence report's allowed conclusion is always:

> **Passed SpecFirst automated accessibility contract. Manual review required.**

It never claims WCAG compliance, full accessibility, or screen reader compatibility.

---

## Run directory structure

Every pipeline run produces a self-contained directory:

```
specfirst/runs/<run-id>/
  componentAnalysis.json      Phase 1 output
  classification.json         Phase 2 output
  manifestLoadResult.json     Phase 3 output
  manifestUsed.json           Phase 3 manifest snapshot
  lockedSpec.json             Phase 4 output (SHA-256 signed)
  testGenerationResult.json   Phase 5 output
  baselineResult.json         Phase 6 output
  bobPrompt.md                Phase 7 input for IBM Bob
  bobPatchResult.json         Phase 7 output
  finalVerificationResult.json Phase 8 output
  evidenceReport.md           Phase 8 final report
  baselineOutput.json         Raw Playwright JSON (Phase 6)
  baselineOutput.txt          Raw Playwright stderr (Phase 6)
  finalOutput.json            Raw Playwright JSON (Phase 8)
  finalOutput.txt             Raw Playwright stderr (Phase 8)
```

---

## Project structure

```
specfirst/
  core/
    analysis/           Phase 1 — ts-morph static analyzer
    classification/     Phase 2 — pattern classifier and scorer
    manifest/           Phase 3 — 7-layer rulebook loader
    spec/               Phase 4 — spec freezer and SHA-256 signer
    test-generation/    Phase 5 — Playwright + axe test generator
    baseline/           Phase 6 — Playwright runner and classifier
    bob/                Phase 7 — Bob prompt generator and patch guard
    final-verification/ Phase 8 — verifier and evidence report writer
  cli/
    index.ts            Entry point (no-args → REPL, args → Commander)
    shell.ts            readline REPL with tab completion
    shared/
      ui.ts             Brand theme, RunStats, printBanner/Divider/StatusBar
      logger.ts         Step spinner, fatal, warn, info
      runContext.ts     Run directory paths
      errorHandling.ts  assertStatus, handleCommandError
    commands/
      run.ts            Phases 1–5 pipeline
      baseline.ts       Phase 6 CLI
      bobPrompt.ts      Phase 7a CLI
      patchGuard.ts     Phase 7b CLI
      verify.ts         Phase 8a CLI
      report.ts         Phase 8b CLI
      watch.ts          File watcher (continuous mode)
      init.ts           Project initialiser
  rules/
    registry.json                        Supported manifest registry
    react-select-only-combobox.v1.json   7-layer WCAG rulebook for the MVP pattern
  runs/                                  Generated per-run artifacts (git-ignored)

src/
  specfirst-demo/       Vite app that serves generated test harnesses
    generated/          Auto-generated React harness components (Phase 5)
    App.tsx             Route-based harness loader
    main.tsx

tests/
  fixtures/             React component fixtures for testing
  a11y/                 Generated Playwright accessibility specs (Phase 5)
  analysis/             Phase 1 unit tests
  classification/       Phase 2 unit tests
  manifest/             Phase 3 unit tests
  spec/                 Phase 4 unit tests
  test-generation/      Phase 5 unit tests
  cli/                  CLI unit tests (ui.ts, shell.ts)

architecture_guidelines/  PDF architecture docs for all 8 phases
bob_sessions/             IBM Bob session exports (required for submission)
```

---

## Running the tests

```bash
npm run test:analysis         # Phase 1
npm run test:classification   # Phase 2
npm run test:manifest         # Phase 3
npm run test:spec             # Phase 4
npm run test:test-generation  # Phase 5
npm run test:ui               # terminal ui.ts (14 tests)
npm run test:shell            # shell completer (7 tests)
npm run typecheck             # TypeScript across all source
```

---

## Supported patterns (MVP)

The pipeline currently supports one UI pattern end-to-end:

| Pattern | Description |
|---|---|
| `react-select-only-combobox` | Custom dropdown with keyboard navigation, no text input, `aria-activedescendant` focus strategy |

Components classified as `native-select`, `react-editable-combobox`, `mixed-interactive-popup`, or `unknown` stop at Phase 2 with a clear reason. Extending to new patterns requires adding a manifest to `specfirst/rules/` and registering it in `registry.json`.

---

## IBM Bob integration

Phase 7 generates a `bobPrompt.md` that tells Bob exactly:

- Which component to patch (the only allowed changed file)
- Which locked-spec checks failed in the baseline
- Which files Bob must not touch (locked spec, generated tests, generated harness)
- The ARIA patch constraints from the manifest (allowed attributes, keyboard handlers, forbidden DOM restructuring)
- The `aria-activedescendant` focus management strategy

After Bob patches, the patch guard runs `git diff` to verify Bob stayed in scope and re-hashes the three immutable artifacts. If any protected file changed, the pipeline stops.

For hackathon submission, export the Bob task session from IBM Bob IDE (History → select task → Export) and save it to `bob_sessions/` before running `specfirst:patch-guard`.

---

## Manual review required

Even when all 11 automated checks pass, the evidence report always lists what automated testing cannot verify:

- Screen reader announcement quality (NVDA, JAWS, VoiceOver)
- Visual focus indicator quality
- Native select preference in context
- Cross-browser assistive technology behavior
- Option label meaningfulness
- Cognitive load

The pipeline proves the ARIA contract is mechanically satisfied. It does not certify the component is usable.

---

## Architecture documentation

Full architecture guides for each phase are in `architecture_guidelines/`:

| File | Content |
|---|---|
| `SpecFirst_Phase1_ts_morph_Architecture.pdf` | ts-morph static analysis design |
| `SpecFirst_Phase2_Pattern_Classification.pdf` | Confidence scoring and pattern selection |
| `SpecFirst_Phase3_Seven_Layer_Rulebook_FIXED.pdf` | 7-layer manifest structure and validation |
| `SpecFirst_Phase4_Freeze_Spec_Documentation.pdf` | Contract binding and SHA-256 hashing |
| `SpecFirst_Phase5_Test_Generation_Documentation.pdf` | Test strategy templates and harness design |
| `SpecFirst_Phase6_Run_Baseline_Test.pdf` | Baseline-red classification and infra vs assertion failure |
| `SpecFirst_Phase7_Bob_Patches_Component.pdf` | Bob prompt structure and patch scope guard |
| `SpecFirst_Phase8_Verify_And_Evidence_Report.pdf` | Final verification and claim boundary enforcement |
