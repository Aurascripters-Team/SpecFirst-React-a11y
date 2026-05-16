import path from "node:path";
import { loadManifestForClassification } from "../core/manifest/loadManifest.js";

const input = process.argv[2];

if (!input) {
  console.error("Usage: npm run specfirst:load-manifest -- <path-to-classification.json | run-id>");
  process.exit(1);
}

const projectRoot = process.cwd();
const classificationPath = input.endsWith(".json")
  ? input
  : path.join("specfirst", "runs", input, "classification.json");

const result = loadManifestForClassification({ classificationPath, projectRoot });

console.log("SpecFirst Phase 3: Manifest Loader");
console.log(`Status: ${result.status}`);

if (result.status === "loaded") {
  const runDir = path.dirname(path.resolve(projectRoot, classificationPath));
  console.log(`Component: ${result.component.name}`);
  console.log(`Manifest: ${result.manifest.id}@${result.manifest.version ?? "unknown"}`);
  console.log(`Output: ${path.relative(projectRoot, path.join(runDir, "manifestLoadResult.json")).replace(/\\/g, "/")}`);
  console.log(`Snapshot: ${path.relative(projectRoot, path.join(runDir, "manifestUsed.json")).replace(/\\/g, "/")}`);
} else {
  console.log(`Reason: ${result.reason}`);
  console.log(result.message);
  process.exit(1);
}
