import type { ParsedResults } from "./parsePlaywrightJson.js";

export type BaselineClassification = "red-confirmed" | "green-unexpected" | "infra-failed";

export function classifyBaselineStatus(
  parsed: ParsedResults | null,
  exitCode: number | null,
  rawOutput: string,
): BaselineClassification {
  if (!parsed || !parsed.testsRan) {
    return "infra-failed";
  }

  const likelyInfra = isLikelyInfraFailure(rawOutput, parsed);
  if (likelyInfra) {
    return "infra-failed";
  }

  if (parsed.failedChecks.length > 0) {
    return "red-confirmed";
  }

  return "green-unexpected";
}

function isLikelyInfraFailure(rawOutput: string, parsed: ParsedResults): boolean {
  if (!parsed.testsRan) return true;

  const infraSignals = [
    "Error: connect ECONNREFUSED",
    "net::ERR_CONNECTION_REFUSED",
    "browserType.launch",
    "Executable doesn't exist",
    "playwright install",
    "404",
    "Cannot find module",
    "SyntaxError",
    "Failed to start",
    "ENOENT",
  ];

  const lower = rawOutput.toLowerCase();
  if (
    (lower.includes("error") && parsed.testSummary.total === 0) ||
    lower.includes("econnrefused") ||
    lower.includes("browsertype.launch")
  ) {
    return true;
  }

  for (const signal of infraSignals) {
    if (rawOutput.includes(signal) && parsed.testSummary.total === 0) {
      return true;
    }
  }

  return false;
}
