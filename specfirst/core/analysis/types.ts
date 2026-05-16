import type {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  SourceFile,
  VariableDeclaration,
} from "ts-morph";

export type DeclarationKind = "function" | "arrow-function" | "unknown";
export type ExportType = "named" | "default" | "unknown";
export type PropKind =
  | "value"
  | "callback"
  | "collection"
  | "label"
  | "boolean"
  | "styling"
  | "unknown";
export type StatePurpose = "open-close" | "selection" | "active-index" | "unknown";
export type LikelyAction = "toggle" | "set" | "select" | "select-value" | "close-popup" | "open-popup" | "unknown";
export type LiteralHintSource = "text-node" | "attribute" | "className" | "fallback-text" | "unknown";
export type AccessibleNameCandidateSource =
  | "aria-label"
  | "aria-labelledby"
  | "prop-rendered-text"
  | "button-text-fallback"
  | "visible-text"
  | "nearby-label";
export type Confidence = "low" | "medium" | "high";

export type ComponentAnalysis = {
  schemaVersion: "1.1.0";
  component: {
    name: string;
    path: string;
    framework: "react";
    language: "typescript" | "javascript";
    declarationKind: DeclarationKind;
    exportType: ExportType;
  };
  props: PropRecord[];
  state: StateHookRecord[];
  jsxElements: JsxElementRecord[];
  interactionModel: InteractionModel;
  renderPatterns: RenderPatterns;
  accessibilitySignals: AccessibilitySignals;
  nativeElementSignals: NativeElementSignals;
  eventStateLinks: EventStateLink[];
  riskFlags: RiskFlag[];
  limitations: string[];
};

export type PropRecord = {
  name: string;
  type?: string;
  required?: boolean;
  kind?: PropKind;
};

export type StateHookRecord = {
  name: string;
  setter: string;
  initialValue?: string;
  likelyPurpose?: StatePurpose;
};

export type JsxElementRecord = {
  id: string;
  tag: string;
  isNativeElement: boolean;
  parentId?: string;
  childrenIds: string[];
  sourceLocation: SourceLocation;
  snippet: string;
  attributes: string[];
  eventHandlers: string[];
  ariaAttributes: string[];
  roleValue?: string;
  insideMap?: boolean;
  insideConditional?: boolean;
  textHints?: string[];
  classNameHints?: string[];
  literalHints?: LiteralHint[];
};

export type AccessibilitySignals = {
  roles: string[];
  ariaAttributes: string[];
  accessibleNameCandidates: AccessibleNameCandidate[];
  hasAccessibleNameCandidate: boolean;
  hasKeyboardHandler: boolean;
  hasComboboxRole: boolean;
  hasListboxRole: boolean;
  hasOptionRole: boolean;
  hasAriaExpanded: boolean;
  hasAriaControls: boolean;
  hasAriaSelected: boolean;
  hasAriaActiveDescendant: boolean;
};

export type AccessibleNameCandidate = {
  source: AccessibleNameCandidateSource;
  elementId: string;
  confidence: Confidence;
  prop?: string;
  text?: string;
  attribute?: string;
};

export type NativeElementSignals = {
  hasNativeSelect: boolean;
  couldUseNativeSelect: boolean;
};

export type EventStateLink = {
  elementId: string;
  event: string;
  effects: EventEffect[];
  callsSetter?: string;
  state?: string;
  likelyAction?: LikelyAction;
};

export type EventEffect =
  | {
      type: "callback-call";
      callback: string;
      argument?: string;
      likelyAction?: LikelyAction;
    }
  | {
      type: "state-set";
      callsSetter: string;
      state?: string;
      value?: string;
      likelyAction?: LikelyAction;
    };

export type SourceLocation = {
  startLine: number;
  endLine: number;
};

export type LiteralHint = {
  value: string;
  source: LiteralHintSource;
};

export type RenderPatterns = {
  conditionalPopup: boolean;
  popupControlledByState?: string;
  optionsRenderedFromMap: boolean;
  triggerControlsPopup: boolean;
  selectableOptions: boolean;
};

export type InteractionModel = {
  candidateTriggerElementId?: string;
  candidatePopupElementId?: string;
  candidateOptionElementIds: string[];
  controlState?: string;
};

export type RiskFlag = {
  id: string;
  severity: "low" | "medium" | "high";
  message: string;
};

export type ComponentNode =
  | FunctionDeclaration
  | ArrowFunction
  | FunctionExpression
  | VariableDeclaration;

export type TargetComponent = {
  name: string;
  node: ComponentNode;
  sourceFile: SourceFile;
  declarationKind: DeclarationKind;
  exportType: ExportType;
  limitations: string[];
};

export type AnalysisContext = {
  component: TargetComponent;
  props: PropRecord[];
  state: StateHookRecord[];
  jsxElements: JsxElementRecord[];
  accessibilitySignals: AccessibilitySignals;
  nativeElementSignals: NativeElementSignals;
  eventStateLinks: EventStateLink[];
  interactionModel: InteractionModel;
  renderPatterns: RenderPatterns;
};
