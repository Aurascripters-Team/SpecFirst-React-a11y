import { Node } from "ts-morph";
import type { StateHookRecord, StatePurpose, TargetComponent } from "./types.js";
import { getComponentBodyNode } from "./utils.js";

export function extractStateHooks(component: TargetComponent): StateHookRecord[] {
  const bodyNode = getComponentBodyNode(component.node);
  const hooks: StateHookRecord[] = [];

  for (const callExpression of bodyNode.getDescendants().filter(Node.isCallExpression)) {
    const expression = callExpression.getExpression();
    const expressionText = expression.getText();

    if (expressionText !== "useState" && !expressionText.endsWith(".useState")) {
      continue;
    }

    const parent = callExpression.getParent();

    if (!Node.isVariableDeclaration(parent)) {
      continue;
    }

    const nameNode = parent.getNameNode();

    if (!Node.isArrayBindingPattern(nameNode)) {
      continue;
    }

    const elements = nameNode.getElements();
    const stateName = elements[0]?.getText();
    const setterName = elements[1]?.getText();

    if (!stateName || !setterName) {
      continue;
    }

    hooks.push({
      name: stateName,
      setter: setterName,
      initialValue: callExpression.getArguments()[0]?.getText(),
      likelyPurpose: inferStatePurpose(stateName),
    });
  }

  return hooks;
}

function inferStatePurpose(name: string): StatePurpose {
  const lowerName = name.toLowerCase();

  if (
    lowerName === "open" ||
    lowerName.includes("isopen") ||
    lowerName.includes("expanded") ||
    lowerName.includes("visible") ||
    lowerName.includes("shown")
  ) {
    return "open-close";
  }

  if (lowerName.includes("activeindex") || lowerName.includes("highlightedindex") || lowerName.includes("focusedindex")) {
    return "active-index";
  }

  if (lowerName.includes("selected") || lowerName === "value") {
    return "selection";
  }

  return "unknown";
}
