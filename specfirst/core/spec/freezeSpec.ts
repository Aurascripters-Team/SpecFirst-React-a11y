import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AccessibleNameCandidate, ComponentAnalysis, JsxElementRecord } from "../analysis/types.js";
import type { ClassificationArtifact } from "../classification/types.js";
import type { ManifestLoadResult, ManifestLoadSuccess, RuleManifest } from "../manifest/types.js";
import type {
  AccessibleNameBinding,
  BoundElement,
  ComponentBindings,
  ComponentScope,
  FreezeSpecInputs,
  FreezeSpecOptions,
  LockedSpecCheck,
  LockedSpecFailed,
  LockedSpecResult,
  LockedSpecSkipped,
  LockedSpecSuccess,
  ManualReviewItem,
  RequirementWithId,
  SourceArtifacts,
  TestHarnessHints,
} from "./types.js";

const supportedPattern = "react-select-only-combobox";
const focusManagementStrategy = {
  type: "aria-activedescendant",
  domFocusRemainsOn: "trigger",
  activeOptionReferencedBy: "aria-activedescendant",
} as const;
const phaseFourProcessForbiddenClaims = ["Code was patched", "Tests were generated", "Component behavior was verified"];
const wcagAxeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

export function freezeSpec(options: FreezeSpecOptions): LockedSpecResult {
  const projectRoot = options.projectRoot ?? process.cwd();
  const runDir = resolveRunDir(options.input, projectRoot);
  const paths = {
    componentAnalysis: path.join(runDir, "componentAnalysis.json"),
    classification: path.join(runDir, "classification.json"),
    manifestLoadResult: path.join(runDir, "manifestLoadResult.json"),
    manifestUsed: path.join(runDir, "manifestUsed.json"),
    lockedSpec: path.join(runDir, "lockedSpec.json"),
  };
  const writeArtifacts = options.writeArtifacts ?? true;

  const fail = (reason: string, message: string, details?: unknown): LockedSpecFailed => {
    const result: LockedSpecFailed = {
      schemaVersion: "1.0.0",
      status: "failed",
      reason,
      message,
      ...(details === undefined ? {} : { details }),
      nextPhase: { canContinue: false },
    };

    if (writeArtifacts) {
      writeJson(paths.lockedSpec, result);
    }

    return result;
  };

  const analysisRead = readJsonFile<ComponentAnalysis>(paths.componentAnalysis);
  if (!analysisRead.ok) {
    return fail("component_analysis_unavailable", "componentAnalysis.json is missing or malformed.", analysisRead.error);
  }

  const classificationRead = readJsonFile<ClassificationArtifact>(paths.classification);
  if (!classificationRead.ok) {
    return fail("classification_unavailable", "classification.json is missing or malformed.", classificationRead.error);
  }

  const analysis = analysisRead.value;
  const classification = classificationRead.value;

  if (analysis.schemaVersion !== "1.1.0") {
    return fail("unsupported_analysis_schema", `Unsupported componentAnalysis schemaVersion: ${String(analysis.schemaVersion)}.`);
  }

  if (classification.schemaVersion !== "1.0.0") {
    return fail("unsupported_classification_schema", `Unsupported classification schemaVersion: ${String(classification.schemaVersion)}.`);
  }

  if (!componentsMatch(analysis.component, classification.component)) {
    return fail("component_mismatch", "Phase 1 component identity does not match Phase 2 classification component.");
  }

  if (!classification.nextPhase.canContinue) {
    return skip(
      paths.lockedSpec,
      writeArtifacts,
      classification.component,
      "classification_blocked",
      "Phase 2 did not allow continuation. Phase 4 skipped spec freezing.",
      { classificationCanContinue: false },
    );
  }

  const manifestLoadRead = readJsonFile<ManifestLoadResult>(paths.manifestLoadResult);
  if (!manifestLoadRead.ok) {
    return fail("manifest_load_result_unavailable", "manifestLoadResult.json is missing or malformed.", manifestLoadRead.error);
  }

  const manifestLoadResult = manifestLoadRead.value;
  if (manifestLoadResult.status === "skipped") {
    return skip(
      paths.lockedSpec,
      writeArtifacts,
      classification.component,
      "manifest_load_skipped",
      "Phase 3 skipped manifest loading. Phase 4 skipped spec freezing.",
      {
        classificationCanContinue: classification.nextPhase.canContinue,
        manifestCanContinue: false,
        manifestStatus: manifestLoadResult.status,
      },
    );
  }

  if (manifestLoadResult.status !== "loaded") {
    return fail("manifest_load_not_loaded", "Phase 3 did not produce a loaded manifest result.", {
      manifestStatus: manifestLoadResult.status,
    });
  }

  if (!manifestLoadResult.nextPhase.canContinue) {
    return fail("manifest_load_blocked", "Phase 3 loaded result does not allow continuation.");
  }

  if (!componentsMatch(analysis.component, manifestLoadResult.component)) {
    return fail("component_mismatch", "Phase 1 component identity does not match Phase 3 manifest load component.");
  }

  const manifestRead = readJsonFile<RuleManifest>(paths.manifestUsed);
  if (!manifestRead.ok) {
    return fail("manifest_snapshot_unavailable", "manifestUsed.json is required for Phase 4 locking.", manifestRead.error);
  }
  const manifest = manifestRead.value;

  const validation = validateInputs({ analysis, classification, manifestLoadResult, manifest });
  if (!validation.ok) {
    return fail(validation.reason, validation.message, validation.details);
  }

  const result = buildLockedSpec({
    analysis,
    classification,
    manifestLoadResult,
    manifest,
    paths,
    projectRoot,
    createdAt: options.createdAt ?? new Date().toISOString(),
  });

  if (writeArtifacts) {
    writeJson(paths.lockedSpec, result);
  }

  return result;
}

