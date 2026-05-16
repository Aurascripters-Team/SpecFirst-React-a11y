import type { ClassificationArtifact } from "../classification/types.js";

export type ManifestRegistry = {
  _meta?: {
    version?: string;
    description?: string;
  };
  manifests?: Record<string, ManifestRegistryEntry>;
};

export type ManifestRegistryEntry = {
  file: string;
  status: "supported" | "unsupported" | "draft";
  displayName?: string;
  addedVersion?: string;
};

export type RuleManifest = {
  id?: string;
  version?: string;
  sourceModel?: string;
  sources?: Record<string, unknown>;
  requirements?: ManifestRequirement[];
  manualReviewRequired?: string[];
  bobPatchConstraints?: string[];
  reportBoundary?: {
    forbidden?: string[];
    allowedLanguage?: string[];
  };
  applicability?: {
    requires?: string[];
    rejectIf?: string[];
  };
};

export type ManifestRequirement = {
  id?: string;
  maturity?: string;
  testable?: boolean;
  manualReview?: boolean;
};

export type Phase2ClassificationSummary = {
  pattern: string;
  status: ClassificationArtifact["classification"]["status"];
  confidence: number;
  confidenceLevel: ClassificationArtifact["classification"]["confidenceLevel"];
  decisionReason: string;
};

export type ManifestLoadResult = ManifestLoadSuccess | ManifestLoadSkipped | ManifestLoadStopped;

export type ManifestLoadSuccess = {
  schemaVersion: "1.0.0";
  status: "loaded";
  component: ClassificationArtifact["component"];
  classification: Phase2ClassificationSummary;
  manifest: {
    id: string;
    version: string | null;
    path: string;
    status: "loaded";
    sourceModel: string;
  };
  sourceLayers: string[];
  validation: {
    registryEntryFound: true;
    manifestFileFound: true;
    schemaValid: true;
    patternMatchesClassification: true;
    applicabilityValidated: true;
    hasManualReviewBoundary: true;
    hasReportBoundary: true;
  };
  sourceLayerValidation: SourceLayerValidation;
  manifestSummary: ManifestSummary;
  applicability: ApplicabilitySummary;
  reportBoundary: ReportBoundarySummary;
  nextPhase: {
    canContinue: true;
    loadedManifestPath: string;
  };
};

export type ManifestLoadSkipped = {
  schemaVersion: "1.0.0";
  status: "skipped";
  component: ClassificationArtifact["component"];
  classification: Phase2ClassificationSummary;
  reason: string;
  message: string;
  nextPhase: {
    canContinue: false;
  };
};

export type ManifestLoadStopped = {
  schemaVersion: "1.0.0";
  status: "stopped";
  reason: string;
  message: string;
  details?: unknown;
  nextPhase: {
    canContinue: false;
  };
};

export type SourceLayerValidation = {
  valid: boolean;
  requiredLayers: string[];
  presentLayers: string[];
  missingLayers: string[];
  layers: Record<string, boolean>;
};

export type ManifestSummary = {
  requirementIds: string[];
  requirementCount: number;
  automatedRequirementIds: string[];
  automatedRequirementCount: number;
  manualReviewIds: string[];
  manualReviewCount: number;
  bobPatchConstraints: string[];
  bobPatchConstraintCount: number;
  specFirstPolicies: string[];
  specFirstPolicyCount: number;
};

export type ApplicabilitySummary = {
  status: "phase2-gate-passed";
  requires: string[];
  rejectIf: string[];
  rejectIfTriggered: [];
};

export type ReportBoundarySummary = {
  allowedClaims: string[];
  forbiddenClaims: string[];
  manualReviewRequired: true;
};

export type LoadManifestOptions = {
  classificationPath: string;
  projectRoot?: string;
  writeArtifacts?: boolean;
};
