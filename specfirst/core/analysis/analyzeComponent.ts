import fs from "node:fs";
import path from "node:path";
import { Project } from "ts-morph";
import { detectRenderPatterns } from "./detectRenderPatterns.js";
import { detectInteractionModel } from "./detectInteractionModel.js";
import { extractA11ySignals } from "./extractA11ySignals.js";
import { extractEventHandlers } from "./extractEventHandlers.js";
import { extractJsxTree } from "./extractJsxTree.js";
import { extractNativeElementSignals } from "./extractNativeElementSignals.js";
import { extractProps } from "./extractProps.js";
import { extractStateHooks } from "./extractStateHooks.js";
import { findTargetComponent } from "./findComponents.js";
import { generateRiskFlags } from "./generateRiskFlags.js";
import type { ComponentAnalysis } from "./types.js";
import { normalizeRelativePath } from "./utils.js";

const BASE_LIMITATIONS = [
  "Imported custom components are not resolved in the MVP.",
  "Screen reader behavior is not inferred from static analysis.",
  "Accessible name candidates are detected, not fully computed.",
];

export function analyzeComponent(targetPath: string, projectRoot = process.cwd()): ComponentAnalysis {
  const absoluteTargetPath = path.resolve(projectRoot, targetPath);
  const tsconfigPath = path.join(projectRoot, "tsconfig.json");
  const project = fs.existsSync(tsconfigPath)
    ? new Project({
        tsConfigFilePath: tsconfigPath,
        skipAddingFilesFromTsConfig: false,
      })
    : new Project({});
  const sourceFile =
    project.getSourceFile(absoluteTargetPath) ??
    project.getSourceFile(normalizeRelativePath(path.relative(projectRoot, absoluteTargetPath))) ??
    project.addSourceFileAtPath(absoluteTargetPath);
  const component = findTargetComponent(sourceFile);
  const props = extractProps(component);
  const state = extractStateHooks(component);
  const jsxElements = extractJsxTree(component);
  const accessibilitySignals = extractA11ySignals(jsxElements, props);
  const eventStateLinks = extractEventHandlers(component, jsxElements, state, props);
  const renderPatterns = detectRenderPatterns(jsxElements, state, eventStateLinks);
  const interactionModel = detectInteractionModel(jsxElements, state, eventStateLinks);
  const nativeElementSignals = extractNativeElementSignals(jsxElements, props, renderPatterns);
  const riskFlags = generateRiskFlags({
    component,
    props,
    state,
    jsxElements,
    accessibilitySignals,
    nativeElementSignals,
    eventStateLinks,
    interactionModel,
    renderPatterns,
  });

  return {
    schemaVersion: "1.1.0",
    component: {
      name: component.name,
      path: normalizeRelativePath(path.relative(projectRoot, absoluteTargetPath)),
      framework: "react",
      language: absoluteTargetPath.endsWith(".tsx") || absoluteTargetPath.endsWith(".ts") ? "typescript" : "javascript",
      declarationKind: component.declarationKind,
      exportType: component.exportType,
    },
    props,
    state,
    jsxElements,
    interactionModel,
    renderPatterns,
    accessibilitySignals,
    nativeElementSignals,
    eventStateLinks,
    riskFlags,
    limitations: [...component.limitations, ...BASE_LIMITATIONS],
  };
}
