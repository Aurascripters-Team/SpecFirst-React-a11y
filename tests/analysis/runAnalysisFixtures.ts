import assert from "node:assert/strict";
import path from "node:path";
import { analyzeComponent } from "../../specfirst/core/analysis/analyzeComponent.js";

const root = process.cwd();

const broken = analyzeFixture("NamedFunctionCombobox.tsx");
assert.equal(broken.schemaVersion, "1.1.0");
assert.equal(broken.component.name, "SelectOnlyCombobox");
assert.equal(broken.component.declarationKind, "function");
assert.equal(broken.component.exportType, "named");
assert.ok(broken.props.some((prop) => prop.name === "label" && prop.kind === "label" && prop.required === true));
assert.ok(broken.props.some((prop) => prop.name === "options" && prop.kind === "collection"));
assert.ok(broken.props.some((prop) => prop.name === "onChange" && prop.kind === "callback"));
assert.ok(broken.state.some((state) => state.name === "open" && state.setter === "setOpen" && state.likelyPurpose === "open-close"));
assert.ok(broken.jsxElements.some((element) => element.tag === "button" && element.eventHandlers.includes("onClick")));
assert.ok(broken.jsxElements.some((element) => element.tag === "li" && element.insideMap && element.insideConditional));

const rootDiv = getElementByTag(broken, "div");
const triggerButton = getElementByTag(broken, "button");
const popupList = getElementByTag(broken, "ul");
const optionItem = getElementByTag(broken, "li");

assert.deepEqual(rootDiv.childrenIds, ["jsx-2", "jsx-3", "jsx-4"]);
assert.equal(triggerButton.parentId, rootDiv.id);
assert.equal(popupList.parentId, rootDiv.id);
assert.deepEqual(popupList.childrenIds, [optionItem.id]);
assert.equal(optionItem.parentId, popupList.id);
assert.ok(triggerButton.sourceLocation.startLine > 0);
assert.ok(triggerButton.sourceLocation.endLine >= triggerButton.sourceLocation.startLine);
assert.ok(triggerButton.snippet.includes("<button"));
assert.ok(triggerButton.snippet.length <= 160);
assert.deepEqual(triggerButton.textHints, ["Choose fruit"]);
assert.ok(!rootDiv.textHints?.includes("combo-list"));
assert.ok(!rootDiv.textHints?.includes("combo-option"));
assert.ok(!popupList.textHints?.includes("combo-option"));
assert.deepEqual(popupList.classNameHints, ["combo-list"]);
assert.deepEqual(optionItem.classNameHints, ["combo-option"]);

assert.equal(broken.renderPatterns.conditionalPopup, true);
assert.equal(broken.renderPatterns.optionsRenderedFromMap, true);
assert.equal(broken.renderPatterns.triggerControlsPopup, true);
assert.equal(broken.accessibilitySignals.hasKeyboardHandler, false);
assert.ok(
  broken.accessibilitySignals.accessibleNameCandidates.some(
    (candidate) => candidate.source === "prop-rendered-text" && candidate.prop === "label" && candidate.elementId === "jsx-2",
  ),
);
assert.ok(
  broken.accessibilitySignals.accessibleNameCandidates.some(
    (candidate) => candidate.source === "button-text-fallback" && candidate.text === "Choose fruit" && candidate.elementId === "jsx-3",
  ),
);
assert.equal(broken.interactionModel.candidateTriggerElementId, triggerButton.id);
assert.equal(broken.interactionModel.candidatePopupElementId, popupList.id);
assert.deepEqual(broken.interactionModel.candidateOptionElementIds, [optionItem.id]);
assert.equal(broken.interactionModel.controlState, "open");
assert.equal(broken.nativeElementSignals.hasNativeSelect, false);
assert.equal(broken.nativeElementSignals.couldUseNativeSelect, true);

const optionClick = broken.eventStateLinks.find((link) => link.elementId === optionItem.id && link.event === "onClick");
assert.ok(optionClick);
assert.ok(
  optionClick.effects.some(
    (effect) => effect.type === "callback-call" && effect.callback === "onChange" && effect.argument === "option.value",
  ),
);
assert.ok(
  optionClick.effects.some(
    (effect) =>
      effect.type === "state-set" &&
      effect.callsSetter === "setOpen" &&
      effect.state === "open" &&
      effect.value === "false" &&
      effect.likelyAction === "close-popup",
  ),
);
assert.ok(broken.riskFlags.some((flag) => flag.id === "click-without-keyboard"));
assert.ok(broken.riskFlags.some((flag) => flag.id === "missing-expanded-state"));
assert.ok(broken.riskFlags.some((flag) => flag.id === "custom-select-native-alternative"));

const aria = analyzeFixture("ArrowComponentWithAria.tsx");
assert.equal(aria.component.name, "Picker");
assert.equal(aria.component.declarationKind, "arrow-function");
assert.equal(aria.accessibilitySignals.hasComboboxRole, true);
assert.equal(aria.accessibilitySignals.hasListboxRole, true);
assert.equal(aria.accessibilitySignals.hasOptionRole, true);
assert.equal(aria.accessibilitySignals.hasAriaExpanded, true);
assert.equal(aria.accessibilitySignals.hasAriaControls, true);
assert.equal(aria.accessibilitySignals.hasAriaSelected, true);
assert.equal(aria.accessibilitySignals.hasAriaActiveDescendant, true);
assert.equal(aria.accessibilitySignals.hasKeyboardHandler, true);

const defaultExport = analyzeFixture("DefaultExportComponent.tsx");
assert.equal(defaultExport.component.name, "PrimaryButton");
assert.equal(defaultExport.component.exportType, "default");

const ambiguous = analyzeFixture("AmbiguousComponents.tsx");
assert.ok(ambiguous.limitations.some((limitation) => limitation.includes("Multiple likely components")));

const custom = analyzeFixture("CustomComponentUsage.tsx");
assert.ok(custom.jsxElements.some((element) => element.tag === "Button" && !element.isNativeElement));

console.log("Analysis fixture tests passed.");

function analyzeFixture(fileName: string) {
  return analyzeComponent(path.join("tests", "fixtures", fileName), root);
}

function getElementByTag(analysis: ReturnType<typeof analyzeComponent>, tag: string) {
  const element = analysis.jsxElements.find((candidate) => candidate.tag === tag);
  assert.ok(element, `Expected JSX element with tag ${tag}`);
  return element;
}
