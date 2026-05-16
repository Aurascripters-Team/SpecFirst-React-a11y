import path from "node:path";
import { freezeSpec } from "../core/spec/freezeSpec.js";

const input = process.argv[2];

if (!input) {
  console.error("Usage: npm run specfirst:freeze-spec -- <run-id | path-to-manifestLoadResult.json>");
  process.exit(1);
}

const projectRoot = process.cwd();
const result = freezeSpec({ input, projectRoot });

console.log("SpecFirst Phase 4: Freeze Spec");
console.log(`Status: ${result.status}`);

if (result.status === "locked") {
  const runDir = input.endsWith(".json")
    ? path.dirname(path.resolve(projectRoot, input))
    : path.join(projectRoot, "specfirst", "runs", input);
  console.log(`Component: ${result.component.name}`);
  console.log(`Checks: ${result.checks.length}`);
  console.log(`Hash: ${result.integrity.hash}`);
  console.log(`Output: ${path.relative(projectRoot, path.join(runDir, "lockedSpec.json")).replace(/\\/g, "/")}`);
} else {
  console.log(`Reason: ${result.reason}`);
  console.log(result.message);
  process.exit(result.status === "skipped" ? 0 : 1);
}
