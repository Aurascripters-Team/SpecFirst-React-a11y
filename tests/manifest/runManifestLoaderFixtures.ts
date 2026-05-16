import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadManifestForClassification } from "../../specfirst/core/manifest/loadManifest.js";
import type { ClassificationArtifact } from "../../specfirst/core/classification/types.js";

const projectRoot = process.cwd();
const tmpRoot = path.join(projectRoot, ".cache", "manifest-loader-tests");

fs.rmSync(tmpRoot, { recursive: true, force: true });
fs.mkdirSync(tmpRoot, { recursive: true });

testCurrentManifestSummary();
testSkippedDoesNotReadManifest();
testArtificialManifestSummary();
testStoppedCases();

console.log("Manifest loader fixture tests passed.");

function testCurrentManifestSummary(): void {
  const runDir = path.join(tmpRoot, "supported-run");
  fs.mkdirSync(runDir, { recursive: true });
  const classificationPath = path.join(runDir, "classification.json");
  writeJson(classificationPath, supportedClassification());

  const loaded = loadManifestForClassification({
    classificationPath,
    projectRoot,
  });

  assert.equal(loaded.status, "loaded");
  if (loaded.status !== "loaded") {
    return;
  }

  assert.equal(loaded.schemaVersion, "1.0.0");
  assert.equal(loaded.component.name, "SelectOnlyCombobox");
  assert.equal(loaded.classification.pattern, "react-select-only-combobox");
  assert.equal(loaded.classification.status, "supported");
  assert.equal(loaded.classification.confidence, 0.97);
  assert.equal(loaded.classification.confidenceLevel, "high");
  assert.equal(loaded.manifest.id, "react-select-only-combobox");
  assert.equal(loaded.manifest.sourceModel, "7-layer");
  assert.equal(loaded.nextPhase.canContinue, true);
  assert.equal(loaded.nextPhase.loadedManifestPath, "specfirst/rules/react-select-only-combobox.v1.json");

  assert.equal(loaded.sourceLayerValidation.valid, true);
  assert.deepEqual(loaded.sourceLayerValidation.missingLayers, []);
  assert.equal(loaded.sourceLayerValidation.requiredLayers.length, 7);
  assert.equal(loaded.sourceLayerValidation.presentLayers.length, 7);
  assert.equal(loaded.sourceLayerValidation.layers.manualReview, true);

  assert.equal(loaded.manifestSummary.requirementCount, 11);
  assert.equal(loaded.manifestSummary.automatedRequirementCount, 11);
  assert.equal(loaded.manifestSummary.manualReviewCount, 6);
  assert.equal(loaded.manifestSummary.bobPatchConstraintCount, 6);
  assert.equal(loaded.manifestSummary.specFirstPolicyCount, 5);
  assert.ok(loaded.manifestSummary.requirementIds.includes("accessible-name"));
  assert.ok(loaded.manifestSummary.automatedRequirementIds.includes("axe-scan"));
  assert.ok(loaded.manifestSummary.manualReviewIds.includes("screen-reader-announcement-quality"));
  assert.ok(loaded.manifestSummary.specFirstPolicies.includes("native-first"));

  assert.equal(loaded.applicability.status, "phase2-gate-passed");
  assert.ok(loaded.applicability.requires.includes("single selected value at a time"));
  assert.ok(loaded.applicability.rejectIf.includes("text input present inside popup"));
  assert.deepEqual(loaded.applicability.rejectIfTriggered, []);

  assert.equal(loaded.reportBoundary.manualReviewRequired, true);
  assert.ok(loaded.reportBoundary.allowedClaims.includes("Manual review is required before making accessibility claims"));
  assert.ok(loaded.reportBoundary.forbiddenClaims.includes("WCAG 2.2 AA compliant"));
  assert.ok(loaded.reportBoundary.forbiddenClaims.includes("Component is accessible"));
  assert.ok(loaded.reportBoundary.forbiddenClaims.includes("Tests were generated"));

  const resultPath = path.join(runDir, "manifestLoadResult.json");
  const snapshotPath = path.join(runDir, "manifestUsed.json");
  assert.equal(fs.existsSync(resultPath), true);
  assert.equal(fs.existsSync(snapshotPath), true);

  const writtenResult = JSON.parse(fs.readFileSync(resultPath, "utf8")) as typeof loaded;
  assert.equal(writtenResult.status, "loaded");
  if (writtenResult.status === "loaded") {
    assert.equal(writtenResult.manifestSummary.requirementCount, 11);
  }
}

