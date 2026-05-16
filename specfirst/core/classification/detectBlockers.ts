import type { ComponentAnalysis, JsxElementRecord } from "../analysis/types.js";
import type { BlockerRecord, ClassificationContext } from "./types.js";
import {
  hasNativeSelectElement,
  hasSelectableValueOptions,
} from "./utils.js";

const INTERACTIVE_TAGS = new Set(["button", "input", "select", "textarea"]);

export function detectBlockers(context: ClassificationContext): BlockerRecord[] {
  const { analysis } = context;
  const blockers: BlockerRecord[] = [];
  const nativeSelectPresent = hasNativeSelectElement(analysis);

  if (nativeSelectPresent) {
    blockers.push({
      id: "native-select-present",
      type: "native-preferred",
      severity: "hard",
      reason: "Native select element detected. Native select should be reviewed as its own implementation path rather than remediated as a custom combobox.",
      elementIds: analysis.jsxElements.filter((element) => element.tag === "select").map((element) => element.id),
    });
  }

  const textInputs = getTextInputs(analysis);
  const textInputsInPopup = textInputs.filter((element) => context.candidateSubtreeIds.has(element.id));

  if (textInputsInPopup.length > 0) {
    blockers.push({
      id: "text-input-in-popup",
      type: "pattern-mismatch",
      severity: "hard",
      reason: "Text input detected inside candidate popup, suggesting editable/searchable behavior rather than select-only behavior.",
      elementIds: textInputsInPopup.map((element) => element.id),
    });
  }

  const textInputsOutsidePopup = textInputs.filter((element) => !context.candidateSubtreeIds.has(element.id));

  if (textInputsInPopup.length === 0 && textInputsOutsidePopup.length > 0) {
    blockers.push({
      id: "text-input-present",
      type: "pattern-mismatch",
      severity: "hard",
      reason: "Text input detected, suggesting editable combobox or freeform entry rather than select-only behavior.",
      elementIds: textInputsOutsidePopup.map((element) => element.id),
    });
  }

  const checkboxInputs = analysis.jsxElements.filter(
    (element) => context.candidateSubtreeIds.has(element.id) && isCheckboxInput(element),
  );

  if (checkboxInputs.length > 0) {
    blockers.push({
      id: "checkbox-in-option-subtree",
      type: "unsupported-pattern",
      severity: "hard",
      reason: "Checkbox input detected inside candidate option subtree, suggesting multi-select or composite option content.",
      elementIds: checkboxInputs.map((element) => element.id),
    });
  }

  if (!nativeSelectPresent && textInputs.length === 0 && !hasSelectableValueOptions(analysis)) {
    blockers.push({
      id: "no-selectable-options",
      type: "insufficient-evidence",
      severity: "hard",
      reason: "No candidate option was found calling a value-selection callback.",
      elementIds: analysis.interactionModel.candidateOptionElementIds,
    });
  }

  const multiSelectSignals = getMultipleSelectionSignals(analysis);

  if (multiSelectSignals.length > 0) {
    blockers.push({
      id: "multiple-selection-detected",
      type: "unsupported-pattern",
      severity: "hard",
      reason: "Multiple-selection signals were detected, which require a different manifest than select-only combobox.",
      elementIds: multiSelectSignals,
    });
  }

  const navigationElements = analysis.jsxElements.filter(
    (element) => context.candidateSubtreeIds.has(element.id) && hasAnchorOrHref(element),
  );

  if (navigationElements.length > 0) {
    blockers.push({
      id: "navigation-inside-option-subtree",
      type: "pattern-mismatch",
      severity: "hard",
      reason: "Anchor or href detected inside the candidate popup/option subtree, suggesting navigation rather than value selection.",
      elementIds: navigationElements.map((element) => element.id),
    });
  }

  const nestedInteractiveElements = analysis.jsxElements.filter(
    (element) => context.candidateSubtreeIds.has(element.id) && element.insideMap && isNestedInteractiveOptionContent(element, analysis),
  );

  if (nestedInteractiveElements.length > 0) {
    blockers.push({
      id: "nested-interactive-option-content",
      type: "unsafe-remediation",
      severity: "hard",
      reason: "Interactive content was detected inside candidate option elements, making listbox/option remediation unsafe.",
      elementIds: nestedInteractiveElements.map((element) => element.id),
    });
  }

  const actionElements = analysis.eventStateLinks.filter(
    (link) =>
      context.candidateSubtreeIds.has(link.elementId) &&
      link.effects.some((effect) => effect.type === "callback-call" && /delete|remove|archive|action/i.test(effect.callback)),
  );

  if (actionElements.length > 0) {
    blockers.push({
      id: "action-item-detected",
      type: "pattern-mismatch",
      severity: "hard",
      reason: "Action button or action callback detected inside option subtree, suggesting action-menu behavior rather than pure value selection.",
      elementIds: actionElements.map((link) => link.elementId),
    });
  }

  return blockers;
}

function hasAnchorOrHref(element: JsxElementRecord): boolean {
  return element.tag === "a" || element.attributes.includes("href");
}

function isNestedInteractiveOptionContent(element: JsxElementRecord, analysis: ComponentAnalysis): boolean {
  if (element.id === analysis.interactionModel.candidatePopupElementId) {
    return false;
  }

  return INTERACTIVE_TAGS.has(element.tag);
}

function getMultipleSelectionSignals(analysis: ComponentAnalysis): string[] {
  const ids: string[] = [];
  const hasMultiProp = analysis.props.some((prop) => /multi|multiple|selectedValues/i.test(prop.name));
  const hasMultiState = analysis.state.some(
    (state) => /multi|multiple|selectedValues/i.test(state.name) || /\[\]|Array<|value \? \[value\]/.test(state.initialValue ?? ""),
  );
  const checkboxIds = analysis.jsxElements.filter(isCheckboxInput).map((element) => element.id);

  if (hasMultiProp) {
    ids.push("props");
  }

  if (hasMultiState) {
    ids.push(...checkboxIds);
  }

  for (const element of analysis.jsxElements) {
    if (element.attributes.includes("multiple") || element.attributes.includes("aria-multiselectable")) {
      ids.push(element.id);
    }
  }

  return [...new Set(ids)];
}

function getTextInputs(analysis: ComponentAnalysis): JsxElementRecord[] {
  return analysis.jsxElements.filter(
    (element) => (element.tag === "input" && !isCheckboxInput(element)) || element.tag === "textarea",
  );
}

function isCheckboxInput(element: JsxElementRecord): boolean {
  return (
    element.tag === "input" &&
    (element.literalHints?.some((hint) => hint.value === "checkbox") ||
      element.snippet?.includes('type="checkbox"') ||
      element.snippet?.includes("type='checkbox'"))
  );
}
