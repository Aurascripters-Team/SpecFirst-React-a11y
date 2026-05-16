import type { AnalysisContext, RiskFlag } from "./types.js";

export function generateRiskFlags(context: AnalysisContext): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const triggerElements = context.jsxElements.filter((element) => element.eventHandlers.includes("onClick"));
  const hasKeyboardHandler = context.accessibilitySignals.hasKeyboardHandler;
  const hasCustomInteractiveComponent = context.jsxElements.some(
    (element) => !element.isNativeElement && element.eventHandlers.length > 0,
  );

  if (triggerElements.length > 0 && !hasKeyboardHandler) {
    flags.push({
      id: "click-without-keyboard",
      severity: "high",
      message: "Click behavior exists but no keyboard handler was detected.",
    });
  }

  if (context.renderPatterns.conditionalPopup && !context.accessibilitySignals.hasAriaExpanded) {
    flags.push({
      id: "missing-expanded-state",
      severity: "medium",
      message: "Conditional popup visibility exists but no aria-expanded attribute was detected.",
    });
  }

  if (context.renderPatterns.triggerControlsPopup && !context.accessibilitySignals.hasAriaControls) {
    flags.push({
      id: "missing-popup-association",
      severity: "medium",
      message: "A trigger appears to control a popup, but no aria-controls relationship was detected.",
    });
  }

  if (context.renderPatterns.optionsRenderedFromMap && !context.accessibilitySignals.hasOptionRole) {
    flags.push({
      id: "missing-option-semantics",
      severity: "medium",
      message: "Mapped selectable items were detected without role=\"option\" semantics.",
    });
  }

  if (context.renderPatterns.selectableOptions && !context.accessibilitySignals.hasAriaSelected) {
    flags.push({
      id: "missing-selected-state",
      severity: "medium",
      message: "Selectable options were detected without aria-selected state.",
    });
  }

  if (hasCustomInteractiveComponent) {
    flags.push({
      id: "custom-component-unresolved",
      severity: "low",
      message: "Interactive custom components are recorded but not resolved across files in the MVP.",
    });
  }

  if (context.nativeElementSignals.couldUseNativeSelect) {
    flags.push({
      id: "custom-select-native-alternative",
      severity: "low",
      message:
        "Component resembles a simple single-select control. A native <select> may be preferable if custom styling or behavior is not required.",
    });
  }

  return flags;
}
