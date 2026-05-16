import path from "node:path";
import { generateTests } from "../core/test-generation/generateTests.js";

const input = process.argv[2];

if (!input) {
  console.error("Usage: npm run specfirst:generate-tests -- <run-id | path-to-lockedSpec.json>");
  process.exit(1);
}

const projectRoot = process.cwd();
const result = generateTests({ input, projectRoot });

console.log("SpecFirst Phase 5: Generate Tests");
console.log(`Status: ${result.status}`);

if (result.status === "generated") {
  const runDir = input.endsWith(".json")
    ? path.dirname(path.resolve(projectRoot, input))
    : path.join(projectRoot, "specfirst", "runs", input);
  console.log(`Tests: ${result.testFilePath}`);
  console.log(`Harness: ${result.harnessFilePath}`);
  console.log(`Checks: ${result.testCount}`);
  console.log(`Demo route: ${result.demoRoute}`);
  console.log(`Test hash: ${result.testFileHash}`);
  console.log(`Output: ${path.relative(projectRoot, path.join(runDir, "testGenerationResult.json")).replace(/\\/g, "/")}`);
} else {
  console.log(`Reason: ${result.reason}`);
  console.log(result.message);
  process.exit(result.status === "skipped" ? 0 : 1);
}
