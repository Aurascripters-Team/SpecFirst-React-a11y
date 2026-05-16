import {
  Node,
  SyntaxKind,
  type JsxAttribute,
  type JsxElement,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
} from "ts-morph";

export function uniqueSorted(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

export function isCapitalized(name: string): boolean {
  return /^[A-Z]/.test(name);
}

export function nodeContainsJsx(node: Node): boolean {
  return node
    .getDescendants()
    .some(
      (descendant) =>
        Node.isJsxElement(descendant) ||
        Node.isJsxSelfClosingElement(descendant) ||
        Node.isJsxFragment(descendant),
    );
}

export function getComponentBodyNode(node: Node): Node {
  if (Node.isVariableDeclaration(node)) {
    return node.getInitializer() ?? node;
  }

  return node;
}

export function getJsxTagName(node: JsxElement | JsxSelfClosingElement): string {
  if (Node.isJsxSelfClosingElement(node)) {
    return node.getTagNameNode().getText();
  }

  return node.getOpeningElement().getTagNameNode().getText();
}

export function getJsxOpeningNode(node: JsxElement | JsxSelfClosingElement): JsxOpeningElement | JsxSelfClosingElement {
  return Node.isJsxSelfClosingElement(node) ? node : node.getOpeningElement();
}

export function getAttributeName(attribute: Node): string | undefined {
  if (Node.isJsxAttribute(attribute)) {
    return attribute.getNameNode().getText();
  }

  if (Node.isJsxSpreadAttribute(attribute)) {
    return "{...spread}";
  }

  return undefined;
}

export function getAttributeValue(attribute: JsxAttribute): string | undefined {
  const initializer = attribute.getInitializer();

  if (!initializer) {
    return undefined;
  }

  return initializer.getText().replace(/^["'{]+|["'}]+$/g, "");
}

export function findAncestor(node: Node, predicate: (ancestor: Node) => boolean): Node | undefined {
  let current: Node | undefined = node.getParent();

  while (current) {
    if (predicate(current)) {
      return current;
    }

    current = current.getParent();
  }

  return undefined;
}

export function isInsideMap(node: Node): boolean {
  return Boolean(
    findAncestor(node, (ancestor) => {
      if (!Node.isCallExpression(ancestor)) {
        return false;
      }

      const expression = ancestor.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "map";
    }),
  );
}

export function isInsideConditional(node: Node): boolean {
  return Boolean(
    findAncestor(
      node,
      (ancestor) =>
        Node.isConditionalExpression(ancestor) ||
        Node.isIfStatement(ancestor) ||
        ancestor.getKind() === SyntaxKind.BinaryExpression && ancestor.getText().includes("&&"),
    ),
  );
}

export function getStringLiterals(node: Node): string[] {
  return node
    .getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralText())
    .filter((text) => text.trim().length > 0);
}

export function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/");
}
