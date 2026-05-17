# SpecFirst — Project Instructions

## Git Workflow

- **Never commit directly to `main`.** Always create a feature branch and open a pull request.
- Every commit message must include a body paragraph explaining what changed and why.

## Project Overview

SpecFirst is a deterministic accessibility compliance pipeline for React components. It analyzes a component's AST, classifies it against known ARIA patterns, loads a rule manifest, freezes a locked spec, generates Playwright tests, runs a baseline, hands off to an AI coding assistant (Bob) for remediation, and verifies the final result.

### Pipeline Phases

| Phase | Script | Description |
|---|---|---|
| 1 | `specfirst:analyze` | AST analysis via ts-morph |
| 2 | `specfirst:classify` | Pattern classification |
| 3 | `specfirst:load-manifest` | Rule manifest loader |
| 4 | `specfirst:freeze-spec` | Lock accessibility spec |
| 5 | `specfirst:generate-tests` | Generate Playwright tests |
| 6 | `specfirst baseline` | Red-confirm baseline failures |
| 7 | `specfirst bob-prompt` | Generate Bob remediation prompt |
| 8 | `specfirst verify` | Patch-guard + final verification |

### Run Artifacts

Each pipeline run writes artifacts to `specfirst/runs/<timestamp>-analyze/`:

```
componentAnalysis.json
classification.json
manifestLoadResult.json
manifestUsed.json
lockedSpec.json
testGenerationResult.json
baselineResult.json
bobPrompt.md
finalVerificationResult.json
evidenceReport.md
```

## Stack

- **Language:** TypeScript (ESM, `"type": "module"`)
- **Runtime:** `tsx` for CLI scripts
- **Frontend:** React 19 + Vite
- **Testing:** Playwright + `@axe-core/playwright`
- **AST:** `ts-morph`
- **CLI:** `commander` + `chalk` + `ora`

## Key Scripts

```bash
npm run specfirst:analyze      # Phase 1 — analyze a component
npm run specfirst:classify     # Phase 2 — classify pattern
npm run specfirst:load-manifest # Phase 3 — load rule manifest
npm run specfirst:freeze-spec  # Phase 4 — freeze spec
npm run specfirst:generate-tests # Phase 5 — generate tests
npm run specfirst:demo         # Start Vite dev server (localhost:5173)
npm run typecheck              # TypeScript type check (no emit)
```

## Code Conventions

- All core logic lives in `specfirst/core/`. CLI wrappers live in `specfirst/cli/`.
- Phase functions return typed result objects with a `status` field and a `nextPhase.canContinue` flag — never throw for expected failures.
- `specfirst/cli/shared/logger.ts` owns all terminal output. Commands must not call `console.log` directly.
- `specfirst/cli/shared/runContext.ts` owns all run-folder path resolution. Commands must not construct paths manually.
- `specfirst/cli/shared/errorHandling.ts` owns `assertStatus()` and `handleCommandError()`.

## Claim Boundary

SpecFirst makes only one claim: **"Passed SpecFirst automated accessibility contract. Manual review required."**

It never claims WCAG compliance or full accessibility. Enforce this in any generated report or UI copy.

## Design Docs

Specs live in `docs/superpowers/specs/`.
