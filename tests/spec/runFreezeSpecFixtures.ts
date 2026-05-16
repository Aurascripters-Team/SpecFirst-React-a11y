import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadManifestForClassification } from "../../specfirst/core/manifest/loadManifest.js";
import { freezeSpec } from "../../specfirst/core/spec/freezeSpec.js";
import type { ComponentAnalysis } from "../../specfirst/core/analysis/types.js";
import type { ClassificationArtifact } from "../../specfirst/core/classification/types.js";
import type { ManifestLoadResult, RuleManifest } from "../../specfirst/core/manifest/types.js";
import type { LockedSpecResult, LockedSpecSuccess } from "../../specfirst/core/spec/types.js";

const projectRoot = process.cwd();
const tmpRoot = path.join(projectRoot, ".cache", "freeze-spec-tests");
const fixtureRun = path.join(projectRoot, "specfirst", "runs", "2026-05-16T06-33-14-434Z-analyze");
const fixedCreatedAt = "2026-05-16T06:33:14.434Z";

fs.rmSync(tmpRoot, { recursive: true, force: true });
fs.mkdirSync(tmpRoot, { recursive: true });

const locked = testSuccessfulLock();
testHashStability(locked);
testHashChanges();
testSkippedCases();
testFailedCases();

console.log("Freeze spec fixture tests passed.");

