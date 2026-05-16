import { Node, SyntaxKind, type Node as MorphNode, type ParameterDeclaration } from "ts-morph";
import type { PropKind, PropRecord, TargetComponent } from "./types.js";

export function extractProps(component: TargetComponent): PropRecord[] {
  const callable = getCallableNode(component.node);
  const firstParameter = callable?.getParameters()[0];

  if (!firstParameter) {
    return [];
  }

  const type = firstParameter.getType();
  const properties = type.getProperties();

  if (properties.length > 0) {
    return properties.map((property) => {
      const declaration = property.getDeclarations()[0];
      const propertyType = declaration
        ? property.getTypeAtLocation(declaration).getText(declaration)
        : property.getTypeAtLocation(firstParameter).getText(firstParameter);
      const optional = isOptionalPropertyDeclaration(declaration);

      return {
        name: property.getName(),
        type: cleanTypeText(propertyType),
        required: !optional,
        kind: inferPropKind(property.getName(), propertyType),
      };
    });
  }

  const bindingPattern = firstParameter.getNameNode().asKind(SyntaxKind.ObjectBindingPattern);

  if (bindingPattern) {
    return bindingPattern
      .getElements()
      .map((element) => ({
        name: element.getName(),
        type: "unknown",
        required: undefined,
        kind: inferPropKind(element.getName(), "unknown"),
      }));
  }

  return [];
}

function getCallableNode(node: TargetComponent["node"]): { getParameters(): ParameterDeclaration[] } | undefined {
  if (Node.isVariableDeclaration(node)) {
    const initializer = node.getInitializer();

    if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
      return initializer;
    }

    return undefined;
  }

  return node;
}

function isOptionalPropertyDeclaration(declaration: MorphNode | undefined): boolean {
  if (!declaration) {
    return false;
  }

  if (
    Node.isPropertySignature(declaration) ||
    Node.isPropertyDeclaration(declaration) ||
    Node.isParameterDeclaration(declaration)
  ) {
    return declaration.hasQuestionToken();
  }

  return false;
}

function cleanTypeText(typeText: string): string {
  return typeText.replace(/import\("[^"]+"\)\./g, "");
}

function inferPropKind(name: string, typeText: string): PropKind {
  const lowerName = name.toLowerCase();
  const lowerType = typeText.toLowerCase();

  if (lowerName.includes("classname") || lowerName.includes("style")) {
    return "styling";
  }

  if (lowerName.startsWith("on") || lowerType.includes("=>") || lowerType.includes("function")) {
    return "callback";
  }

  if (
    lowerName.includes("options") ||
    lowerName.includes("items") ||
    lowerName.includes("list") ||
    lowerType.includes("[]") ||
    lowerType.includes("array")
  ) {
    return "collection";
  }

  if (lowerName === "value" || lowerName.includes("selected")) {
    return "value";
  }

  if (lowerType.includes("boolean") || lowerName.startsWith("is") || lowerName === "disabled") {
    return "boolean";
  }

  if (
    lowerName === "label" ||
    lowerName.includes("label") ||
    lowerName.includes("title") ||
    lowerName === "name" ||
    lowerName.endsWith("name")
  ) {
    return "label";
  }

  return "unknown";
}
