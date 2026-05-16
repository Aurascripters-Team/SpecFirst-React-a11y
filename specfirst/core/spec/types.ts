import type {
  AccessibleNameCandidate,
  ComponentAnalysis,
  JsxElementRecord,
  SourceLocation,
} from "../analysis/types.js";
import type { ClassificationArtifact } from "../classification/types.js";
import type {
  ManifestLoadResult,
  ManifestLoadSuccess,
  ManifestRequirement,
  RuleManifest,
} from "../manifest/types.js";

export type FreezeSpecOptions = {
  input: string;
  projectRoot?: string;
  createdAt?: string;
  writeArtifacts?: boolean;
};

export type LockedSpecResult = LockedSpecSuccess | LockedSpecSkipped | LockedSpecFailed;

export type LockedSpecSuccess = {
  schemaVersion: "1.0.0";
  status: "locked";
  sourceArtifacts: SourceArtifacts;
  generationPolicy: GenerationPolicy;
  component: ComponentAnalysis["component"];
  classification: ClassificationArtifact["classification"];
  manifest: {
    id: string;
    version: string | null;
    sourceModel: string;
    path: string;
  };
  spec: {
    id: string;
    createdAt: string;
    createdBeforePatch: true;
  };
  componentBindings: ComponentBindings;
  componentScope: ComponentScope;
  testHarnessHints: TestHarnessHints;
  checks: LockedSpecCheck[];
  validation: {
    requiredMvpChecksPresent: true;
  };
  focusManagementStrategy: FocusManagementStrategy;
  manualReviewRequired: ManualReviewItem[];
  bobPatchConstraints: string[];
  accessibilityClaimBoundary: AccessibilityClaimBoundary;
  phaseStateBoundary: PhaseStateBoundary;
  integrity: {
    hashAlgorithm: "sha256";
    hashFieldPolicy: "integrity.hash set to null before hashing";
    canonicalization: "recursive-key-sort";
    hashIncludesCreatedAt: true;
    hash: string;
  };
  nextPhase: {
    canContinue: true;
    testGenerationInput: "lockedSpec.json";
  };
};

export type LockedSpecSkipped = {
  schemaVersion: "1.0.0";
  status: "skipped";
  component?: ClassificationArtifact["component"];
  reason: string;
  message: string;
  upstream: {
    classificationCanContinue?: boolean;
    manifestCanContinue?: boolean;
    manifestStatus?: ManifestLoadResult["status"];
  };
  nextPhase: {
    canContinue: false;
  };
};

export type LockedSpecFailed = {
  schemaVersion: "1.0.0";
  status: "failed";
  reason: string;
  message: string;
  details?: unknown;
  nextPhase: {
    canContinue: false;
  };
};

export type SourceArtifacts = {
  componentAnalysisPath: string;
  classificationPath: string;
  manifestLoadResultPath: string;
  manifestUsedPath: string;
  hashes: {
    componentAnalysis: string;
    classification: string;
    manifestLoadResult: string;
    manifestUsed: string;
  };
};

export type GenerationPolicy = {
  mode: "deterministic";
  bobUsed: false;
  testsGenerated: false;
  componentModified: false;
  uiRendered: false;
  complianceClaimMade: false;
};

export type ComponentBindings = {
  triggerElementId: string;
  popupElementId: string;
  optionElementIds: string[];
  controlState: string;
  accessibleNameBinding: AccessibleNameBinding;
  existingNameSignals: AccessibleNameCandidate[];
  elements: {
    trigger: BoundElement;
    popup: BoundElement;
    options: BoundElement[];
  };
};

export type AccessibleNameBinding = {
  preferredNameSourceForSpec: string;
  confidence: "low" | "medium" | "high";
  prop?: string;
  text?: string;
  elementId?: string;
  fallbackText?: string;
};

export type BoundElement = {
  elementId: string;
  tag: string;
  snippet: string;
  sourceLocation: SourceLocation;
};

export type ComponentScope = {
  strategy: "demo-wrapper";
  selector: string;
};

export type FocusManagementStrategy = {
  type: "aria-activedescendant";
  domFocusRemainsOn: "trigger";
  activeOptionReferencedBy: "aria-activedescendant";
};

export type TestHarnessHints = {
  needsLabelProp: boolean;
  needsOptionsCollection: boolean;
  needsOnChangeSpy: boolean;
  recommendedOptions: Array<{
    label: string;
    value: string;
  }>;
};

export type LockedSpecCheck = {
  id: string;
  category: string;
  sourceRequirementId: string;
  description: string;
  testable: boolean;
  maturity: string;
  testStrategy: string;
  layers: Record<string, string[]>;
  params: Record<string, unknown>;
};

export type ManualReviewItem = {
  id: string;
  source: "manifest";
  reason: string;
};

export type AccessibilityClaimBoundary = {
  allowedClaims: string[];
  forbiddenClaims: string[];
  manualReviewRequired: true;
};

export type PhaseStateBoundary = {
  phase: 4;
  forbiddenAtThisPhase: string[];
};

export type FreezeSpecInputs = {
  analysis: ComponentAnalysis;
  classification: ClassificationArtifact;
  manifestLoadResult: ManifestLoadSuccess;
  manifest: RuleManifest;
};

export type RequirementWithId = ManifestRequirement & {
  id: string;
};