function testSuccessfulLock(): LockedSpecSuccess {
  const runDir = createLoadedRun("supported");
  const result = freezeSpec({
    input: path.join(runDir, "manifestLoadResult.json"),
    projectRoot,
    createdAt: fixedCreatedAt,
  });

  assert.equal(result.status, "locked");
  if (result.status !== "locked") {
    throw new Error("Expected locked result");
  }

  assert.equal(result.schemaVersion, "1.0.0");
  assert.equal(result.component.name, "SelectOnlyCombobox");
  assert.equal(result.component.path, "tests/fixtures/NamedFunctionCombobox.tsx");
  assert.equal(result.classification.pattern, "react-select-only-combobox");
  assert.equal(result.manifest.id, "react-select-only-combobox");
  assert.equal(result.manifest.version, "1.0.0");
  assert.equal(result.spec.createdAt, fixedCreatedAt);
  assert.equal(result.spec.createdBeforePatch, true);
  assert.equal(result.nextPhase.canContinue, true);
  assert.equal(result.nextPhase.testGenerationInput, "lockedSpec.json");

  assert.ok(result.sourceArtifacts.componentAnalysisPath.endsWith("componentAnalysis.json"));
  assert.ok(result.sourceArtifacts.classificationPath.endsWith("classification.json"));
  assert.ok(result.sourceArtifacts.manifestLoadResultPath.endsWith("manifestLoadResult.json"));
  assert.ok(result.sourceArtifacts.manifestUsedPath.endsWith("manifestUsed.json"));
  assert.match(result.sourceArtifacts.hashes.componentAnalysis, /^sha256:[a-f0-9]{64}$/);
  assert.match(result.sourceArtifacts.hashes.classification, /^sha256:[a-f0-9]{64}$/);
  assert.match(result.sourceArtifacts.hashes.manifestLoadResult, /^sha256:[a-f0-9]{64}$/);
  assert.match(result.sourceArtifacts.hashes.manifestUsed, /^sha256:[a-f0-9]{64}$/);

  assert.deepEqual(result.generationPolicy, {
    mode: "deterministic",
    bobUsed: false,
    testsGenerated: false,
    componentModified: false,
    uiRendered: false,
    complianceClaimMade: false,
  });

  assert.equal(result.componentBindings.triggerElementId, "jsx-3");
  assert.equal(result.componentBindings.popupElementId, "jsx-4");
  assert.deepEqual(result.componentBindings.optionElementIds, ["jsx-5"]);
  assert.equal(result.componentBindings.controlState, "open");
  assert.equal(result.componentBindings.elements.trigger.sourceLocation.startLine, 31);
  assert.equal(result.componentScope.strategy, "demo-wrapper");
  assert.equal(result.componentScope.selector, '[data-specfirst-root="SelectOnlyCombobox"]');
  assert.equal(result.testHarnessHints.needsLabelProp, true);
  assert.equal(result.testHarnessHints.needsOptionsCollection, true);
  assert.equal(result.testHarnessHints.needsOnChangeSpy, true);

  assert.equal(result.checks.length, 11);
  const checkIds = result.checks.map((check) => check.id);
  assert.deepEqual(checkIds, [
    "accessible-name",
    "combobox-role",
    "expanded-state",
    "popup-associated",
    "popup-listbox",
    "option-roles",
    "selected-state",
    "keyboard-arrow-down-opens",
    "keyboard-enter-selects",
    "keyboard-escape-closes",
    "axe-scan",
  ]);

  const expanded = getCheck(result, "expanded-state");
  assert.equal(expanded.sourceRequirementId, "expanded-state");
  assert.equal(expanded.layers.wcagOutcomes[0], "4.1.2");
  assert.equal(expanded.params.triggerElementId, "jsx-3");
  assert.equal(expanded.params.popupElementId, "jsx-4");
  assert.deepEqual(expanded.params.optionElementIds, ["jsx-5"]);
  assert.equal(expanded.params.controlState, "open");
  assert.equal(expanded.params.attribute, "aria-expanded");

  const accessibleName = getCheck(result, "accessible-name");
  assert.equal(accessibleName.params.role, "combobox");
  assert.equal(typeof accessibleName.params.accessibleNameBinding, "object");

  const axe = getCheck(result, "axe-scan");
  assert.equal(axe.params.scopeSelector, '[data-specfirst-root="SelectOnlyCombobox"]');
  assert.deepEqual(axe.params.axeTags, ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]);
  assert.ok(Array.isArray(axe.params.axeRules));

  const comboboxRole = getCheck(result, "combobox-role");
  assert.deepEqual(comboboxRole.params.allowedHostElements, ["button"]);

  const keyboardOpen = getCheck(result, "keyboard-arrow-down-opens");
  assert.equal(typeof keyboardOpen.params.focusManagementStrategy, "object");
  assert.equal(keyboardOpen.params.expectedActiveOption, "first-option");

  assert.equal(result.validation.requiredMvpChecksPresent, true);
  assert.deepEqual(result.focusManagementStrategy, {
    type: "aria-activedescendant",
    domFocusRemainsOn: "trigger",
    activeOptionReferencedBy: "aria-activedescendant",
  });
  assert.equal(result.manualReviewRequired.length, 6);
  assert.equal(result.bobPatchConstraints.length, 6);
  assert.ok(result.accessibilityClaimBoundary.forbiddenClaims.includes("WCAG 2.2 AA compliant"));
  assert.ok(result.accessibilityClaimBoundary.forbiddenClaims.includes("Component is accessible"));
  assert.equal(result.accessibilityClaimBoundary.forbiddenClaims.includes("Code was patched"), false);
  assert.equal(result.accessibilityClaimBoundary.manualReviewRequired, true);
  assert.deepEqual(result.phaseStateBoundary, {
    phase: 4,
    forbiddenAtThisPhase: ["Code was patched", "Tests were generated", "Component behavior was verified"],
  });
  assert.equal(result.integrity.hashAlgorithm, "sha256");
  assert.equal(result.integrity.hashFieldPolicy, "integrity.hash set to null before hashing");
  assert.equal(result.integrity.canonicalization, "recursive-key-sort");
  assert.equal(result.integrity.hashIncludesCreatedAt, true);
  assert.match(result.integrity.hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(fs.existsSync(path.join(runDir, "lockedSpec.json")), true);

  return result;
}

function testHashStability(first: LockedSpecSuccess): void {
  const runDir = path.dirname(path.join(projectRoot, first.sourceArtifacts.manifestLoadResultPath));
  const second = freezeSpec({
    input: path.join(runDir, "manifestLoadResult.json"),
    projectRoot,
    createdAt: fixedCreatedAt,
  });

  assert.equal(second.status, "locked");
  if (second.status === "locked") {
    assert.equal(second.integrity.hash, first.integrity.hash);
  }
}

