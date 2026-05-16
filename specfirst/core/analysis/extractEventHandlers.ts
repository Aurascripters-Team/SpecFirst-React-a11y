import { Node } from "ts-morph";
import type {
  EventEffect,
  EventStateLink,
  JsxElementRecord,
  LikelyAction,
  PropRecord,
  StateHookRecord,
  TargetComponent,
} from "./types.js";
import { getAttributeName, getComponentBodyNode, getJsxOpeningNode } from "./utils.js";

export function extractEventHandlers(
  component: TargetComponent,
  jsxElements: JsxElementRecord[],
  stateHooks: StateHookRecord[],
  props: PropRecord[],
): EventStateLink[] {
  const bodyNode = getComponentBodyNode(component.node);
  const jsxNodes = bodyNode
    .getDescendants()
    .filter((node) => Node.isJsxElement(node) || Node.isJsxSelfClosingElement(node))
    .sort((a, b) => a.getStart() - b.getStart());
  const links: EventStateLink[] = [];
  const callbackNames = new Set(props.filter((prop) => prop.kind === "callback").map((prop) => prop.name));

  for (let index = 0; index < jsxNodes.length; index += 1) {
    const jsxNode = jsxNodes[index];
    const elementRecord = jsxElements[index];

    if (!elementRecord) {
      continue;
    }

    const openingNode = getJsxOpeningNode(jsxNode);

    for (const attribute of openingNode.getAttributes()) {
      if (!Node.isJsxAttribute(attribute)) {
        continue;
      }

      const attributeName = getAttributeName(attribute);

      if (!attributeName || !/^on[A-Z]/.test(attributeName)) {
        continue;
      }

      const initializerText = attribute.getInitializer()?.getText() ?? "";
      const effects = extractEffects(attribute, stateHooks, callbackNames);

      if (effects.length === 0) {
        continue;
      }

      const firstStateEffect = effects.find((effect): effect is Extract<EventEffect, { type: "state-set" }> => effect.type === "state-set");
      const firstCallbackEffect = effects.find((effect): effect is Extract<EventEffect, { type: "callback-call" }> => effect.type === "callback-call");

      links.push({
        elementId: elementRecord.id,
        event: attributeName,
        effects,
        callsSetter: firstStateEffect?.callsSetter,
        state: firstStateEffect?.state,
        likelyAction: firstCallbackEffect?.likelyAction ?? firstStateEffect?.likelyAction ?? inferLikelyAction(initializerText),
      });
    }
  }

  return links;
}

function extractEffects(attribute: Node, stateHooks: StateHookRecord[], callbackNames: Set<string>): EventEffect[] {
  const initializer = Node.isJsxAttribute(attribute) ? attribute.getInitializer() : undefined;

  if (!initializer) {
    return [];
  }

  const effects: EventEffect[] = [];

  for (const callExpression of initializer.getDescendants().filter(Node.isCallExpression)) {
    const callName = callExpression.getExpression().getText();
    const matchingState = stateHooks.find((hook) => hook.setter === callName);
    const firstArgument = callExpression.getArguments()[0]?.getText();

    if (matchingState) {
      effects.push({
        type: "state-set",
        callsSetter: matchingState.setter,
        state: matchingState.name,
        value: firstArgument,
        likelyAction: inferStateAction(firstArgument, matchingState),
      });
      continue;
    }

    if (callbackNames.has(callName)) {
      effects.push({
        type: "callback-call",
        callback: callName,
        argument: firstArgument,
        likelyAction: "select-value",
      });
    }
  }

  return effects;
}

function inferStateAction(value: string | undefined, stateHook: StateHookRecord): LikelyAction {
  if (!value) {
    return "set";
  }

  if (value.includes(`!${stateHook.name}`)) {
    return "toggle";
  }

  if (stateHook.likelyPurpose === "open-close" && value === "false") {
    return "close-popup";
  }

  if (stateHook.likelyPurpose === "open-close" && value === "true") {
    return "open-popup";
  }

  return "set";
}

function inferLikelyAction(handlerText: string): LikelyAction {
  if (handlerText.includes("onChange")) {
    return "select";
  }

  return "unknown";
}
