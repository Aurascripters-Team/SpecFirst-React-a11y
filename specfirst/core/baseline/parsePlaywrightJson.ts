import type {
  FailedCheck,
  PlaywrightJsonReport,
  PlaywrightSpec,
  PlaywrightSuite,
  TestSummary,
} from "./types.js";

const checkIdPattern = /\[([a-z0-9-]+)\]$/;

export type ParsedResults = {
  testSummary: TestSummary;
  passedChecks: string[];
  failedChecks: FailedCheck[];
  testsRan: boolean;
};

export function parsePlaywrightJson(jsonText: string): ParsedResults | null {
  let report: PlaywrightJsonReport;
  try {
    report = JSON.parse(jsonText) as PlaywrightJsonReport;
  } catch {
    return null;
  }

  if (!report.suites && !report.stats) {
    return null;
  }

  const allSpecs = collectSpecs(report.suites ?? []);

  if (allSpecs.length === 0) {
    return null;
  }

  const passedChecks: string[] = [];
  const failedChecks: FailedCheck[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const spec of allSpecs) {
    const checkId = extractCheckId(spec.title);
    const specFailed = !spec.ok;
    const firstResult = spec.tests[0]?.results[0];
    const resultStatus = firstResult?.status ?? "failed";

    if (resultStatus === "skipped") {
      skipped++;
      continue;
    }

    if (specFailed || resultStatus === "failed" || resultStatus === "timedOut") {
      failed++;
      failedChecks.push({
        id: checkId ?? spec.title,
        title: spec.title,
        failureType: resultStatus === "timedOut" ? "timeout" : "assertion-failed",
        message: extractErrorMessage(firstResult),
      });
    } else {
      passed++;
      if (checkId) {
        passedChecks.push(checkId);
      }
    }
  }

  return {
    testSummary: { total: passed + failed + skipped, passed, failed, skipped },
    passedChecks,
    failedChecks,
    testsRan: passed + failed > 0,
  };
}

function collectSpecs(suites: PlaywrightSuite[]): PlaywrightSpec[] {
  const specs: PlaywrightSpec[] = [];
  for (const suite of suites) {
    if (suite.specs) {
      specs.push(...suite.specs);
    }
    if (suite.suites) {
      specs.push(...collectSpecs(suite.suites));
    }
  }
  return specs;
}

function extractCheckId(title: string): string | null {
  const match = checkIdPattern.exec(title);
  return match ? match[1] : null;
}

function extractErrorMessage(result: { error?: { message?: string }; errors?: Array<{ message?: string }> } | undefined): string {
  if (!result) return "No result captured.";
  if (result.error?.message) return result.error.message.split("\n")[0] ?? "";
  if (result.errors?.[0]?.message) return result.errors[0].message.split("\n")[0] ?? "";
  return "Test failed without an error message.";
}
