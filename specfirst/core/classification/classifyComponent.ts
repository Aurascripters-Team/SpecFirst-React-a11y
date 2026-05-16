import type { ComponentAnalysis } from "../analysis/types.js";
import { buildManualReviewNotes } from "./buildManualReviewNotes.js";
import { buildRejectedPatterns } from "./buildRejectedPatterns.js";
import { detectBlockers } from "./detectBlockers.js";
import { scoreSelectOnlyCombobox } from "./scoreSelectOnlyCombobox.js";
import type { ClassificationArtifact, ClassificationStatus, PatternId } from "./types.js";
import {
  getCandidateSubtreeIds,
  getConfidenceLevel,
  getOptionSubtreeIds,
  hasInputElement,
  hasNativeSelectElement,
} from "./utils.js";

export function classifyComponent(analysis: ComponentAnalysis): ClassificationArtifact {
  const context = {
    analysis,
    candidateSubtreeIds: getCandidateSubtreeIds(analysis),
    optionSubtreeIds: getOptionSubtreeIds(analysis),
  };
  const score = scoreSelectOnlyCombobox(analysis);
  const blockers = detectBlockers(context);
  const nativeSelectPresent = hasNativeSelectElement(analysis);
  const mixedInteractivePopup = hasMixedInteractivePopup(blockers);
  const customComponentAmbiguity = hasUnresolvedCustomComponentAmbiguity(analysis);
  const rawConfidence = nativeSelectPresent
    ? 0.95
    : mixedInteractivePopup
      ? 0.95
      : customComponentAmbiguity
        ? Math.min(score.normalized, 0.84)
        : score.normalized;
  const confidence = Math.min(rawConfidence, 0.97);
  const confidenceLevel = getConfidenceLevel(confidence);
  const pattern = selectPattern(analysis, nativeSelectPresent, blockers, score.normalized);
  const status = selectStatus(analysis, pattern, nativeSelectPresent, blockers.length > 0, score.normalized);
  const manualReviewNotes = buildManualReviewNotes(analysis, blockers);
  const rejectedPatterns = buildRejectedPatterns(analysis, pattern, blockers);

  return {
    schemaVersion: "1.0.0",
    component: {
      name: analysis.component.name,
      path: analysis.component.path,
    },
    classification: {
      pattern,
      status,
      confidence,
      confidenceLevel,
      decisionReason: buildDecisionReason(pattern, status, analysis, blockers.length > 0),
    },
    scoreBreakdown: {
      score:
        nativeSelectPresent || customComponentAmbiguity || mixedInteractivePopup
          ? Math.round(confidence * score.maxScore * 100) / 100
          : score.score,
      maxScore: score.maxScore,
      normalized: confidence,
    },
    candidateScores: [
      {
        pattern: "react-select-only-combobox",
        score: score.score,
        maxScore: score.maxScore,
        normalized: score.normalized,
        blocked: blockers.length > 0,
      },
    ],
    evidence: nativeSelectPresent
      ? [
          {
            id: "native-select-present",
            category: "discriminator",
            weight: score.maxScore,
            message: "Native select element detected; route to manual review instead of custom combobox remediation.",
            elementIds: analysis.jsxElements.filter((element) => element.tag === "select").map((element) => element.id),
          },
        ]
      : score.evidence,
    blockers,
    rejectedPatterns,
    manualReviewNotes,
    nextPhase: {
      canContinue: status === "supported" && pattern === "react-select-only-combobox",
      manifestId: status === "supported" && pattern === "react-select-only-combobox" ? "react-select-only-combobox" : undefined,
    },
  };
}

function selectPattern(
  analysis: ComponentAnalysis,
  nativeSelectPresent: boolean,
  blockers: Array<{ id: string }>,
  confidence: number,
): PatternId {
  if (nativeSelectPresent) {
    return "native-select";
  }

  if (hasMixedInteractivePopup(blockers)) {
    return "mixed-interactive-popup";
  }

  if (hasInputElement(analysis)) {
    return "react-editable-combobox";
  }

  if (blockers.some((blocker) => blocker.id === "navigation-inside-option-subtree")) {
    return "react-navigation-menu";
  }

  if (blockers.some((blocker) => blocker.id === "no-selectable-options") && analysis.renderPatterns.optionsRenderedFromMap) {
    return "react-menu-button";
  }

  if (confidence >= 0.65) {
    return "react-select-only-combobox";
  }

  return "unknown";
}

function selectStatus(
  analysis: ComponentAnalysis,
  pattern: PatternId,
  nativeSelectPresent: boolean,
  hasBlockers: boolean,
  confidence: number,
): ClassificationStatus {
  if (nativeSelectPresent || pattern === "native-select") {
    return "manual-review";
  }

  if (hasBlockers) {
    return "unsupported";
  }

  if (hasUnresolvedCustomComponentAmbiguity(analysis)) {
    return confidence >= 0.65 ? "ambiguous" : "unsupported";
  }

  if (confidence >= 0.85) {
    return "supported";
  }

  if (confidence >= 0.65) {
    return "ambiguous";
  }

  return "unsupported";
}

function hasUnresolvedCustomComponentAmbiguity(analysis: ComponentAnalysis): boolean {
  const hasCustomLimitation = analysis.limitations.some((limitation) => limitation.includes("custom components"));
  const hasCompleteInteractionModel = Boolean(
    analysis.interactionModel.candidateTriggerElementId &&
      analysis.interactionModel.candidatePopupElementId &&
      analysis.interactionModel.candidateOptionElementIds.length > 0 &&
      analysis.renderPatterns.conditionalPopup,
  );

  return hasCustomLimitation && !hasCompleteInteractionModel;
}

function buildDecisionReason(
  pattern: PatternId,
  status: ClassificationStatus,
  analysis: ComponentAnalysis,
  hasBlockers: boolean,
): string {
  if (pattern === "native-select") {
    return "Native select element detected; route to manual review instead of custom combobox remediation.";
  }

  if (pattern === "mixed-interactive-popup") {
    return "Classified as mixed-interactive-popup because the candidate popup contains mixed interactive content such as search input, links, checkbox-based selection, or action buttons. This is not safe to remediate as a select-only combobox.";
  }

  if (hasBlockers) {
    return `Classified as ${pattern} with status ${status} because hard blockers prevent safe select-only combobox continuation.`;
  }

  if (status === "supported") {
    return "Classified as react-select-only-combobox because the component has a controlled value, options collection, selection callback, trigger-controlled popup, mapped selectable options, and no text input.";
  }

  if (status === "ambiguous") {
    return "Possible select-only combobox evidence was found, but confidence is below the high-confidence threshold required for automatic continuation.";
  }

  return analysis.renderPatterns.optionsRenderedFromMap
    ? "Mapped options were detected, but the evidence is insufficient for safe select-only combobox continuation."
    : "Insufficient evidence was found to classify this component as a supported MVP pattern.";
}

function hasMixedInteractivePopup(blockers: Array<{ id: string }>): boolean {
  const mixedBlockers = new Set([
    "text-input-in-popup",
    "navigation-inside-option-subtree",
    "checkbox-in-option-subtree",
    "multiple-selection-detected",
    "nested-interactive-option-content",
    "action-item-detected",
  ]);
  const matches = blockers.filter((blocker) => mixedBlockers.has(blocker.id));

  return matches.length >= 2;
}
