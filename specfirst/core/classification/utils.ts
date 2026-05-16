import type { ComponentAnalysis, JsxElementRecord, PropRecord } from "../analysis/types.js";
import type { ConfidenceLevel } from "./types.js";

export function normalizeScore(score: number, maxScore: number): number {
  if (maxScore <= 0) {
    return 0;
  }

  return roundConfidence(score / maxScore);
}

export function roundConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.85) {
    return "high";
  }

  if (confidence >= 0.65) {
    return "medium";
  }

  if (confidence >= 0.45) {
    return "low";
  }

  return "very-low";
}

export function hasPropKind(analysis: ComponentAnalysis, kind: PropRecord["kind"]): boolean {
  return analysis.props.some((prop) => prop.kind === kind);
}

export function hasSelectionCallback(analysis: ComponentAnalysis): boolean {
  return analysis.props.some(
    (prop) => prop.kind === "callback" && /change|select|choose|pick/i.test(prop.name),
  );
}

export function getElementById(analysis: ComponentAnalysis, id: string | undefined): JsxElementRecord | undefined {
  if (!id) {
    return undefined;
  }

  return analysis.jsxElements.find((element) => element.id === id);
}

export function getDescendantIds(analysis: ComponentAnalysis, rootId: string | undefined): Set<string> {
  const ids = new Set<string>();

  if (!rootId) {
    return ids;
  }

  const visit = (id: string): void => {
    if (ids.has(id)) {
      return;
    }

    ids.add(id);
    const element = getElementById(analysis, id);

    for (const childId of element?.childrenIds ?? []) {
      visit(childId);
    }
  };

  visit(rootId);
  return ids;
}

export function getCandidateSubtreeIds(analysis: ComponentAnalysis): Set<string> {
  const popupIds = getDescendantIds(analysis, analysis.interactionModel.candidatePopupElementId);

  for (const optionId of analysis.interactionModel.candidateOptionElementIds) {
    for (const descendantId of getDescendantIds(analysis, optionId)) {
      popupIds.add(descendantId);
    }
  }

  return popupIds;
}

export function getOptionSubtreeIds(analysis: ComponentAnalysis): Set<string> {
  const ids = new Set<string>();

  for (const optionId of analysis.interactionModel.candidateOptionElementIds) {
    for (const descendantId of getDescendantIds(analysis, optionId)) {
      ids.add(descendantId);
    }
  }

  return ids;
}

export function hasInputElement(analysis: ComponentAnalysis): boolean {
  return analysis.jsxElements.some((element) => element.tag === "input" || element.tag === "textarea");
}

export function hasNativeSelectElement(analysis: ComponentAnalysis): boolean {
  return analysis.nativeElementSignals.hasNativeSelect || analysis.jsxElements.some((element) => element.tag === "select");
}

export function optionSelectionLinks(analysis: ComponentAnalysis) {
  const optionIds = new Set(analysis.interactionModel.candidateOptionElementIds);

  return analysis.eventStateLinks.filter(
    (link) =>
      optionIds.has(link.elementId) &&
      link.effects.some(
        (effect) =>
          effect.type === "callback-call" &&
          /change|select|choose|pick/i.test(effect.callback) &&
          (effect.likelyAction === "select-value" || Boolean(effect.argument)),
      ),
  );
}

export function hasSelectableValueOptions(analysis: ComponentAnalysis): boolean {
  return optionSelectionLinks(analysis).length > 0;
}