function buildLockedSpec({
  analysis,
  classification,
  manifestLoadResult,
  manifest,
  paths,
  projectRoot,
  createdAt,
}: FreezeSpecInputs & {
  paths: {
    componentAnalysis: string;
    classification: string;
    manifestLoadResult: string;
    manifestUsed: string;
  };
  projectRoot: string;
  createdAt: string;
}): LockedSpecSuccess {
  const componentScope = buildComponentScope(analysis.component.name);
  const componentBindings = buildComponentBindings(analysis);
  const checks = buildChecks(manifest, componentBindings, componentScope);
  const sourceArtifacts = buildSourceArtifacts(paths, projectRoot);
  const specId = `${analysis.component.name}-${classification.classification.pattern}-${createdAt.replace(/[:.]/g, "-")}`;
  const base: Omit<LockedSpecSuccess, "integrity"> & {
    integrity: {
      hashAlgorithm: "sha256";
      hashFieldPolicy: "integrity.hash set to null before hashing";
      canonicalization: "recursive-key-sort";
      hashIncludesCreatedAt: true;
      hash: null;
    };
  } = {
    schemaVersion: "1.0.0",
    status: "locked",
    sourceArtifacts,
    generationPolicy: {
      mode: "deterministic",
      bobUsed: false,
      testsGenerated: false,
      componentModified: false,
      uiRendered: false,
      complianceClaimMade: false,
    },
    component: analysis.component,
    classification: classification.classification,
    manifest: {
      id: manifest.id ?? "",
      version: manifest.version ?? null,
      sourceModel: manifest.sourceModel ?? "",
      path: manifestLoadResult.manifest.path,
    },
    spec: {
      id: specId,
      createdAt,
      createdBeforePatch: true,
    },
    componentBindings,
    componentScope,
    testHarnessHints: buildTestHarnessHints(analysis),
    checks,
    validation: {
      requiredMvpChecksPresent: true,
    },
    focusManagementStrategy,
    manualReviewRequired: buildManualReviewItems(manifest),
    bobPatchConstraints: manifest.bobPatchConstraints ?? [],
    accessibilityClaimBoundary: buildAccessibilityClaimBoundary(manifestLoadResult),
    phaseStateBoundary: {
      phase: 4,
      forbiddenAtThisPhase: phaseFourProcessForbiddenClaims,
    },
    integrity: {
      hashAlgorithm: "sha256",
      hashFieldPolicy: "integrity.hash set to null before hashing",
      canonicalization: "recursive-key-sort",
      hashIncludesCreatedAt: true,
      hash: null,
    },
    nextPhase: {
      canContinue: true,
      testGenerationInput: "lockedSpec.json",
    },
  };
  const hash = hashCanonical(base);

  return {
    ...base,
    integrity: {
      hashAlgorithm: "sha256",
      hashFieldPolicy: "integrity.hash set to null before hashing",
      canonicalization: "recursive-key-sort",
      hashIncludesCreatedAt: true,
      hash,
    },
  };
}

