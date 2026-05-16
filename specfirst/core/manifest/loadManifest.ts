import fs from "node:fs";
import path from "node:path";
import type { ClassificationArtifact } from "../classification/types.js";
import type {
  ApplicabilitySummary,
  LoadManifestOptions,
  ManifestLoadResult,
  ManifestLoadSkipped,
  ManifestLoadSuccess,
  ManifestLoadStopped,
  ManifestSummary,
  Phase2ClassificationSummary,
  ReportBoundarySummary,
  ManifestRegistry,
  RuleManifest,
  SourceLayerValidation,
} from "./types.js";

const requiredLayers = [
  "wcagOutcomes",
  "ariaPattern",
  "ariaValidity",
  "accessibleName",
  "automation",
  "manualReview",
  "specfirstPolicy",
];

export function loadManifestForClassification(options: LoadManifestOptions): ManifestLoadResult {
  const projectRoot = options.projectRoot ?? process.cwd();
  const classificationPath = path.resolve(projectRoot, options.classificationPath);
  const runDir = path.dirname(classificationPath);
  const rulesDir = path.join(projectRoot, "specfirst", "rules");
  const registryPath = path.join(rulesDir, "registry.json");
  const resultPath = path.join(runDir, "manifestLoadResult.json");
  const snapshotPath = path.join(runDir, "manifestUsed.json");
  const writeArtifacts = options.writeArtifacts ?? true;

  const stop = (reason: string, message: string, details?: unknown): ManifestLoadStopped => {
    const result: ManifestLoadStopped = {
      schemaVersion: "1.0.0",
      status: "stopped",
      reason,
      message,
      ...(details === undefined ? {} : { details }),
      nextPhase: { canContinue: false },
    };

    if (writeArtifacts) {
      writeJson(resultPath, result);
    }

    return result;
  };

  if (!fs.existsSync(classificationPath)) {
    return stop(
      "classification_not_found",
      `classification.json not found at ${classificationPath}. Has Phase 2 run for this component?`,
    );
  }

  const classificationRead = readJson<ClassificationArtifact>(classificationPath);
  if (!classificationRead.ok) {
    return stop(
      "classification_malformed",
      `classification.json could not be parsed at ${classificationPath}.`,
      classificationRead.error,
    );
  }
  const classification = classificationRead.value;

  if (classification.schemaVersion !== "1.0.0") {
    return stop(
      "unsupported_classification_schema",
      `Unsupported classification schemaVersion: ${String(classification.schemaVersion)}.`,
    );
  }

  if (!isClassificationShapeValid(classification)) {
    return stop(
      "classification_shape_invalid",
      "classification.json must contain classification.status, confidence, confidenceLevel, and decisionReason from Phase 2.",
    );
  }
  const classificationSummary = summarizeClassification(classification);

  if (!classification.nextPhase?.canContinue) {
    const skipped: ManifestLoadSkipped = {
      schemaVersion: "1.0.0",
      status: "skipped",
      component: classification.component,
      classification: classificationSummary,
      reason: "classification_blocked",
      message: "Phase 2 set canContinue=false. Phase 3 intentionally skipped manifest loading.",
      nextPhase: { canContinue: false },
    };

    if (writeArtifacts) {
      writeJson(resultPath, skipped);
    }

    return skipped;
  }

  const manifestId = classification.nextPhase.manifestId;
  if (!manifestId) {
    return stop("missing_manifest_id", "No manifestId provided in classification.nextPhase. Phase 3 will not guess.");
  }

  if (!fs.existsSync(registryPath)) {
    return stop("registry_not_found", `registry.json not found at ${registryPath}. Cannot validate manifest.`);
  }

  const registryRead = readJson<ManifestRegistry>(registryPath);
  if (!registryRead.ok) {
    return stop("registry_malformed", `registry.json could not be parsed at ${registryPath}.`, registryRead.error);
  }
  const registry = registryRead.value;

  const registryEntry = registry.manifests?.[manifestId];
  if (!registryEntry) {
    return stop(
      "registry_entry_not_found",
      `Manifest ID '${manifestId}' is not present in registry.json. Pattern unsupported or registry misconfigured.`,
    );
  }

  if (registryEntry.status !== "supported") {
    return stop(
      "registry_entry_not_supported",
      `Manifest '${manifestId}' has registry status '${registryEntry.status}'. Only 'supported' manifests may load.`,
    );
  }

  const manifestPath = path.join(rulesDir, registryEntry.file);
  if (!fs.existsSync(manifestPath)) {
    return stop("file_not_found", `Rulebook not found at ${manifestPath}. Registry entry exists but file is missing.`);
  }

  const manifestRead = readJson<RuleManifest>(manifestPath);
  if (!manifestRead.ok) {
    return stop("malformed_json", `Manifest at ${manifestPath} contains invalid JSON.`, manifestRead.error);
  }
  const manifest = manifestRead.value;

  if (manifest.id !== manifestId) {
    return stop(
      "pattern_mismatch",
      `Loaded manifest id '${String(manifest.id)}' does not match requested '${manifestId}'. Refusing to apply wrong rules.`,
    );
  }

  if (manifest.sourceModel !== "7-layer") {
    return stop(
      "invalid_source_model",
      `Manifest sourceModel is '${String(manifest.sourceModel)}'. Only '7-layer' manifests are accepted.`,
    );
  }

  const sourceLayerValidation = buildSourceLayerValidation(manifest);
  if (!sourceLayerValidation.valid) {
    return stop("missing_layer", "Manifest is missing one or more required source layers.", sourceLayerValidation);
  }

  if (!manifest.requirements || manifest.requirements.length === 0) {
    return stop("empty_requirements", "Manifest has no requirements defined. Phase 4 cannot generate a spec without them.");
  }

  if (!manifest.manualReviewRequired || manifest.manualReviewRequired.length === 0) {
    return stop("missing_manual_review", "Manifest must define manual review boundaries to prevent compliance overclaiming.");
  }

  if (!manifest.reportBoundary?.forbidden || manifest.reportBoundary.forbidden.length === 0) {
    return stop("missing_report_boundary", "Manifest must define reportBoundary.forbidden to prevent overclaiming in generated reports.");
  }

  if (!manifest.applicability?.rejectIf || manifest.applicability.rejectIf.length === 0) {
    return stop("missing_applicability", "Manifest must define applicability.rejectIf as a second safety gate.");
  }

  const relativeManifestPath = path.relative(projectRoot, manifestPath).replace(/\\/g, "/");
  const manifestSummary = buildManifestSummary(manifest);
  const applicability = buildApplicabilitySummary(manifest);
  const reportBoundary = buildReportBoundarySummary(manifest);
  const successResult: ManifestLoadSuccess = {
    schemaVersion: "1.0.0",
    status: "loaded",
    component: classification.component,
    classification: classificationSummary,
    manifest: {
      id: manifest.id,
      version: manifest.version ?? null,
      path: relativeManifestPath,
      status: "loaded",
      sourceModel: manifest.sourceModel,
    },
    sourceLayers: requiredLayers,
    validation: {
      registryEntryFound: true,
      manifestFileFound: true,
      schemaValid: true,
      patternMatchesClassification: true,
      applicabilityValidated: true,
      hasManualReviewBoundary: true,
      hasReportBoundary: true,
    },
    sourceLayerValidation,
    manifestSummary,
    applicability,
    reportBoundary,
    nextPhase: {
      canContinue: true,
      loadedManifestPath: relativeManifestPath,
    },
  };

  if (writeArtifacts) {
    writeJson(resultPath, successResult);
    writeJson(snapshotPath, manifest);
  }

  return successResult;
}

