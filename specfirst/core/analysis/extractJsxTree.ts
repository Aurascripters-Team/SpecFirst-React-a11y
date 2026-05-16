import { Node, type JsxElement, type JsxSelfClosingElement } from "ts-morph";
import type { JsxElementRecord, LiteralHint, TargetComponent } from "./types.js";
import {
  getAttributeName,
  getAttributeValue,
  getComponentBodyNode,
  getJsxOpeningNode,
  getJsxTagName,
  isInsideConditional,
  isInsideMap,
} from "./utils.js";

const EVENT_HANDLER_PATTERN = /^on[A-Z]/;

export function extractJsxTree(component: TargetComponent): JsxElementRecord[] {
  const bodyNode = getComponentBodyNode(component.node);
  const jsxNodes = bodyNode
    .getDescendants()
    .filter((node): node is JsxElement | JsxSelfClosingElement => Node.isJsxElement(node) || Node.isJsxSelfClosingElement(node))
    .sort((a, b) => a.getStart() - b.getStart());
  const idByNode = new Map<JsxElement | JsxSelfClosingElement, string>();

  jsxNodes.forEach((node, index) => {
    idByNode.set(node, `jsx-${index + 1}`);
  });

  const elements: JsxElementRecord[] = jsxNodes.map((node) => {
    const openingNode = getJsxOpeningNode(node);
    const tag = getJsxTagName(node);
    const attributes = openingNode.getAttributes().map(getAttributeName).filter((name): name is string => Boolean(name));
    const eventHandlers = attributes.filter((attribute) => EVENT_HANDLER_PATTERN.test(attribute));
    const ariaAttributes = attributes.filter((attribute) => attribute.startsWith("aria-"));
    const roleAttribute = openingNode
      .getAttributes()
      .filter(Node.isJsxAttribute)
      .find((attribute) => attribute.getNameNode().getText() === "role");
    const directParent = findDirectJsxParent(node);
    const parentId = directParent ? idByNode.get(directParent) : undefined;
    const literalHints = getLiteralHints(node);

    return {
      id: idByNode.get(node) ?? "jsx-unknown",
      tag,
      isNativeElement: /^[a-z]/.test(tag),
      parentId,
      childrenIds: [],
      sourceLocation: getSourceLocation(node),
      snippet: getSnippet(openingNode),
      attributes,
      eventHandlers,
      ariaAttributes,
      roleValue: roleAttribute ? getAttributeValue(roleAttribute) : undefined,
      insideMap: isInsideMap(node),
      insideConditional: isInsideConditional(node),
      textHints: getTextHints(node),
      classNameHints: getClassNameHints(node),
      literalHints,
    };
  });

  const byId = new Map(elements.map((element) => [element.id, element]));

  for (const element of elements) {
    if (element.parentId) {
      byId.get(element.parentId)?.childrenIds.push(element.id);
    }
  }

  return elements;
}

function findDirectJsxParent(node: JsxElement | JsxSelfClosingElement): JsxElement | JsxSelfClosingElement | undefined {
  let current: Node | undefined = node.getParent();

  while (current) {
    if (Node.isJsxElement(current) || Node.isJsxSelfClosingElement(current)) {
      return current;
    }

    current = current.getParent();
  }

  return undefined;
}

function getTextHints(node: JsxElement | JsxSelfClosingElement): string[] {
  return unique(getDirectTextLiteralHints(node).map((hint) => hint.value)).slice(0, 5);
}

function getClassNameHints(node: JsxElement | JsxSelfClosingElement): string[] {
  return unique(
    getJsxOpeningNode(node)
      .getAttributes()
      .filter(Node.isJsxAttribute)
      .filter((attribute) => attribute.getNameNode().getText() === "className")
      .flatMap((attribute) => getStringLiteralValues(attribute)),
  );
}

function getLiteralHints(node: JsxElement | JsxSelfClosingElement): LiteralHint[] {
  const hints: LiteralHint[] = [];

  hints.push(...getDirectTextLiteralHints(node));

  for (const attribute of getJsxOpeningNode(node).getAttributes().filter(Node.isJsxAttribute)) {
    const name = attribute.getNameNode().getText();
    const values = getStringLiteralValues(attribute);

    for (const value of values) {
      hints.push({
        value,
        source: name === "className" ? "className" : "attribute",
      });
    }
  }

  return dedupeLiteralHints(hints);
}

function getDirectTextLiteralHints(node: JsxElement | JsxSelfClosingElement): LiteralHint[] {
  const hints: LiteralHint[] = [];

  if (!Node.isJsxElement(node)) {
    return hints;
  }

  for (const child of node.getJsxChildren()) {
    if (Node.isJsxText(child)) {
      const text = normalizeHint(child.getText());

      if (text) {
        hints.push({ value: text, source: "text-node" });
      }
    }

    if (Node.isJsxExpression(child)) {
      hints.push(...getOwnedStringLiteralValues(child, node).map((value) => ({ value, source: "fallback-text" as const })));
    }
  }

  return dedupeLiteralHints(hints);
}

function getOwnedStringLiteralValues(node: Node, owner: JsxElement | JsxSelfClosingElement): string[] {
  const values: string[] = [];

  for (const literal of node.getDescendants().filter(Node.isStringLiteral)) {
    if (getNearestJsxElement(literal) === owner) {
      values.push(literal.getLiteralText());
    }
  }

  for (const template of node.getDescendants().filter(Node.isNoSubstitutionTemplateLiteral)) {
    if (getNearestJsxElement(template) === owner) {
      values.push(template.getLiteralText());
    }
  }

  return unique(values.map(normalizeHint).filter((value): value is string => Boolean(value)));
}

function getNearestJsxElement(node: Node): JsxElement | JsxSelfClosingElement | undefined {
  let current: Node | undefined = node.getParent();

  while (current) {
    if (Node.isJsxElement(current) || Node.isJsxSelfClosingElement(current)) {
      return current;
    }

    current = current.getParent();
  }

  return undefined;
}

function getStringLiteralValues(node: Node): string[] {
  const values: string[] = [];

  if (Node.isStringLiteral(node)) {
    values.push(node.getLiteralText());
  }

  for (const literal of node.getDescendants().filter(Node.isStringLiteral)) {
    values.push(literal.getLiteralText());
  }

  for (const template of node.getDescendants().filter(Node.isNoSubstitutionTemplateLiteral)) {
    values.push(template.getLiteralText());
  }

  return unique(values.map(normalizeHint).filter((value): value is string => Boolean(value)));
}

function getSourceLocation(node: Node): { startLine: number; endLine: number } {
  const sourceFile = node.getSourceFile();

  return {
    startLine: sourceFile.getLineAndColumnAtPos(node.getStart()).line,
    endLine: sourceFile.getLineAndColumnAtPos(node.getEnd()).line,
  };
}

function getSnippet(node: Node): string {
  const text = node.getText().replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function normalizeHint(value: string): string | undefined {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function dedupeLiteralHints(hints: LiteralHint[]): LiteralHint[] {
  const seen = new Set<string>();
  const deduped: LiteralHint[] = [];

  for (const hint of hints) {
    const key = `${hint.source}:${hint.value}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(hint);
  }

  return deduped;
}
