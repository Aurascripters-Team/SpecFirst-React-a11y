import type { BaselineResult } from "../baseline/types.js";
import type { TestGenerationResult } from "../test-generation/types.js";

export type GenerateBobPromptOptions = {
  input: string;
  projectRoot?: string;
  writeArtifacts?: boolean;
};

export type PatchGuardOptions = {
  input: string;
  projectRoot?: string;
  writeArtifacts?: boolean;
  bobSessionPath?: string;
};

export type BobPatchStatus =
  | "prompt-generated"
  | "patched"
  | "patch-scope-failed"
  | "invalidated"
  | "bob-session-missing"
  | "skipped"
  | "failed";

export type PatchScopeResult = {
  allowedChangedFiles: string[];
  changedFiles: string[];
  forbiddenChangedFiles: string[];
  status: "passed" | "failed";
};

export type ArtifactIntegrityResult = {
  lockedSpecUnchanged: boolean;
  testFileUnchanged: boolean;
  harnessFileUnchanged: boolean;
  lockedSpecHash: string;
  testFileHash: string;
  harnessFileHash: string;
};

export type BobPatchResult =
  | BobPatched
  | BobPromptGenerated
  | BobPatchScopeFailed
  | BobInvalidated
  | BobSessionMissing
  | BobSkipped
  | BobFailed;

type BobBase = {
  schemaVersion: "1.0.0";
  component: { name: string; path: string };
  inputs: {
    lockedSpecPath: string;
    baselineResultPath: string;
    testGenerationResultPath: string;
  };
  bobPromptPath: string;
};

export type BobPromptGenerated = BobBase & {
  status: "prompt-generated";
  message: string;
  nextPhase: { canContinue: false; reason: string };
};

export type BobPatched = BobBase & {
  status: "patched";
  mode: "bob-ide-manual";
  bobSession: {
    required: true;
    sessionExportPath: string | null;
    consumptionSummaryPath: string | null;
  };
  patchScope: PatchScopeResult;
  artifactIntegrity: ArtifactIntegrityResult;
  nextPhase: {
    canContinue: true;
    finalVerificationCommand: string;
  };
};

export type BobPatchScopeFailed = BobBase & {
  status: "patch-scope-failed";
  patchScope: PatchScopeResult;
  artifactIntegrity: ArtifactIntegrityResult;
  nextPhase: { canContinue: false };
};

export type BobInvalidated = BobBase & {
  status: "invalidated";
  reason: string;
  message: string;
  artifactIntegrity: ArtifactIntegrityResult;
  nextPhase: { canContinue: false };
};

export type BobSessionMissing = BobBase & {
  status: "bob-session-missing";
  patchScope: PatchScopeResult;
  artifactIntegrity: ArtifactIntegrityResult;
  nextPhase: {
    canContinue: true;
    warning: string;
    finalVerificationCommand: string;
  };
};

export type BobSkipped = {
  schemaVersion: "1.0.0";
  status: "skipped";
  reason: string;
  message: string;
  nextPhase: { canContinue: false };
};

export type BobFailed = {
  schemaVersion: "1.0.0";
  status: "failed";
  reason: string;
  message: string;
  details?: unknown;
  nextPhase: { canContinue: false };
};

export type GenerateBobPromptResult = {
  promptPath: string;
  promptText: string;
};
