import path from "node:path";
import { runBaseline } from "../core/baseline/runBaseline.js";

const [, , input] = process.argv;

if (!input) {
  console.error("Usage: tsx specfirst/cli/runBaseline.ts <run-id|path-to-testGenerationResult.json>");
  process.exit(1);
}

const projectRoot = process.cwd();
console.log(`[Phase 6] Running baseline tests for: ${input}`);

const result = runBaseline({ input, projectRoot });

const runDir = input.endsWith(".json")
  ? path.dirname(path.resolve(projectRoot, input))
  : path.resolve(projectRoot, "specfirst", "runs", input);

const relRunDir = path.relative(projectRoot, runDir).replace(/\\/g, "/");

console.log(`[Phase 6] Status: ${result.status}`);

if (result.status === "red-confirmed") {
  console.log(`[Phase 6] Baseline red-confirmed. Failed checks: ${result.failedChecks.map((c) => c.id).join(", ")}`);
  console.log(`[Phase 6] Passed checks: ${result.passedChecks.join(", ")}`);
  console.log(`[Phase 6] Artifacts written to ${relRunDir}/`);
  console.log(`[Phase 6] Next: bob-prompt ${input}`);
} else if (result.status === "green-unexpected") {
  console.warn(`[Phase 6] WARNING: All tests passed before Bob patching. Pipeline paused.`);
  console.warn(`[Phase 6] This may mean the component already satisfies the contract.`);
  console.log(`[Phase 6] Artifacts written to ${relRunDir}/`);
  process.exit(1);
} else if (result.status === "invalidated") {
  console.error(`[Phase 6] INVALIDATED: Artifact hashes do not match Phase 5 records.`);
  for (const m of result.hashMismatches) {
    console.error(`  - ${m.artifact}: expected ${m.expected}, got ${m.actual}`);
  }
  process.exit(1);
} else if (result.status === "infra-failed") {
  console.error(`[Phase 6] INFRA FAILURE: ${result.reason}`);
  console.error(`[Phase 6] ${result.message}`);
  console.error(`[Phase 6] Check that Vite is running or that Playwright browsers are installed.`);
  if (result.rawOutput) {
    console.error(`[Phase 6] Raw output:\n${result.rawOutput.slice(0, 1000)}`);
  }
  process.exit(1);
} else if (result.status === "skipped") {
  console.log(`[Phase 6] Skipped: ${result.message}`);
} else if (result.status === "failed") {
  console.error(`[Phase 6] FAILED: ${result.reason} — ${result.message}`);
  process.exit(1);
}
