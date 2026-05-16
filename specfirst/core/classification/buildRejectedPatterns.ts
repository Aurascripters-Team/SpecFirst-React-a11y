import type { ComponentAnalysis } from "../analysis/types.js";
import type { BlockerRecord, PatternId, RejectedPattern } from "./types.js";
import { hasInputElement, hasNativeSelectElement, hasSelectableValueOptions } from "./utils.js";

export function buildRejectedPatterns(
  analysis: ComponentAnalysis,
  selectedPattern: PatternId,
  blockers: BlockerRecord[],
): RejectedPattern[] {
  const rejected: RejectedPattern[] = [];

  if (selectedPattern !== "react-select-only-combobox") {
    rejected.push({
      pattern: "react-select-only-combobox",
      reason: blockers.length > 0
        ? "Blocked because the component contains signals that are unsafe for select-only combobox remediation."
        : "The component did not meet the high-confidence evidence threshold for select-only combobox continuation.",
    });
  }

  if (selectedPattern !== "react-editable-combobox") {
    rejected.push({
      pattern: "react-editable-combobox",
      reason: hasInputElement(analysis)
        ? blockers.some((blocker) => blocker.id === "checkbox-in-option-subtree" || blocker.id === "action-item-detected")
          ? "Text input exists, but the popup also contains mixed interactive content, checkboxes, links, or action buttons."
          : "Input/freeform text entry was detected, so this is not the supported select-only combobox subtype."
        : "No input element or freeform text entry was detected.",
    });
  }

  if (selectedPattern !== "react-menu-button") {
    rejected.push({
      pattern: "react-menu-button",
      reason: hasSelectableValueOptions(analysis)
        ? "Items select values through a selection callback rather than trigger arbitrary actions."
        : "Items do not provide enough value-selection evidence to safely classify as select-only; action-menu behavior remains possible.",
    });
  }

  if (selectedPattern !== "react-navigation-menu") {
    rejected.push({
      pattern: "react-navigation-menu",
      reason: blockers.some((blocker) => blocker.id === "navigation-inside-option-subtree")
        ? "Navigation signals exist, but the component also contains non-navigation popup behavior, so it is not a clean navigation menu."
        : "No links, hrefs, or routing targets were detected inside the candidate option subtree.",
    });
  }

  if (selectedPattern !== "native-select") {
    rejected.push({
      pattern: "native-select",
      reason: hasNativeSelectElement(analysis)
        ? "A native select element was detected and routed to manual review."
        : "No native select element was detected, although native select may be preferable.",
    });
  }

  return rejected;
}
