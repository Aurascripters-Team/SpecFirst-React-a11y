import type { ComponentAnalysis } from "../analysis/types.js";
import type { BlockerRecord } from "./types.js";

export function buildManualReviewNotes(analysis: ComponentAnalysis, blockers: BlockerRecord[]): string[] {
  const notes: string[] = [];

  if (analysis.nativeElementSignals.couldUseNativeSelect || blockers.some((blocker) => blocker.id === "native-select-present")) {
    notes.push(
      "Component resembles a simple single-select control. A native <select> may be preferable if custom styling or behavior is not required.",
    );
  }

  if (analysis.jsxElements.some((element) => !element.isNativeElement)) {
    notes.push("Imported custom components are not resolved in the MVP; review custom primitive behavior before remediation.");
  }

  if (analysis.accessibilitySignals.hasComboboxRole || analysis.accessibilitySignals.hasListboxRole) {
    notes.push("Existing ARIA signals were detected. Classification uses structure only and does not claim the current ARIA implementation is correct.");
  }

  return [...new Set(notes)];
}
