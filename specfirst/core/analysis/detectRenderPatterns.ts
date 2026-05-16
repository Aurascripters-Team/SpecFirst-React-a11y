import type { EventStateLink, JsxElementRecord, RenderPatterns, StateHookRecord } from "./types.js";

const POPUP_TAGS = new Set(["ul", "ol", "div", "menu", "listbox"]);

export function detectRenderPatterns(
  jsxElements: JsxElementRecord[],
  stateHooks: StateHookRecord[],
  eventStateLinks: EventStateLink[],
): RenderPatterns {
  const conditionalPopup = jsxElements.some(
    (element) => Boolean(element.insideConditional) && POPUP_TAGS.has(element.tag.toLowerCase()),
  );
  const popupControlledByState = stateHooks.find((state) => state.likelyPurpose === "open-close")?.name;
  const optionsRenderedFromMap = jsxElements.some((element) => Boolean(element.insideMap));
  const triggerControlsPopup = Boolean(
    popupControlledByState &&
      eventStateLinks.some((link) => link.state === popupControlledByState && (link.likelyAction === "toggle" || link.likelyAction === "set")),
  );
  const selectableOptions = jsxElements.some(
    (element) =>
      Boolean(element.insideMap) &&
      (element.eventHandlers.some((handler) => handler === "onClick" || handler === "onSelect" || handler === "onChange") ||
        element.attributes.includes("role")),
  );

  return {
    conditionalPopup,
    popupControlledByState,
    optionsRenderedFromMap,
    triggerControlsPopup,
    selectableOptions,
  };
}
