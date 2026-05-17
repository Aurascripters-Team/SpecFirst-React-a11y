export type RunBaselineOptions = {
  input: string;
  projectRoot?: string;
  writeArtifacts?: boolean;
  playwrightTimeout?: number;
};

export type BaselineStatus =
  | "red-confirmed"
  | "green-unexpected"
  | "infra-failed"
  | "invalidated"
  | "skipped"
  | "failed";

export type FailedCheck = {
  id: string;
  title: string;
  failureType: "assertion-failed" | "timeout" | "unknown";
  message: string;
};

export type TestSummary = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
};

export type BaselineValidation = {
  testsRan: boolean;
  testFileUnchanged: boolean;
  harnessFileUnchanged: boolean;
  lockedSpecUnchanged: boolean;
  meaningfulFailureCount: number;
  redConfirmed: boolean;
};

export type HashMismatch = {
  artifact: string;
  expected: string;
  actual: string;
};

export type BaselineResult =
  | BaselineRedConfirmed
  | BaselineGreenUnexpected
  | BaselineInfraFailed
  | BaselineInvalidated
  | BaselineSkipped
  | BaselineFailed;

type BaselineBase = {
  schemaVersion: "1.0.0";
  phase: "baseline";
  runId: string;
  lockedSpecPath: string;
  testFilePath: string;
  harnessFilePath: string;
  command: string;
};

export type BaselineRedConfirmed = BaselineBase & {
  status: "red-confirmed";
  lockedSpecHash: string;
  testFileHashBeforeRun: string;
  harnessFileHashBeforeRun: string;
  testSummary: TestSummary;
  passedChecks: string[];
  failedChecks: FailedCheck[];
  baselineValidation: BaselineValidation;
  nextPhase: {
    canContinue: true;
    bobPromptInput: string;
  };
};

export type BaselineGreenUnexpected = BaselineBase & {
  status: "green-unexpected";
  lockedSpecHash: string;
  testFileHashBeforeRun: string;
  harnessFileHashBeforeRun: string;
  testSummary: TestSummary;
  passedChecks: string[];
  failedChecks: FailedCheck[];
  baselineValidation: BaselineValidation;
  nextPhase: {
    canContinue: false;
    reason: string;
  };
};

export type BaselineInfraFailed = BaselineBase & {
  status: "infra-failed";
  reason: string;
  message: string;
  rawOutput?: string;
  nextPhase: { canContinue: false };
};

export type BaselineInvalidated = BaselineBase & {
  status: "invalidated";
  reason: string;
  message: string;
  hashMismatches: HashMismatch[];
  nextPhase: { canContinue: false };
};

export type BaselineSkipped = {
  schemaVersion: "1.0.0";
  phase: "baseline";
  status: "skipped";
  reason: string;
  message: string;
  nextPhase: { canContinue: false };
};

export type BaselineFailed = {
  schemaVersion: "1.0.0";
  phase: "baseline";
  status: "failed";
  reason: string;
  message: string;
  details?: unknown;
  nextPhase: { canContinue: false };
};

export type PlaywrightSpec = {
  title: string;
  ok: boolean;
  tests: PlaywrightTest[];
};

export type PlaywrightTest = {
  status: "expected" | "unexpected" | "skipped" | "flaky";
  results: PlaywrightTestResult[];
};

export type PlaywrightTestResult = {
  status: "passed" | "failed" | "timedOut" | "skipped";
  duration: number;
  error?: { message?: string };
  errors?: Array<{ message?: string }>;
};

export type PlaywrightJsonReport = {
  suites?: PlaywrightSuite[];
  stats?: {
    expected: number;
    unexpected: number;
    skipped: number;
    flaky: number;
  };
  errors?: unknown[];
};

export type PlaywrightSuite = {
  title: string;
  file?: string;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
};