function testHashChanges(): void {
  const base = freezeSpec({
    input: path.join(createLoadedRun("hash-base"), "manifestLoadResult.json"),
    projectRoot,
    createdAt: fixedCreatedAt,
  });
  assert.equal(base.status, "locked");
  if (base.status !== "locked") {
    throw new Error("Expected base lock");
  }

  const bindingChanged = freezeSpec({
    input: path.join(
      createLoadedRun("hash-binding", {
        analysis: (analysis) => {
          analysis.interactionModel.candidateTriggerElementId = "jsx-2";
        },
      }),
      "manifestLoadResult.json",
    ),
    projectRoot,
    createdAt: fixedCreatedAt,
  });
  assertHashDifferent(base, bindingChanged);

  const descriptionChanged = freezeSpec({
    input: path.join(
      createLoadedRun("hash-description", {
        manifest: (manifest) => {
          const requirement = manifest.requirements?.find((item) => item.id === "expanded-state");
          if (requirement) {
            requirement.description = "Changed description for hash regression.";
          }
        },
      }),
      "manifestLoadResult.json",
    ),
    projectRoot,
    createdAt: fixedCreatedAt,
  });
  assertHashDifferent(base, descriptionChanged);

  const pathChanged = freezeSpec({
    input: path.join(
      createLoadedRun("hash-component-path", {
        analysis: (analysis) => {
          analysis.component.path = "tests/fixtures/MovedCombobox.tsx";
        },
        classification: (classification) => {
          classification.component.path = "tests/fixtures/MovedCombobox.tsx";
        },
        manifestLoadResult: (manifestLoad) => {
          if (manifestLoad.status === "loaded") {
            manifestLoad.component.path = "tests/fixtures/MovedCombobox.tsx";
          }
        },
      }),
      "manifestLoadResult.json",
    ),
    projectRoot,
    createdAt: fixedCreatedAt,
  });
  assertHashDifferent(base, pathChanged);

  const sourceHashChanged = freezeSpec({
    input: path.join(
      createLoadedRun("hash-source-artifact", {
        classification: (classification) => {
          classification.scoreBreakdown.score = 30.5;
        },
      }),
      "manifestLoadResult.json",
    ),
    projectRoot,
    createdAt: fixedCreatedAt,
  });
  assertHashDifferent(base, sourceHashChanged);
}

function testSkippedCases(): void {
  const phase2Blocked = createBaseRun("phase2-blocked");
  const classification = readJson<ClassificationArtifact>(path.join(phase2Blocked, "classification.json"));
  classification.classification.status = "unsupported";
  classification.nextPhase = { canContinue: false };
  writeJson(path.join(phase2Blocked, "classification.json"), classification);

  const phase2Result = freezeSpec({
    input: path.join(phase2Blocked, "manifestLoadResult.json"),
    projectRoot,
    createdAt: fixedCreatedAt,
  });
  assert.equal(phase2Result.status, "skipped");
  if (phase2Result.status === "skipped") {
    assert.equal(phase2Result.reason, "classification_blocked");
    assert.equal(phase2Result.upstream.classificationCanContinue, false);
    assert.equal(phase2Result.nextPhase.canContinue, false);
  }

  const phase3Skipped = createBaseRun("phase3-skipped");
  writeJson(path.join(phase3Skipped, "manifestLoadResult.json"), {
    schemaVersion: "1.0.0",
    status: "skipped",
    component: readJson<ClassificationArtifact>(path.join(phase3Skipped, "classification.json")).component,
    classification: readJson<ClassificationArtifact>(path.join(phase3Skipped, "classification.json")).classification,
    reason: "classification_blocked",
    message: "Skipped fixture.",
    nextPhase: { canContinue: false },
  });
  const phase3Result = freezeSpec({
    input: path.join(phase3Skipped, "manifestLoadResult.json"),
    projectRoot,
    createdAt: fixedCreatedAt,
  });
  assert.equal(phase3Result.status, "skipped");
  if (phase3Result.status === "skipped") {
    assert.equal(phase3Result.reason, "manifest_load_skipped");
    assert.equal(phase3Result.upstream.manifestStatus, "skipped");
  }
}

