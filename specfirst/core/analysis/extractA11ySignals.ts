import type { AccessibilitySignals, AccessibleNameCandidate, JsxElementRecord, PropRecord } from "./types.js";
import { uniqueSorted } from "./utils.js";

export function extractA11ySignals(jsxElements: JsxElementRecord[], props: PropRecord[]): AccessibilitySignals {
  const roles = uniqueSorted(jsxElements.map((element) => element.roleValue));
  const ariaAttributes = uniqueSorted(jsxElements.flatMap((element) => element.ariaAttributes));
  const attributes = uniqueSorted(jsxElements.flatMap((element) => element.attributes));
  const accessibleNameCandidates = getAccessibleNameCandidates(jsxElements, props);

  return {
    roles,
    ariaAttributes,
    accessibleNameCandidates,
    hasAccessibleNameCandidate: accessibleNameCandidates.length > 0,
    hasKeyboardHandler: jsxElements.some((element) => element.eventHandlers.some((handler) => handler === "onKeyDown" || handler === "onKeyUp")),
    hasComboboxRole: roles.includes("combobox"),
    hasListboxRole: roles.includes("listbox"),
    hasOptionRole: roles.includes("option"),
    hasAriaExpanded: attributes.includes("aria-expanded"),
    hasAriaControls: attributes.includes("aria-controls"),
    hasAriaSelected: attributes.includes("aria-selected"),
    hasAriaActiveDescendant: attributes.includes("aria-activedescendant"),
  };
}

function getAccessibleNameCandidates(jsxElements: JsxElementRecord[], props: PropRecord[]): AccessibleNameCandidate[] {
  const candidates: AccessibleNameCandidate[] = [];

  for (const element of jsxElements) {
    if (element.attributes.includes("aria-label")) {
      const ariaText = element.literalHints?.find((hint) => hint.source === "attribute")?.value;
      candidates.push({
        source: "aria-label",
        elementId: element.id,
        confidence: "high",
        attribute: "aria-label",
        text: ariaText,
      });
    }

    if (element.attributes.includes("aria-labelledby")) {
      candidates.push({
        source: "aria-labelledby",
        elementId: element.id,
        confidence: "high",
        attribute: "aria-labelledby",
      });
    }

    for (const text of element.textHints ?? []) {
      candidates.push({
        source: element.tag === "button" ? "button-text-fallback" : "visible-text",
        elementId: element.id,
        confidence: "medium",
        text,
      });
    }
  }

  const labelProp = props.find((prop) => prop.kind === "label");
  const labelLikeElement = jsxElements.find((element) => element.tag === "label" || element.tag === "span");

  if (labelProp && labelLikeElement) {
    candidates.push({
      source: "prop-rendered-text",
      prop: labelProp.name,
      elementId: labelLikeElement.id,
      confidence: "medium",
    });
  }

  return dedupeCandidates(candidates);
}

function dedupeCandidates(candidates: AccessibleNameCandidate[]): AccessibleNameCandidate[] {
  const seen = new Set<string>();
  const deduped: AccessibleNameCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.source}:${candidate.elementId}:${candidate.prop ?? ""}:${candidate.text ?? ""}:${candidate.attribute ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}
