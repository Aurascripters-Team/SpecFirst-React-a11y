import fs from "node:fs";
import path from "node:path";
import { generateBobPrompt } from "../core/bob/generateBobPrompt.js";
import type { BaselineRedConfirmed } from "../core/baseline/types.js";
import type { LockedSpecSuccess } from "../core/spec/types.js";
import type { TestGenerationGenerated } from "../core/test-generation/types.js";
import type { BobFailed, BobPromptGenerated, BobSkipped } from "../core/bob/types.js";

const [, , input] = process.argv;

if (!input) {
  console.error("Usage: tsx specfirst/cli/generateBobPrompt.ts <run-id|path-to-baselineResult.json>");
  process.exit(1);
}

const projectRoot = process.cwd();
console.log(`[Phase 7] Generating Bob prompt for: ${input}`);

const baselineResultPath = resolveBaselinePath(input, projectRoot);
const runDir = path.dirname(baselineResultPath);
const runId = path.basename(runDir);
const bobPatchResultPath = path.join(runDir, "bobPatchResult.json");

const fail = (reason: string, message: string, details?: unknown): never => {
  const result: BobFailed = {
    schemaVersion: "1.0.0",
    status: "failed",
    reason,
    message,
    ...(details === undefined ? {} : { details }),
    nextPhase: { canContinue: false },
  };
  writeJson(bobPatchResultPath, result);
  console.error(`[Phase 7] FAILED: ${reason} — ${message}`);
  process.exit(1);
};

if (!fs.existsSync(baselineResultPath)) {
  fail("baseline_result_not_found", `baselineResult.json not found at ${rel(projectRoot, baselineResultPath)}. Run Phase 6 first.`);
}

const baseline = readJson<BaselineRedConfirmed>(baselineResultPath);
if (!baseline.ok) {
  fail("baseline_result_malformed", "baselineResult.json could not be parsed.", baseline.error);
}

if (baseline.value.status === "skipped") {
  const skipped: BobSkipped = {
    schemaVersion: "1.0.0",
    status: "skipped",
    reason: "baseline_skipped",
    message: "Phase 6 was skipped. Phase 7 cannot generate a Bob prompt without baseline results.",
    nextPhase: { canContinue: false },
  };
  writeJson(bobPatchResultPath, skipped);
  console.log("[Phase 7] Skipped: Phase 6 baseline was skipped.");
  process.exit(0);
}

if (baseline.value.status !== "red-confirmed") {
  fail(
    "baseline_not_red_confirmed",
    `Phase 6 baseline status is '${baseline.value.status}'. Phase 7 only proceeds from 'red-confirmed'.`,
  );
}

const bv = baseline.value as BaselineRedConfirmed;
const lockedSpecPath = path.resolve(projectRoot, bv.lockedSpecPath);
const testGenPath = path.join(runDir, "testGenerationResult.json");

if (!fs.existsSync(lockedSpecPath)) {
  fail("locked_spec_missing", `Locked spec not found: ${bv.lockedSpecPath}`);
}

if (!fs.existsSync(testGenPath)) {
  fail("test_gen_missing", `testGenerationResult.json not found in run directory.`);
}

const lockedSpec = readJson<LockedSpecSuccess>(lockedSpecPath);
if (!lockedSpec.ok) {
  fail("locked_spec_malformed", "lockedSpec.json could not be parsed.", lockedSpec.error);
}

const testGen = readJson<TestGenerationGenerated>(testGenPath);
if (!testGen.ok) {
  fail("test_gen_malformed", "testGenerationResult.json could not be parsed.", testGen.error);
}

const promptPath = path.join(runDir, "bobPrompt.md");
const { promptText } = generateBobPrompt(
  lockedSpec.value,
  bv,
  testGen.value,
  projectRoot,
  promptPath,
);

const promptGenResult: BobPromptGenerated = {
  schemaVersion: "1.0.0",
  status: "prompt-generated",
  component: {
    name: lockedSpec.value.component.name,
    path: lockedSpec.value.component.path,
  },
  inputs: {
    lockedSpecPath: bv.lockedSpecPath,
    baselineResultPath: rel(projectRoot, baselineResultPath),
    testGenerationResultPath: rel(projectRoot, testGenPath),
  },
  bobPromptPath: rel(projectRoot, promptPath),
  message: "Bob prompt generated. Open IBM Bob IDE, paste or reference this prompt, and let Bob patch the target component. Then run: npm run specfirst:patch-guard -- " + input,
  nextPhase: {
    canContinue: false,
    reason: "Waiting for Bob to patch the component. Run specfirst:patch-guard after Bob completes.",
  },
};

writeJson(bobPatchResultPath, promptGenResult);

console.log(`[Phase 7] Bob prompt written to: ${rel(projectRoot, promptPath)}`);
console.log(`[Phase 7] Failing checks: ${bv.failedChecks.map((c) => c.id).join(", ")}`);
console.log(`[Phase 7] Target component: ${lockedSpec.value.component.path}`);
console.log("");
console.log("  Next steps:");
console.log("  1. Open IBM Bob IDE in this project");
console.log(`  2. Use the prompt at: ${rel(projectRoot, promptPath)}`);
console.log(`  3. Bob should patch only: ${lockedSpec.value.component.path}`);
console.log("  4. Export the Bob session markdown to bob_sessions/");
console.log(`  5. Run: npm run specfirst:patch-guard -- ${input}`);

function resolveBaselinePath(inp: string, root: string): string {
  if (inp.endsWith(".json")) return path.resolve(root, inp);
  return path.resolve(root, "specfirst", "runs", inp, "baselineResult.json");
}

function readJson<T>(filePath: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, "utf8")) as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function rel(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, "/");
}
