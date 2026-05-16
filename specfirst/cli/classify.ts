import fs from "node:fs";
import path from "node:path";
import { classifyComponent } from "../core/classification/classifyComponent.js";
import type { ComponentAnalysis } from "../core/analysis/types.js";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: npm run specfirst:classify -- <path-to-componentAnalysis.json>");
  process.exit(1);
}

const projectRoot = process.cwd();
const absoluteInputPath = path.resolve(projectRoot, inputPath);

if (!fs.existsSync(absoluteInputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const analysis = JSON.parse(fs.readFileSync(absoluteInputPath, "utf8")) as ComponentAnalysis;

if (analysis.schemaVersion !== "1.1.0") {
  console.error(`Unsupported componentAnalysis schemaVersion: ${String(analysis.schemaVersion)}`);
  process.exit(1);
}

const classification = classifyComponent(analysis);
const outputPath = path.join(path.dirname(absoluteInputPath), "classification.json");
fs.writeFileSync(outputPath, `${JSON.stringify(classification, null, 2)}\n`);

console.log("SpecFirst Phase 2: Pattern Classification");
console.log(`Component: ${classification.component.name}`);
console.log(`Pattern: ${classification.classification.pattern}`);
console.log(`Status: ${classification.classification.status}`);
console.log(`Confidence: ${classification.classification.confidence.toFixed(2)} (${classification.classification.confidenceLevel})`);
console.log(`Can continue: ${classification.nextPhase.canContinue ? "yes" : "no"}`);
console.log(`Output: ${path.relative(projectRoot, outputPath).replace(/\\/g, "/")}`);

if (classification.blockers.length > 0) {
  console.log("");
  console.log("Blockers:");
  for (const blocker of classification.blockers) {
    console.log(`- ${blocker.id}: ${blocker.reason}`);
  }
}

if (classification.manualReviewNotes.length > 0) {
  console.log("");
  console.log("Manual review notes:");
  for (const note of classification.manualReviewNotes) {
    console.log(`- ${note}`);
  }
}
