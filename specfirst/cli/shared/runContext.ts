import fs from "node:fs";
import path from "node:path";

export type RunContext = {
  runId: string;
  runDir: string;
  componentAnalysisPath: string;
  classificationPath: string;
  manifestLoadResultPath: string;
  manifestUsedPath: string;
  lockedSpecPath: string;
  testGenerationResultPath: string;
  baselineResultPath: string;
  bobPromptPath: string;
  finalVerificationResultPath: string;
  evidenceReportPath: string;
  debugLogPath: string;
};

export function getRunContext(runId: string, projectRoot = process.cwd()): RunContext {
  const runDir = path.resolve(projectRoot, "specfirst", "runs", runId);
  return {
    runId,
    runDir,
    componentAnalysisPath: path.join(runDir, "componentAnalysis.json"),
    classificationPath: path.join(runDir, "classification.json"),
    manifestLoadResultPath: path.join(runDir, "manifestLoadResult.json"),
    manifestUsedPath: path.join(runDir, "manifestUsed.json"),
    lockedSpecPath: path.join(runDir, "lockedSpec.json"),
    testGenerationResultPath: path.join(runDir, "testGenerationResult.json"),
    baselineResultPath: path.join(runDir, "baselineResult.json"),
    bobPromptPath: path.join(runDir, "bobPrompt.md"),
    finalVerificationResultPath: path.join(runDir, "finalVerificationResult.json"),
    evidenceReportPath: path.join(runDir, "evidenceReport.md"),
    debugLogPath: path.join(runDir, "debug.log"),
  };
}

export function assertRunExists(context: RunContext): void {
  if (!fs.existsSync(context.runDir)) {
    throw new Error(
      `Run not found: ${context.runId}\nLooked in: ${context.runDir}`
    );
  }
}
