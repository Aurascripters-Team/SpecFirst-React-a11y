import path from "node:path";
import { runFinalVerification } from "../core/final-verification/runFinalVerification.js";

const [, , input] = process.argv;

if (!input) {
  console.error("Usage: tsx specfirst/cli/verifyFinal.ts <run-id|path-to-bobPatchResult.json>");
  process.exit(1);
}

const projectRoot = process.cwd();
console.log(`[Phase 8] Running final verification for: ${input}`);

const result = runFinalVerification({ input, projectRoot });

const runDir = input.endsWith(".json")
  ? path.dirname(path.resolve(projectRoot, input))
  : path.resolve(projectRoot, "specfirst", "runs", input);
const relRunDir = path.relative(projectRoot, runDir).replace(/\\/g, "/");

console.log(`[Phase 8] Status: ${result.status}`);

if (result.status === "passed") {
  console.log(`[Phase 8] All ${result.finalTestSummary.total} generated tests passed.`);
  console.log(`[Phase 8] Resolved checks: ${result.checkComparison.resolved.join(", ") || "(none)"}`);
  if (result.checkComparison.newFailures.length > 0) {
    console.warn(`[Phase 8] WARNING: New failures introduced: ${result.checkComparison.newFailures.join(", ")}`);
  }
  if (!result.bobSessionEvidence.present) {
    console.warn("[Phase 8] WARNING: Bob session evidence is missing. Evidence is incomplete for submission.");
  }
  console.log(`[Phase 8] Artifacts written to ${relRunDir}/`);
  console.log(`[Phase 8] Next: report ${input}`);
} else if (result.status === "failed") {
  console.warn(`[Phase 8] Tests still failing after Bob patch.`);
  console.warn(`[Phase 8] Failing checks: ${result.stillFailingChecks.join(", ")}`);
  console.log(`[Phase 8] Resolved checks: ${result.checkComparison.resolved.join(", ") || "(none)"}`);
  console.log(`[Phase 8] Artifacts written to ${relRunDir}/`);
  console.log(`[Phase 8] Evidence report will reflect remaining failures.`);
  console.log(`[Phase 8] Next: report ${input}`);
} else if (result.status === "invalidated") {
  console.error(`[Phase 8] INVALIDATED: ${result.message}`);
  process.exit(1);
} else if (result.status === "infra-failed") {
  console.error(`[Phase 8] INFRA FAILURE: ${result.reason} — ${result.message}`);
  if (result.rawOutput) console.error(result.rawOutput.slice(0, 1000));
  process.exit(1);
} else if (result.status === "skipped") {
  console.log(`[Phase 8] Skipped: ${result.message}`);
}
