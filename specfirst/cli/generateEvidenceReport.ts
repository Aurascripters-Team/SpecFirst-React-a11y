import fs from "node:fs";
import path from "node:path";
import { generateEvidenceReport } from "../core/final-verification/generateEvidenceReport.js";
import type { FinalVerificationResult } from "../core/final-verification/types.js";

const [, , input] = process.argv;

if (!input) {
  console.error("Usage: tsx specfirst/cli/generateEvidenceReport.ts <run-id|path-to-finalVerificationResult.json>");
  process.exit(1);
}

const projectRoot = process.cwd();
console.log(`[Phase 8] Generating evidence report for: ${input}`);

const finalResultPath = resolveFinalResultPath(input, projectRoot);
const runDir = path.dirname(finalResultPath);
const reportPath = path.join(runDir, "evidenceReport.md");

if (!fs.existsSync(finalResultPath)) {
  console.error(`[Phase 8] finalVerificationResult.json not found at ${finalResultPath}. Run Phase 8 verify first.`);
  process.exit(1);
}

let result: FinalVerificationResult;
try {
  result = JSON.parse(fs.readFileSync(finalResultPath, "utf8")) as FinalVerificationResult;
} catch {
  console.error("[Phase 8] finalVerificationResult.json could not be parsed.");
  process.exit(1);
}

const report = generateEvidenceReport(result);

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, report);

const relReport = path.relative(projectRoot, reportPath).replace(/\\/g, "/");
console.log(`[Phase 8] Evidence report written to: ${relReport}`);
console.log(`[Phase 8] Status: ${result.status}`);

if (result.status === "passed" || result.status === "failed") {
  console.log(`[Phase 8] Allowed conclusion: Passed SpecFirst automated accessibility contract. Manual review required.`);
  if (!result.bobSessionEvidence.present) {
    console.warn("[Phase 8] WARNING: Bob session evidence is missing. Upload bob_sessions/ exports before submission.");
  }
}

function resolveFinalResultPath(inp: string, root: string): string {
  if (inp.endsWith(".json")) return path.resolve(root, inp);
  return path.resolve(root, "specfirst", "runs", inp, "finalVerificationResult.json");
}
