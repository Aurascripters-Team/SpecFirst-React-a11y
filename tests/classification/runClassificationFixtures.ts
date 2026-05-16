import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { classifyComponent } from "../../specfirst/core/classification/classifyComponent.js";
import type { ComponentAnalysis } from "../../specfirst/core/analysis/types.js";

const fixturesDir = path.join(process.cwd(), "tests", "classification", "fixtures");

const selectOnly = classifyFixture("selectOnlyCombobox.analysis.json");
assert.equal(selectOnly.classification.pattern, "react-select-only-combobox");
assert.equal(selectOnly.classification.status, "supported");
assert.equal(selectOnly.classification.confidenceLevel, "high");
assert.ok(selectOnly.classification.confidence >= 0.85);
assert.equal(selectOnly.nextPhase.canContinue, true);
assert.equal(selectOnly.nextPhase.manifestId, "react-select-only-combobox");
assert.ok(selectOnly.candidateScores.some((score) => score.pattern === "react-select-only-combobox" && !score.blocked));
assert.ok(selectOnly.classification.decisionReason.includes("react-select-only-combobox"));
assert.ok(selectOnly.scoreBreakdown.score > 0);
assert.ok(selectOnly.evidence.some((item) => item.id === "has-options-collection"));
assert.ok(selectOnly.evidence.some((item) => item.id === "has-selectable-value-options"));
assert.equal(selectOnly.blockers.length, 0);
assert.ok(selectOnly.rejectedPatterns.some((item) => item.pattern === "react-editable-combobox"));
assert.ok(selectOnly.manualReviewNotes.some((note) => note.includes("native <select>")));

const nativeSelect = classifyFixture("nativeSelect.analysis.json");
assert.equal(nativeSelect.classification.pattern, "native-select");
assert.equal(nativeSelect.classification.status, "manual-review");
assert.equal(nativeSelect.nextPhase.canContinue, false);
assert.ok(nativeSelect.blockers.some((blocker) => blocker.id === "native-select-present" && blocker.type === "native-preferred"));

const editable = classifyFixture("editableCombobox.analysis.json");
assert.equal(editable.classification.pattern, "react-editable-combobox");
assert.equal(editable.classification.status, "unsupported");
assert.equal(editable.nextPhase.canContinue, false);
assert.ok(editable.blockers.some((blocker) => blocker.id === "text-input-present" && blocker.type === "pattern-mismatch"));
assert.ok(
  editable.rejectedPatterns.some(
    (item) => item.pattern === "react-menu-button" || item.pattern === "react-navigation-menu",
  ),
);

const navigation = classifyFixture("navigationMenu.analysis.json");
assert.equal(navigation.classification.pattern, "react-navigation-menu");
assert.equal(navigation.classification.status, "unsupported");
assert.equal(navigation.nextPhase.canContinue, false);
assert.ok(navigation.blockers.some((blocker) => blocker.id === "navigation-inside-option-subtree"));

const actionMenu = classifyFixture("actionMenu.analysis.json");
assert.equal(actionMenu.classification.pattern, "react-menu-button");
assert.equal(actionMenu.classification.status, "unsupported");
assert.equal(actionMenu.nextPhase.canContinue, false);
assert.ok(actionMenu.blockers.some((blocker) => blocker.id === "no-selectable-options"));
assert.ok(!actionMenu.evidence.some((item) => item.id === "has-selectable-value-options"));

const ambiguous = classifyFixture("ambiguousShape.analysis.json");
assert.equal(ambiguous.classification.status, "unsupported");
assert.equal(ambiguous.nextPhase.canContinue, false);
assert.ok(ambiguous.blockers.some((blocker) => blocker.id === "no-selectable-options"));

const partialAria = classifyFixture("partialAriaCombobox.analysis.json");
assert.equal(partialAria.classification.pattern, "react-select-only-combobox");
assert.equal(partialAria.classification.status, "supported");
assert.equal(partialAria.nextPhase.canContinue, true);
assert.ok(partialAria.manualReviewNotes.some((note) => note.includes("Existing ARIA signals")));

const customComponents = classifyFixture("customComponents.analysis.json");
assert.equal(customComponents.classification.pattern, "react-select-only-combobox");
assert.equal(customComponents.classification.status, "ambiguous");
assert.equal(customComponents.nextPhase.canContinue, false);
assert.equal(customComponents.classification.confidenceLevel, "medium");
assert.ok(customComponents.manualReviewNotes.some((note) => note.includes("custom components")));

const mixedInteractive = classifyFixture("mixedInteractivePopup.analysis.json");
assert.equal(mixedInteractive.classification.pattern, "mixed-interactive-popup");
assert.equal(mixedInteractive.classification.status, "unsupported");
assert.equal(mixedInteractive.classification.confidenceLevel, "high");
assert.equal(mixedInteractive.nextPhase.canContinue, false);
assert.ok(mixedInteractive.candidateScores.some((score) => score.pattern === "react-select-only-combobox" && score.blocked));
assert.ok(mixedInteractive.blockers.some((blocker) => blocker.id === "text-input-in-popup"));
assert.ok(mixedInteractive.blockers.some((blocker) => blocker.id === "navigation-inside-option-subtree"));
assert.ok(mixedInteractive.blockers.some((blocker) => blocker.id === "checkbox-in-option-subtree"));
assert.ok(mixedInteractive.blockers.some((blocker) => blocker.id === "multiple-selection-detected"));
assert.ok(mixedInteractive.blockers.some((blocker) => blocker.id === "nested-interactive-option-content"));
assert.ok(mixedInteractive.blockers.some((blocker) => blocker.id === "action-item-detected"));
assert.ok(mixedInteractive.rejectedPatterns.some((pattern) => pattern.pattern === "react-select-only-combobox"));

console.log("Classification fixture tests passed.");

function classifyFixture(fileName: string) {
  const fixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, fileName), "utf8")) as ComponentAnalysis;
  return classifyComponent(fixture);
}