function testFailedCases(): void {
  assertFailure("missing-manifest-used", "manifest_snapshot_unavailable", (runDir) => {
    fs.rmSync(path.join(runDir, "manifestUsed.json"));
  });

  assertFailure("missing-trigger", "missing_trigger", (_runDir, analysis) => {
    analysis.interactionModel.candidateTriggerElementId = undefined;
  });

  assertFailure("missing-popup", "missing_popup", (_runDir, analysis) => {
    analysis.interactionModel.candidatePopupElementId = undefined;
  });

  assertFailure("missing-options", "missing_options", (_runDir, analysis) => {
    analysis.interactionModel.candidateOptionElementIds = [];
  });

  assertFailure("missing-manual-review", "missing_manual_review", (_runDir, _analysis, manifest) => {
    manifest.manualReviewRequired = [];
  });

  assertFailure("missing-report-boundary", "missing_report_boundary", (_runDir, _analysis, manifest) => {
    delete manifest.reportBoundary;
  });

  assertFailure("missing-bob-constraints", "missing_bob_constraints", (_runDir, _analysis, manifest) => {
    manifest.bobPatchConstraints = [];
  });

  assertFailure("missing-requirements", "missing_requirements", (_runDir, _analysis, manifest) => {
    manifest.requirements = [];
  });

  const stoppedRun = createBaseRun("manifest-stopped");
  writeJson(path.join(stoppedRun, "manifestLoadResult.json"), {
    schemaVersion: "1.0.0",
    status: "stopped",
    reason: "registry_not_found",
    message: "Stopped fixture.",
    nextPhase: { canContinue: false },
  });
  const stopped = freezeSpec({
    input: path.join(stoppedRun, "manifestLoadResult.json"),
    projectRoot,
    createdAt: fixedCreatedAt,
  });
  assert.equal(stopped.status, "failed");
  if (stopped.status === "failed") {
    assert.equal(stopped.reason, "manifest_load_not_loaded");
  }
}

function assertFailure(
  name: string,
  reason: string,
  mutate: (runDir: string, analysis: ComponentAnalysis, manifest: RuleManifest) => void,
): void {
  const runDir = createLoadedRun(name);
  const analysisPath = path.join(runDir, "componentAnalysis.json");
  const manifestPath = path.join(runDir, "manifestUsed.json");
  const analysis = readJson<ComponentAnalysis>(analysisPath);
  const manifest = fs.existsSync(manifestPath) ? readJson<RuleManifest>(manifestPath) : ({} as RuleManifest);
  mutate(runDir, analysis, manifest);
  if (fs.existsSync(analysisPath)) {
    writeJson(analysisPath, analysis);
  }
  if (fs.existsSync(manifestPath)) {
    writeJson(manifestPath, manifest);
  }

  const result = freezeSpec({
    input: path.join(runDir, "manifestLoadResult.json"),
    projectRoot,
    createdAt: fixedCreatedAt,
  });
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.reason, reason);
    assert.equal(result.nextPhase.canContinue, false);
  }
}

function createLoadedRun(
  name: string,
  mutations: {
    analysis?: (analysis: ComponentAnalysis) => void;
    classification?: (classification: ClassificationArtifact) => void;
    manifestLoadResult?: (manifestLoadResult: ManifestLoadResult) => void;
    manifest?: (manifest: RuleManifest) => void;
  } = {},
): string {
  const runDir = createBaseRun(name);
  const classificationPath = path.join(runDir, "classification.json");

  loadManifestForClassification({
    classificationPath,
    projectRoot,
  });

  const analysisPath = path.join(runDir, "componentAnalysis.json");
  const manifestLoadPath = path.join(runDir, "manifestLoadResult.json");
  const manifestPath = path.join(runDir, "manifestUsed.json");
  const classification = readJson<ClassificationArtifact>(classificationPath);
  const analysis = readJson<ComponentAnalysis>(analysisPath);
  const manifestLoadResult = readJson<ManifestLoadResult>(manifestLoadPath);
  const manifest = readJson<RuleManifest>(manifestPath);

  mutations.analysis?.(analysis);
  mutations.classification?.(classification);
  mutations.manifestLoadResult?.(manifestLoadResult);
  mutations.manifest?.(manifest);

  writeJson(analysisPath, analysis);
  writeJson(classificationPath, classification);
  writeJson(manifestLoadPath, manifestLoadResult);
  writeJson(manifestPath, manifest);

  return runDir;
}

function createBaseRun(name: string): string {
  const runDir = path.join(tmpRoot, name);
  fs.mkdirSync(runDir, { recursive: true });
  fs.copyFileSync(path.join(fixtureRun, "componentAnalysis.json"), path.join(runDir, "componentAnalysis.json"));
  fs.copyFileSync(path.join(fixtureRun, "classification.json"), path.join(runDir, "classification.json"));
  return runDir;
}

function getCheck(result: LockedSpecSuccess, id: string) {
  const check = result.checks.find((item) => item.id === id);
  assert.ok(check, `Expected check ${id}`);
  return check;
}

function assertHashDifferent(base: LockedSpecSuccess, result: LockedSpecResult): void {
  assert.equal(result.status, "locked");
  if (result.status === "locked") {
    assert.notEqual(result.integrity.hash, base.integrity.hash);
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
