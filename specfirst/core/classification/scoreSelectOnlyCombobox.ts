import type { ComponentAnalysis } from "../analysis/types.js";
import type { EvidenceRecord, ScoreResult } from "./types.js";
import {
  hasInputElement,
  hasNativeSelectElement,
  hasPropKind,
  hasSelectableValueOptions,
  hasSelectionCallback,
  normalizeScore,
} from "./utils.js";

const MAX_SCORE = 31;

export function scoreSelectOnlyCombobox(analysis: ComponentAnalysis): ScoreResult {
  const evidence: EvidenceRecord[] = [];

  addEvidence(
    evidence,
    hasPropKind(analysis, "collection"),
    "has-options-collection",
    "data-model",
    3,
    "Component has an options collection prop.",
  );
  addEvidence(
    evidence,
    hasPropKind(analysis, "value"),
    "has-value-prop",
    "data-model",
    2,
    "Component has a selected value prop.",
  );
  addEvidence(
    evidence,
    hasSelectionCallback(analysis) && hasPropKind(analysis, "collection"),
    "has-selection-callback-with-options",
    "data-model",
    2,
    "Component has a selection-style callback in combination with an options collection.",
  );
  addEvidence(
    evidence,
    analysis.state.some((state) => state.likelyPurpose === "open-close"),
    "has-open-close-state",
    "interaction",
    3,
    "Component has open/close state for popup visibility.",
  );
  addEvidence(
    evidence,
    Boolean(analysis.interactionModel.candidateTriggerElementId),
    "has-candidate-trigger",
    "interaction",
    3,
    "Component analysis identified a candidate trigger element.",
    analysis.interactionModel.candidateTriggerElementId ? [analysis.interactionModel.candidateTriggerElementId] : undefined,
  );
  addEvidence(
    evidence,
    Boolean(analysis.interactionModel.candidatePopupElementId),
    "has-candidate-popup",
    "interaction",
    3,
    "Component analysis identified a candidate popup element.",
    analysis.interactionModel.candidatePopupElementId ? [analysis.interactionModel.candidatePopupElementId] : undefined,
  );
  addEvidence(
    evidence,
    analysis.interactionModel.candidateOptionElementIds.length > 0,
    "has-candidate-options",
    "interaction",
    3,
    "Component analysis identified candidate option elements.",
    analysis.interactionModel.candidateOptionElementIds,
  );
  addEvidence(
    evidence,
    analysis.renderPatterns.triggerControlsPopup,
    "trigger-controls-popup",
    "interaction",
    2,
    "Trigger appears to control the popup through component state.",
  );
  addEvidence(
    evidence,
    analysis.renderPatterns.conditionalPopup,
    "has-conditional-popup",
    "render-pattern",
    2,
    "Component conditionally renders a popup-like element.",
  );
  addEvidence(
    evidence,
    analysis.renderPatterns.optionsRenderedFromMap,
    "options-rendered-from-map",
    "render-pattern",
    2,
    "Component renders options from a mapped collection.",
  );
  addEvidence(
    evidence,
    analysis.renderPatterns.selectableOptions && hasSelectableValueOptions(analysis),
    "has-selectable-value-options",
    "render-pattern",
    2,
    "Candidate options call a selection callback with a value.",
    analysis.interactionModel.candidateOptionElementIds,
  );
  addEvidence(
    evidence,
    !hasInputElement(analysis),
    "no-text-input",
    "discriminator",
    2,
    "No input or textarea detected, supporting select-only classification.",
  );
  addEvidence(
    evidence,
    !hasNativeSelectElement(analysis),
    "no-native-select",
    "discriminator",
    2,
    "No native select element detected.",
  );

  const score = evidence.reduce((total, item) => total + item.weight, 0);

  return {
    score,
    maxScore: MAX_SCORE,
    normalized: normalizeScore(score, MAX_SCORE),
    evidence,
  };
}

function addEvidence(
  evidence: EvidenceRecord[],
  condition: boolean,
  id: string,
  category: EvidenceRecord["category"],
  weight: number,
  message: string,
  elementIds?: string[],
): void {
  if (!condition) {
    return;
  }

  evidence.push({
    id,
    category,
    weight,
    message,
    elementIds,
  });
}