function testSkippedDoesNotReadManifest(): void {
  const isolatedProjectRoot = path.join(tmpRoot, "skipped-project-without-rules");
  const runDir = path.join(isolatedProjectRoot, "run");
  fs.mkdirSync(runDir, { recursive: true });
  const classificationPath = path.join(runDir, "classification.json");
  writeJson(classificationPath, {
    ...supportedClassification(),
    classification: {
      ...supportedClassification().classification,
      status: "unsupported",
    },
    nextPhase: {
      canContinue: false,
    },
  });

  const skipped = loadManifestForClassification({
    classificationPath,
    projectRoot: isolatedProjectRoot,
  });

  assert.equal(skipped.status, "skipped");
  if (skipped.status === "skipped") {
    assert.equal(skipped.component.name, "SelectOnlyCombobox");
    assert.equal(skipped.classification.status, "unsupported");
    assert.equal(skipped.reason, "classification_blocked");
    assert.equal(skipped.nextPhase.canContinue, false);
  }
  assert.equal(fs.existsSync(path.join(runDir, "manifestUsed.json")), false);
  assert.equal(fs.existsSync(path.join(runDir, "manifestLoadResult.json")), true);
}

function testArtificialManifestSummary(): void {
  const artificialProjectRoot = createProjectWithManifest("artificial-project", artificialManifest());
  const runDir = path.join(artificialProjectRoot, "run");
  fs.mkdirSync(runDir, { recursive: true });
  const classificationPath = path.join(runDir, "classification.json");
  writeJson(classificationPath, supportedClassification());

  const loaded = loadManifestForClassification({
    classificationPath,
    projectRoot: artificialProjectRoot,
  });

  assert.equal(loaded.status, "loaded");
  if (loaded.status !== "loaded") {
    return;
  }

  assert.deepEqual(loaded.manifestSummary.requirementIds, ["name", "manual-note"]);
  assert.equal(loaded.manifestSummary.requirementCount, 2);
  assert.deepEqual(loaded.manifestSummary.automatedRequirementIds, ["name"]);
  assert.equal(loaded.manifestSummary.automatedRequirementCount, 1);
  assert.deepEqual(loaded.manifestSummary.manualReviewIds, ["human-check"]);
  assert.equal(loaded.manifestSummary.bobPatchConstraintCount, 2);
  assert.deepEqual(loaded.manifestSummary.specFirstPolicies, ["native-first", "no-overclaim"]);
  assert.equal(loaded.manifestSummary.specFirstPolicyCount, 2);
}

function testStoppedCases(): void {
  const malformedRun = path.join(tmpRoot, "malformed-classification");
  fs.mkdirSync(malformedRun, { recursive: true });
  const malformedPath = path.join(malformedRun, "classification.json");
  fs.writeFileSync(malformedPath, "{ not json");
  const malformed = loadManifestForClassification({ classificationPath: malformedPath, projectRoot });
  assert.equal(malformed.status, "stopped");
  if (malformed.status === "stopped") {
    assert.equal(malformed.reason, "classification_malformed");
    assert.equal(malformed.nextPhase.canContinue, false);
  }

  const missingManifestProject = createProjectWithManifest("missing-manifest-project", artificialManifest(), {
    skipManifestFile: true,
  });
  assertStoppedForManifest(missingManifestProject, "file_not_found");

  const invalidSourceProject = createProjectWithManifest("invalid-source-model-project", {
    ...artificialManifest(),
    sourceModel: "flat",
  });
  assertStoppedForManifest(invalidSourceProject, "invalid_source_model");

  const missingLayerManifest = artificialManifest();
  delete missingLayerManifest.sources.manualReview;
  const missingLayerProject = createProjectWithManifest("missing-layer-project", missingLayerManifest);
  assertStoppedForManifest(missingLayerProject, "missing_layer");

  const missingBoundaryManifest = artificialManifest();
  delete missingBoundaryManifest.reportBoundary;
  const missingBoundaryProject = createProjectWithManifest("missing-boundary-project", missingBoundaryManifest);
  assertStoppedForManifest(missingBoundaryProject, "missing_report_boundary");
}

