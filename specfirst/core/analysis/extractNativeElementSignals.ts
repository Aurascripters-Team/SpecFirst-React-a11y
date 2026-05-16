import type { JsxElementRecord, NativeElementSignals, PropRecord, RenderPatterns } from "./types.js";

export function extractNativeElementSignals(
  jsxElements: JsxElementRecord[],
  props: PropRecord[],
  renderPatterns: RenderPatterns,
): NativeElementSignals {
  const hasNativeSelect = jsxElements.some((element) => element.tag === "select");
  const hasOptionsCollection = props.some((prop) => prop.kind === "collection");
  const hasValueProp = props.some((prop) => prop.kind === "value");
  const hasChangeCallback = props.some((prop) => prop.kind === "callback" && prop.name.toLowerCase().includes("change"));
  const hasTextInput = jsxElements.some((element) => element.tag === "input" || element.tag === "textarea");

  return {
    hasNativeSelect,
    couldUseNativeSelect:
      !hasNativeSelect &&
      !hasTextInput &&
      hasOptionsCollection &&
      hasValueProp &&
      hasChangeCallback &&
      renderPatterns.optionsRenderedFromMap &&
      renderPatterns.selectableOptions,
  };
}
