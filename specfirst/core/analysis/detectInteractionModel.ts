import type { EventStateLink, InteractionModel, JsxElementRecord, StateHookRecord } from "./types.js";

const POPUP_TAGS = new Set(["ul", "ol", "div", "menu"]);

export function detectInteractionModel(
  jsxElements: JsxElementRecord[],
  stateHooks: StateHookRecord[],
  eventStateLinks: EventStateLink[],
): InteractionModel {
  const controlState = stateHooks.find((state) => state.likelyPurpose === "open-close")?.name;
  const triggerLink = controlState
    ? eventStateLinks.find(
        (link) =>
          !jsxElements.find((element) => element.id === link.elementId)?.insideMap &&
          link.effects.some(
            (effect) =>
              effect.type === "state-set" &&
              effect.state === controlState &&
              (effect.likelyAction === "toggle" || effect.likelyAction === "open-popup" || effect.likelyAction === "set"),
          ),
      )
    : undefined;
  const popup = jsxElements.find(
    (element) => Boolean(element.insideConditional) && POPUP_TAGS.has(element.tag.toLowerCase()),
  );
  const optionIds = popup
    ? jsxElements
        .filter(
          (element) =>
            element.insideMap &&
            (element.parentId === popup.id || isDescendantOf(element, popup.id, jsxElements)) &&
            (element.eventHandlers.length > 0 || element.roleValue === "option"),
        )
        .map((element) => element.id)
    : [];

  return {
    candidateTriggerElementId: triggerLink?.elementId,
    candidatePopupElementId: popup?.id,
    candidateOptionElementIds: optionIds,
    controlState,
  };
}

function isDescendantOf(element: JsxElementRecord, ancestorId: string, allElements: JsxElementRecord[]): boolean {
  let parentId = element.parentId;

  while (parentId) {
    if (parentId === ancestorId) {
      return true;
    }

    parentId = allElements.find((candidate) => candidate.id === parentId)?.parentId;
  }

  return false;
}
