export type FinalVerificationStatus =
  | "passed"
  | "failed"
  | "invalidated"
  | "patch-scope-failed"
  | "infra-failed"
  | "skipped";

export type FinalTestSummary = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
};

export type CheckComparison = {
  baselineFailed: string[];
  finalFailed: string[];
  resolved: string[];
  newFailures: string[];
};

export type ArtifactVerification = {
  lockedSpecPath: string;
  lockedSpecHash: string;
  lockedSpecUnchanged: boolean;
  testFilePath: string;
  testFileUnchanged: boolean;
  harnessFilePath: string;
  harnessFileUnchanged: boolean;
};

export type BobSessionEvidence = {
  present: boolean;
  sessionExportPath: string | null;
  status: "present" | "incomplete";
};

export type RunFinalVerificationOptions = {
  input: string;
  projectRoot?: string;
  writeArtifacts?: boolean;
  playwrightTimeout?: number;
};

export type FinalVerificationResult =
  | FinalPassed
  | FinalFailed
  | FinalInvalidated
  | FinalInfraFailed
  | FinalSkipped;

type FinalBase = {
  schemaVersion: "1.0.0";
  phase: "final-verification";
  component: { name: string; path: string };
  lockedSpec: { path: string; hash: string; unchanged: boolean };
  generatedArtifacts: ArtifactVerification;
  baseline: { status: string; failedCheckIds: string[] };
  bobPatch: { sessionExportPath: string | null; patchScopePassed: boolean; changedFiles: string[] };
  finalTestSummary: FinalTestSummary;
  checkComparison: CheckComparison;
  manualReviewRequired: string[];
  claimBoundary: { allowedClaims: string[]; forbiddenClaims: string[] };
  bobSessionEvidence: BobSessionEvidence;
};

export type FinalPassed = FinalBase & {
  status: "passed";
  nextPhase: { canContinue: true; evidenceReportInput: string };
};

export type FinalFailed = FinalBase & {
  status: "failed";
  stillFailingChecks: string[];
  nextPhase: { canContinue: true; evidenceReportInput: string };
};

export type FinalInvalidated = {
  schemaVersion: "1.0.0";
  phase: "final-verification";
  status: "invalidated";
  reason: string;
  message: string;
  nextPhase: { canContinue: false };
};

export type FinalInfraFailed = {
  schemaVersion: "1.0.0";
  phase: "final-verification";
  status: "infra-failed";
  reason: string;
  message: string;
  rawOutput?: string;
  nextPhase: { canContinue: false };
};

export type FinalSkipped = {
  schemaVersion: "1.0.0";
  phase: "final-verification";
  status: "skipped";
  reason: string;
  message: string;
  nextPhase: { canContinue: false };
};
