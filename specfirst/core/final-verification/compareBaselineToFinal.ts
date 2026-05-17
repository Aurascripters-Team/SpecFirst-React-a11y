import type { CheckComparison } from "./types.js";

export function compareBaselineToFinal(
  baselineFailedIds: string[],
  finalFailedIds: string[],
): CheckComparison {
  const baselineSet = new Set(baselineFailedIds);
  const finalSet = new Set(finalFailedIds);

  const resolved = baselineFailedIds.filter((id) => !finalSet.has(id));
  const newFailures = finalFailedIds.filter((id) => !baselineSet.has(id));

  return {
    baselineFailed: baselineFailedIds,
    finalFailed: finalFailedIds,
    resolved,
    newFailures,
  };
}