function readJson<T>(filePath: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, "utf8")) as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function isClassificationShapeValid(classification: ClassificationArtifact): boolean {
  return Boolean(
    classification.component?.name &&
      classification.component.path &&
      classification.classification?.pattern &&
      classification.classification.status &&
      typeof classification.classification.confidence === "number" &&
      classification.classification.confidenceLevel &&
      classification.classification.decisionReason,
  );
}

function summarizeClassification(classification: ClassificationArtifact): Phase2ClassificationSummary {
  return {
    pattern: classification.classification.pattern,
    status: classification.classification.status,
    confidence: classification.classification.confidence,
    confidenceLevel: classification.classification.confidenceLevel,
    decisionReason: classification.classification.decisionReason,
  };
}

function buildSourceLayerValidation(manifest: RuleManifest): SourceLayerValidation {
  const presentLayers = requiredLayers.filter((layer) => Boolean(manifest.sources?.[layer]));
  const missingLayers = requiredLayers.filter((layer) => !manifest.sources?.[layer]);
  const layers = Object.fromEntries(requiredLayers.map((layer) => [layer, Boolean(manifest.sources?.[layer])]));

  return {
    valid: missingLayers.length === 0,
    requiredLayers,
    presentLayers,
    missingLayers,
    layers,
  };
}

function buildManifestSummary(manifest: RuleManifest): ManifestSummary {
  const requirements = manifest.requirements ?? [];
  const requirementIds = requirements.map((requirement, index) => requirement.id ?? `requirement-${index + 1}`);
  const automatedRequirementIds = requirements
    .filter((requirement) => requirement.testable === true || requirement.maturity === "automated")
    .map((requirement, index) => requirement.id ?? `automated-requirement-${index + 1}`);
  const manualReviewIds = manifest.manualReviewRequired ?? [];
  const bobPatchConstraints = manifest.bobPatchConstraints ?? [];
  const specFirstPolicies = getSpecFirstPolicies(manifest);

  return {
    requirementIds,
    requirementCount: requirementIds.length,
    automatedRequirementIds,
    automatedRequirementCount: automatedRequirementIds.length,
    manualReviewIds,
    manualReviewCount: manualReviewIds.length,
    bobPatchConstraints,
    bobPatchConstraintCount: bobPatchConstraints.length,
    specFirstPolicies,
    specFirstPolicyCount: specFirstPolicies.length,
  };
}

function buildApplicabilitySummary(manifest: RuleManifest): ApplicabilitySummary {
  return {
    status: "phase2-gate-passed",
    requires: manifest.applicability?.requires ?? [],
    rejectIf: manifest.applicability?.rejectIf ?? [],
    rejectIfTriggered: [],
  };
}

function buildReportBoundarySummary(manifest: RuleManifest): ReportBoundarySummary {
  const forbiddenClaims = new Set([
    ...(manifest.reportBoundary?.forbidden ?? []),
    "Component is accessible",
    "Component passed WCAG",
    "Code was patched",
    "Tests were generated",
    "Component behavior was verified",
  ]);

  return {
    allowedClaims: manifest.reportBoundary?.allowedLanguage ?? [],
    forbiddenClaims: Array.from(forbiddenClaims),
    manualReviewRequired: true,
  };
}

function getSpecFirstPolicies(manifest: RuleManifest): string[] {
  const policies = manifest.sources?.specfirstPolicy;
  if (!Array.isArray(policies)) {
    return [];
  }

  return policies.map((policy, index) => {
    if (isObjectWithString(policy, "rule")) {
      return policy.rule;
    }

    return `specfirst-policy-${index + 1}`;
  });
}

function isObjectWithString(value: unknown, key: string): value is Record<string, string> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record[key] === "string";
}
