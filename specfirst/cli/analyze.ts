import fs from "node:fs";
import path from "node:path";
import { analyzeComponent } from "../core/analysis/analyzeComponent.js";

const targetPath = process.argv[2];

if (!targetPath) {
  console.error("Usage: npm run specfirst:analyze -- <component-path>");
  process.exit(1);
}

const projectRoot = process.cwd();
const absoluteTargetPath = path.resolve(projectRoot, targetPath);

if (!fs.existsSync(absoluteTargetPath)) {
  console.error(`File not found: ${targetPath}`);
  process.exit(1);
}

const analysis = analyzeComponent(absoluteTargetPath, projectRoot);
const runDir = path.join(projectRoot, "specfirst", "runs", `${createTimestamp()}-analyze`);
fs.mkdirSync(runDir, { recursive: true });

const outputPath = path.join(runDir, "componentAnalysis.json");
fs.writeFileSync(outputPath, `${JSON.stringify(analysis, null, 2)}\n`);

console.log("SpecFirst Phase 1: Component Analysis");
console.log(`Component: ${analysis.component.name}`);
console.log(`Path: ${analysis.component.path}`);
console.log(`Output: ${path.relative(projectRoot, outputPath).replace(/\\/g, "/")}`);
console.log(`Props: ${analysis.props.length}`);
console.log(`State hooks: ${analysis.state.length}`);
console.log(`JSX elements: ${analysis.jsxElements.length}`);

if (analysis.riskFlags.length > 0) {
  console.log("");
  console.log("Risk flags:");
  for (const flag of analysis.riskFlags) {
    console.log(`- ${flag.severity.toUpperCase()}: ${flag.message}`);
  }
}

function createTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