function assertStoppedForManifest(project: string, reason: string): void {
  const runDir = path.join(project, "run");
  fs.mkdirSync(runDir, { recursive: true });
  const classificationPath = path.join(runDir, "classification.json");
  writeJson(classificationPath, supportedClassification());

  const result = loadManifestForClassification({ classificationPath, projectRoot: project });
  assert.equal(result.status, "stopped");
  if (result.status === "stopped") {
    assert.equal(result.reason, reason);
    assert.equal(result.nextPhase.canContinue, false);
  }
  assert.equal(fs.existsSync(path.join(runDir, "manifestUsed.json")), false);
}

function supportedClassification(): ClassificationArtifact {
  return {
    schemaVersion: "1.0.0",
    component: {
      name: "SelectOnlyCombobox",
      path: "tests/fixtures/NamedFunctionCombobox.tsx",
    },
    classification: {
      pattern: "react-select-only-combobox",
      status: "supported",
      confidence: 0.97,
      confidenceLevel: "high",
      decisionReason:
        "Classified as react-select-only-combobox because the component has a controlled value, options collection, selection callback, trigger-controlled popup, mapped selectable options, and no text input.",
    },
    scoreBreakdown: {
      score: 30.07,
      maxScore: 31,
      normalized: 0.97,
    },
    candidateScores: [
      {
        pattern: "react-select-only-combobox",
        score: 31,
        maxScore: 31,
        normalized: 1,
        blocked: false,
      },
    ],
    evidence: [],
    blockers: [],
    rejectedPatterns: [],
    manualReviewNotes: [],
    nextPhase: {
      canContinue: true,
      manifestId: "react-select-only-combobox",
    },
  };
}

function createProjectWithManifest(
  name: string,
  manifest: Record<string, unknown>,
  options: { skipManifestFile?: boolean } = {},
): string {
  const root = path.join(tmpRoot, name);
  const rulesDir = path.join(root, "specfirst", "rules");
  fs.mkdirSync(rulesDir, { recursive: true });
  writeJson(path.join(rulesDir, "registry.json"), {
    manifests: {
      "react-select-only-combobox": {
        file: "manifest.json",
        status: "supported",
      },
    },
  });

  if (!options.skipManifestFile) {
    writeJson(path.join(rulesDir, "manifest.json"), manifest);
  }

  return root;
}

function artificialManifest(): Record<string, any> {
  return {
    id: "react-select-only-combobox",
    version: "test",
    sourceModel: "7-layer",
    sources: {
      wcagOutcomes: [{}],
      ariaPattern: [{}],
      ariaValidity: [{}],
      accessibleName: [{}],
      automation: [{}],
      manualReview: [{}],
      specfirstPolicy: [{ rule: "native-first" }, { rule: "no-overclaim" }],
    },
    requirements: [
      { id: "name", testable: true, maturity: "automated" },
      { id: "manual-note", testable: false, maturity: "manual" },
    ],
    manualReviewRequired: ["human-check"],
    bobPatchConstraints: ["Preserve props", "Do not rewrite"],
    applicability: {
      requires: ["single value"],
      rejectIf: ["text input"],
    },
    reportBoundary: {
      allowedLanguage: ["Manifest loaded"],
      forbidden: ["WCAG compliant"],
    },
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
