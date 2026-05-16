import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type SourceFile,
  type VariableDeclaration,
} from "ts-morph";
import type { DeclarationKind, ExportType, TargetComponent } from "./types.js";
import { isCapitalized, nodeContainsJsx } from "./utils.js";

type Candidate = {
  name: string;
  node: FunctionDeclaration | ArrowFunction | FunctionExpression | VariableDeclaration;
  declarationKind: DeclarationKind;
  exportType: ExportType;
  score: number;
};

export function findTargetComponent(sourceFile: SourceFile): TargetComponent {
  const candidates = collectCandidates(sourceFile);

  if (candidates.length === 0) {
    throw new Error(`No React component-like function found in ${sourceFile.getFilePath()}`);
  }

  const sorted = candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const selected = sorted[0];
  const limitations: string[] = [];

  if (sorted.length > 1 && sorted[0].score === sorted[1].score) {
    limitations.push(
      `Multiple likely components were found; selected ${selected.name} based on deterministic name ordering.`,
    );
  }

  return {
    name: selected.name,
    node: selected.node,
    sourceFile,
    declarationKind: selected.declarationKind,
    exportType: selected.exportType,
    limitations,
  };
}

function collectCandidates(sourceFile: SourceFile): Candidate[] {
  const candidates: Candidate[] = [];

  for (const functionDeclaration of sourceFile.getFunctions()) {
    const name = functionDeclaration.getName();
    if (!name || !isCapitalized(name) || !nodeContainsJsx(functionDeclaration)) {
      continue;
    }

    const exportType = getFunctionExportType(functionDeclaration);
    candidates.push({
      name,
      node: functionDeclaration,
      declarationKind: "function",
      exportType,
      score: scoreCandidate(exportType),
    });
  }

  for (const variableDeclaration of sourceFile.getVariableDeclarations()) {
    const name = variableDeclaration.getName();
    const initializer = variableDeclaration.getInitializer();

    if (
      !isCapitalized(name) ||
      !initializer ||
      !(Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) ||
      !nodeContainsJsx(initializer)
    ) {
      continue;
    }

    const exportType = getVariableExportType(variableDeclaration);
    candidates.push({
      name,
      node: variableDeclaration,
      declarationKind: Node.isArrowFunction(initializer) ? "arrow-function" : "function",
      exportType,
      score: scoreCandidate(exportType),
    });
  }

  applyDefaultExportAssignments(sourceFile, candidates);

  return candidates;
}

function getFunctionExportType(node: FunctionDeclaration): ExportType {
  if (node.hasModifier(SyntaxKind.DefaultKeyword)) {
    return "default";
  }

  if (node.isExported()) {
    return "named";
  }

  return "unknown";
}

function getVariableExportType(node: VariableDeclaration): ExportType {
  const statement = node.getVariableStatement();

  if (statement?.hasModifier(SyntaxKind.DefaultKeyword)) {
    return "default";
  }

  if (statement?.isExported()) {
    return "named";
  }

  return "unknown";
}

function applyDefaultExportAssignments(sourceFile: SourceFile, candidates: Candidate[]): void {
  for (const exportAssignment of sourceFile.getExportAssignments()) {
    if (exportAssignment.isExportEquals()) {
      continue;
    }

    const expression = exportAssignment.getExpression();
    const defaultName = expression.getText();
    const match = candidates.find((candidate) => candidate.name === defaultName);

    if (match) {
      match.exportType = "default";
      match.score = scoreCandidate("default");
    }
  }
}

function scoreCandidate(exportType: ExportType): number {
  if (exportType === "named") {
    return 300;
  }

  if (exportType === "default") {
    return 200;
  }

  return 100;
}