function validateInputs(inputs: FreezeSpecInputs): { ok: true } | { ok: false; reason: string; message: string; details?: unknown } {
  const { analysis, classification, manifestLoadResult, manifest } = inputs;

  if (classification.classification.pattern !== supportedPattern) {
    return {
      ok: false,
      reason: "unsupported_pattern",
      message: `Phase 4 MVP only supports ${supportedPattern}.`,
      details: { pattern: classification.classification.pattern },
    };
  }

  if (manifestLoadResult.manifest.id !== classification.nextPhase.manifestId || manifest.id !== classification.nextPhase.manifestId) {
    return {
      ok: false,
      reason: "manifest_mismatch",
      message: "Phase 2, Phase 3, and manifest snapshot IDs must match.",
      details: {
        classificationManifestId: classification.nextPhase.manifestId,
        manifestLoadId: manifestLoadResult.manifest.id,
        manifestSnapshotId: manifest.id,
      },
    };
  }

  if (manifest.sourceModel !== "7-layer") {
    return {
      ok: false,
      reason: "invalid_manifest_source_model",
      message: "Manifest snapshot must use sourceModel 7-layer.",
      details: { sourceModel: manifest.sourceModel },
    };
  }

  if (!analysis.interactionModel.candidateTriggerElementId) {
    return { ok: false, reason: "missing_trigger", message: "Component analysis does not include a candidate trigger element." };
  }

  if (!hasElement(analysis, analysis.interactionModel.candidateTriggerElementId)) {
    return { ok: false, reason: "missing_trigger", message: "Candidate trigger element ID does not resolve to a JSX element." };
  }

  if (!analysis.interactionModel.candidatePopupElementId) {
    return { ok: false, reason: "missing_popup", message: "Component analysis does not include a candidate popup element." };
  }

  if (!hasElement(analysis, analysis.interactionModel.candidatePopupElementId)) {
    return { ok: false, reason: "missing_popup", message: "Candidate popup element ID does not resolve to a JSX element." };
  }

  if (analysis.interactionModel.candidateOptionElementIds.length === 0) {
    return { ok: false, reason: "missing_options", message: "Component analysis does not include candidate option elements." };
  }

  const missingOptionIds = analysis.interactionModel.candidateOptionElementIds.filter((id) => !hasElement(analysis, id));
  if (missingOptionIds.length > 0) {
    return {
      ok: false,
      reason: "missing_options",
      message: "One or more candidate option element IDs do not resolve to JSX elements.",
      details: { missingOptionIds },
    };
  }

  if (!analysis.interactionModel.controlState) {
    return { ok: false, reason: "missing_control_state", message: "Component analysis does not include a popup control state." };
  }

  const requirements = getRequirementsWithIds(manifest);
  if (requirements.length === 0) {
    return { ok: false, reason: "missing_requirements", message: "Manifest snapshot has no requirements." };
  }

  const expectedCheckIds = new Set([
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
  const missingChecks = [...expectedCheckIds].filter((id) => !requirements.some((requirement) => requirement.id === id));
  if (missingChecks.length > 0) {
    return {
      ok: false,
      reason: "missing_required_checks",
      message: "Manifest snapshot is missing one or more required MVP checks.",
      details: { missingChecks },
    };
  }

  if (!manifest.manualReviewRequired || manifest.manualReviewRequired.length === 0) {
    return { ok: false, reason: "missing_manual_review", message: "Manifest snapshot must include manualReviewRequired." };
  }

  if (!manifest.reportBoundary?.forbidden || manifest.reportBoundary.forbidden.length === 0) {
    return { ok: false, reason: "missing_report_boundary", message: "Manifest snapshot must include reportBoundary.forbidden." };
  }

  if (!manifest.bobPatchConstraints || manifest.bobPatchConstraints.length === 0) {
    return { ok: false, reason: "missing_bob_constraints", message: "Manifest snapshot must include Bob patch constraints." };
  }

  return { ok: true };
}

function buildChecks(manifest: RuleManifest, bindings: ComponentBindings, scope: ComponentScope): LockedSpecCheck[] {
  return getRequirementsWithIds(manifest).map((requirement) => ({
    id: requirement.id,
    category: requirement.category ?? "unknown",
    sourceRequirementId: requirement.id,
    description: specializeDescription(requirement.id, requirement.description ?? ""),
    testable: requirement.testable ?? false,
    maturity: requirement.maturity ?? "unknown",
    testStrategy: requirement.testStrategy ?? "unknown",
    layers: requirement.layers ?? {},
    params: buildCheckParams(requirement.id, bindings, scope, manifest),
  }));
}

function buildCheckParams(
  requirementId: string,
  bindings: ComponentBindings,
  scope: ComponentScope,
  manifest: RuleManifest,
): Record<string, unknown> {
  const triggerElementId = bindings.triggerElementId;
  const popupElementId = bindings.popupElementId;
  const optionElementIds = bindings.optionElementIds;
  const controlState = bindings.controlState;
  const common = {
    triggerElementId,
    popupElementId,
    optionElementIds,
    controlState,
    componentScopeSelector: scope.selector,
  };

  switch (requirementId) {
    case "accessible-name":
      return {
        ...common,
        role: "combobox",
        accessibleNameBinding: bindings.accessibleNameBinding,
      };
    case "combobox-role":
      return {
        ...common,
        expectedRole: "combobox",
        allowedHostElements: ["button"],
      };
    case "expanded-state":
      return {
        ...common,
        attribute: "aria-expanded",
        expectedCollapsedValue: "false",
        expectedExpandedValue: "true",
      };
    case "popup-associated":
      return {
        ...common,
        attribute: "aria-controls",
        expectedPopupRole: "listbox",
      };
    case "popup-listbox":
      return {
        ...common,
        expectedRole: "listbox",
      };
    case "option-roles":
      return {
        ...common,
        expectedRole: "option",
      };
    case "selected-state":
      return {
        ...common,
        attribute: "aria-selected",
        expectedValues: ["true", "false"],
      };
    case "keyboard-arrow-down-opens":
      return {
        ...common,
        key: "ArrowDown",
        expectedPopupRole: "listbox",
        expectedActiveOption: "first-option",
        focusManagementStrategy,
      };
    case "keyboard-enter-selects":
      return {
        ...common,
        key: "Enter",
        expectedAction: "select-active-option",
        focusManagementStrategy,
      };
    case "keyboard-escape-closes":
      return {
        ...common,
        key: "Escape",
        expectedExpandedValue: "false",
      };
    case "axe-scan":
      return {
        ...common,
        scopeSelector: scope.selector,
        axeIntegration: manifest.automation?.axeIntegration ?? "@axe-core/playwright",
        axeTags: getAxeTags(manifest),
        axeRules: getAxeRules(manifest),
      };
    default:
      return common;
  }
}

function buildAccessibilityClaimBoundary(manifestLoadResult: ManifestLoadSuccess): LockedSpecSuccess["accessibilityClaimBoundary"] {
  const forbiddenClaims = manifestLoadResult.reportBoundary.forbiddenClaims.filter(
    (claim) => !phaseFourProcessForbiddenClaims.includes(claim),
  );

  return {
    allowedClaims: manifestLoadResult.reportBoundary.allowedClaims,
    forbiddenClaims,
    manualReviewRequired: true,
  };
}

function buildComponentBindings(analysis: ComponentAnalysis): ComponentBindings {
  const trigger = getElementById(analysis, analysis.interactionModel.candidateTriggerElementId);
  const popup = getElementById(analysis, analysis.interactionModel.candidatePopupElementId);
  const options = analysis.interactionModel.candidateOptionElementIds.map((id) => getElementById(analysis, id));
  const accessibleNameBinding = selectAccessibleNameBinding(analysis.accessibilitySignals.accessibleNameCandidates);

  return {
    triggerElementId: trigger.id,
    popupElementId: popup.id,
    optionElementIds: options.map((option) => option.id),
    controlState: analysis.interactionModel.controlState ?? "",
    accessibleNameBinding,
    existingNameSignals: analysis.accessibilitySignals.accessibleNameCandidates,
    elements: {
      trigger: bindElement(trigger),
      popup: bindElement(popup),
      options: options.map(bindElement),
    },
  };
}

function selectAccessibleNameBinding(candidates: AccessibleNameCandidate[]): AccessibleNameBinding {
  const labelProp = candidates.find((candidate) => candidate.source === "prop-rendered-text" && candidate.prop === "label");
  const labelledBy = candidates.find((candidate) => candidate.source === "aria-labelledby");
  const ariaLabel = candidates.find((candidate) => candidate.source === "aria-label");
  const nearbyLabel = candidates.find((candidate) => candidate.source === "nearby-label");
  const buttonFallback = candidates.find((candidate) => candidate.source === "button-text-fallback");
  const preferred = labelProp ?? labelledBy ?? ariaLabel ?? nearbyLabel ?? buttonFallback;

  return {
    preferredNameSourceForSpec: preferred?.source ?? "missing-accessible-name-candidate",
    confidence: preferred?.confidence ?? "low",
    ...(preferred?.prop ? { prop: preferred.prop } : {}),
    ...(preferred?.text ? { text: preferred.text } : {}),
    ...(preferred?.elementId ? { elementId: preferred.elementId } : {}),
    ...(buttonFallback?.text ? { fallbackText: buttonFallback.text } : {}),
  };
}

function buildManualReviewItems(manifest: RuleManifest): ManualReviewItem[] {
  return (manifest.manualReviewRequired ?? []).map((id) => ({
    id,
    source: "manifest",
    reason: findManualReviewReason(manifest, id),
  }));
}

function findManualReviewReason(manifest: RuleManifest, id: string): string {
  const manualReview = manifest.sources?.manualReview;
  if (Array.isArray(manualReview)) {
    const entry = manualReview.find((item) => isObjectWithString(item, "id") && item.id === id);
    if (entry && isObjectWithString(entry, "description")) {
      return entry.description;
    }
  }

  return "Manual review is required by the selected manifest.";
}

function buildTestHarnessHints(analysis: ComponentAnalysis): TestHarnessHints {
  return {
    needsLabelProp: analysis.props.some((prop) => prop.kind === "label" || prop.name.toLowerCase() === "label"),
    needsOptionsCollection: analysis.props.some((prop) => prop.kind === "collection"),
    needsOnChangeSpy: analysis.props.some((prop) => prop.kind === "callback" && prop.name === "onChange"),
    recommendedOptions: [
      { label: "Apple", value: "apple" },
      { label: "Banana", value: "banana" },
    ],
  };
}

function buildComponentScope(componentName: string): ComponentScope {
  return {
    strategy: "demo-wrapper",
    selector: `[data-specfirst-root="${componentName}"]`,
  };
}

function buildSourceArtifacts(
  paths: {
    componentAnalysis: string;
    classification: string;
    manifestLoadResult: string;
    manifestUsed: string;
  },
  projectRoot: string,
): SourceArtifacts {
  return {
    componentAnalysisPath: relativePath(projectRoot, paths.componentAnalysis),
    classificationPath: relativePath(projectRoot, paths.classification),
    manifestLoadResultPath: relativePath(projectRoot, paths.manifestLoadResult),
    manifestUsedPath: relativePath(projectRoot, paths.manifestUsed),
    hashes: {
      componentAnalysis: hashFile(paths.componentAnalysis),
      classification: hashFile(paths.classification),
      manifestLoadResult: hashFile(paths.manifestLoadResult),
      manifestUsed: hashFile(paths.manifestUsed),
    },
  };
}

function skip(
  outputPath: string,
  writeArtifacts: boolean,
  component: ClassificationArtifact["component"] | undefined,
  reason: string,
  message: string,
  upstream: LockedSpecSkipped["upstream"],
): LockedSpecSkipped {
  const result: LockedSpecSkipped = {
    schemaVersion: "1.0.0",
    status: "skipped",
    ...(component ? { component } : {}),
    reason,
    message,
    upstream,
    nextPhase: { canContinue: false },
  };

  if (writeArtifacts) {
    writeJson(outputPath, result);
  }

  return result;
}

function resolveRunDir(input: string, projectRoot: string): string {
  if (input.endsWith(".json")) {
    return path.dirname(path.resolve(projectRoot, input));
  }

  return path.resolve(projectRoot, "specfirst", "runs", input);
}

function readJsonFile<T>(filePath: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, "utf8")) as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

function getRequirementsWithIds(manifest: RuleManifest): RequirementWithId[] {
  return (manifest.requirements ?? []).filter((requirement): requirement is RequirementWithId => Boolean(requirement.id));
}

function getElementById(analysis: ComponentAnalysis, id: string | undefined): JsxElementRecord {
  const element = analysis.jsxElements.find((candidate) => candidate.id === id);
  if (!element) {
    throw new Error(`Element not found: ${String(id)}`);
  }

  return element;
}

function hasElement(analysis: ComponentAnalysis, id: string): boolean {
  return analysis.jsxElements.some((element) => element.id === id);
}

function bindElement(element: JsxElementRecord): BoundElement {
  return {
    elementId: element.id,
    tag: element.tag,
    snippet: element.snippet,
    sourceLocation: element.sourceLocation,
  };
}

function componentsMatch(
  left: { name: string; path: string },
  right: { name: string; path: string },
): boolean {
  return left.name === right.name && left.path === right.path;
}

function specializeDescription(requirementId: string, description: string): string {
  if (requirementId === "expanded-state") {
    return "The trigger element exposes aria-expanded based on the component popup control state.";
  }

  if (requirementId === "popup-associated") {
    return "The trigger element is programmatically associated with the candidate popup.";
  }

  if (requirementId === "option-roles") {
    return "Mapped candidate option elements expose option semantics.";
  }

  return description;
}

function getAxeRules(manifest: RuleManifest): string[] {
  const automation = manifest.sources?.automation;
  if (!Array.isArray(automation)) {
    return [];
  }

  const axe = automation.find((item) => isObjectWithString(item, "ruleId") && item.ruleId === "axe-scan");
  if (axe && typeof axe === "object" && "axeRules" in axe && Array.isArray(axe.axeRules)) {
    const rules = axe.axeRules as unknown[];
    return rules.filter((rule): rule is string => typeof rule === "string");
  }

  return [];
}

function getAxeTags(manifest: RuleManifest): string[] {
  const automation = manifest.sources?.automation;
  if (!Array.isArray(automation)) {
    return wcagAxeTags;
  }

  const axe = automation.find((item) => isObjectWithString(item, "ruleId") && item.ruleId === "axe-scan");
  if (axe && typeof axe === "object" && "axeTags" in axe && Array.isArray(axe.axeTags)) {
    const tags = axe.axeTags as unknown[];
    return tags.filter((tag): tag is string => typeof tag === "string");
  }

  return wcagAxeTags;
}

function hashFile(filePath: string): string {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function hashCanonical(value: unknown): string {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalize(record[key])]));
  }

  return value;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relativePath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function isObjectWithString(value: unknown, key: string): value is Record<string, string> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record[key] === "string";
}
