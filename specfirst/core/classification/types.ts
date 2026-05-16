import type { ComponentAnalysis } from "../analysis/types.js";

export type PatternId =
  | "react-select-only-combobox"
  | "react-editable-combobox"
  | "react-menu-button"
  | "react-navigation-menu"
  | "mixed-interactive-popup"
  | "native-select"
  | "unknown";

export type ClassificationStatus = "supported" | "ambiguous" | "unsupported" | "manual-review";
export type ConfidenceLevel = "high" | "medium" | "low" | "very-low";
export type EvidenceCategory = "data-model" | "interaction" | "render-pattern" | "discriminator";
export type BlockerType =
  | "pattern-mismatch"
  | "unsupported-pattern"
  | "unsafe-remediation"
  | "insufficient-evidence"
  | "native-preferred";

export type ClassificationArtifact = {
  schemaVersion: "1.0.0";
  component: {
    name: string;
    path: string;
  };
  classification: {
    pattern: PatternId;
    status: ClassificationStatus;
    confidence: number;
    confidenceLevel: ConfidenceLevel;
    decisionReason: string;
  };
  scoreBreakdown: {
    score: number;
    maxScore: number;
    normalized: number;
  };
  candidateScores: CandidateScore[];
  evidence: EvidenceRecord[];
  blockers: BlockerRecord[];
  rejectedPatterns: RejectedPattern[];
  manualReviewNotes: string[];
  nextPhase: {
    canContinue: boolean;
    manifestId?: "react-select-only-combobox";
  };
};

export type CandidateScore = {
  pattern: PatternId;
  score: number;
  maxScore: number;
  normalized: number;
  blocked: boolean;
};

export type EvidenceRecord = {
  id: string;
  category: EvidenceCategory;
  weight: number;
  message: string;
  elementIds?: string[];
};

export type BlockerRecord = {
  id: string;
  type: BlockerType;
  severity: "hard";
  reason: string;
  elementIds?: string[];
};

export type RejectedPattern = {
  pattern: Exclude<PatternId, "unknown">;
  reason: string;
};

export type ScoreResult = {
  score: number;
  maxScore: number;
  normalized: number;
  evidence: EvidenceRecord[];
};

export type ClassificationContext = {
  analysis: ComponentAnalysis;
  candidateSubtreeIds: Set<string>;
  optionSubtreeIds: Set<string>;
};
