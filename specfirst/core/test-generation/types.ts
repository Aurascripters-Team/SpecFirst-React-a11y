import type { LockedSpecResult } from "../spec/types.js";

export type GenerateTestsOptions = {
  input: string;
  projectRoot?: string;
  writeArtifacts?: boolean;
};

export type TestGenerationResult = TestGenerationGenerated | TestGenerationSkipped | TestGenerationFailed;

export type TestGenerationGenerated = {
  schemaVersion: "1.0.0";
  status: "generated";
  lockedSpecPath: string;
  lockedSpecHash: string;
  testFilePath: string;
  testFileHash: string;
  harnessFilePath: string;
  harnessFileHash: string;
  generatedArtifactHashes: {
    testFile: string;
    harnessFile: string;
    combined: string;
  };
  demoRoute: string;
  generatedCheckIds: string[];
  testCount: number;
  generationPolicy: TestGenerationPolicy;
  nextPhase: {
    canContinue: true;
    baselineTestCommand: string;
    demoRoute: string;
  };
};

export type TestGenerationSkipped = {
  schemaVersion: "1.0.0";
  status: "skipped";
  component?: {
    name: string;
    path: string;
  };
  lockedSpecPath: string;
  reason: string;
  message: string;
  upstream: {
    lockedSpecStatus?: LockedSpecResult["status"];
    lockedSpecCanContinue?: boolean;
  };
  nextPhase: {
    canContinue: false;
  };
};

export type TestGenerationFailed = {
  schemaVersion: "1.0.0";
  status: "failed";
  lockedSpecPath: string;
  reason: string;
  message: string;
  details?: unknown;
  nextPhase: {
    canContinue: false;
  };
};

export type TestGenerationPolicy = {
  mode: "deterministic";
  bobUsed: false;
  testsGenerated: true;
  testsRun: false;
  componentModified: false;
  lockedSpecModified: false;
  uiRendered: false;
  complianceClaimMade: false;
};

export type ScopeBinding = {
  attribute: "data-specfirst-root";
  value: string;
};
