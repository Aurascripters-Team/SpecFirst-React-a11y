import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { LockedSpecCheck, LockedSpecResult, LockedSpecSuccess } from "../spec/types.js";
import type {
  GenerateTestsOptions,
  ScopeBinding,
  TestGenerationFailed,
  TestGenerationGenerated,
  TestGenerationPolicy,
  TestGenerationResult,
  TestGenerationSkipped,
} from "./types.js";

const supportedPattern = "react-select-only-combobox";
const supportedStrategies = new Set([
  "role-name-query",
  "role-query",
  "attribute-toggle",
  "attribute-check",
  "keyboard-open",
  "keyboard-select",
  "keyboard-close",
  "axe-scan",
]);

const generationPolicy: TestGenerationPolicy = {
  mode: "deterministic",
  bobUsed: false,
  testsGenerated: true,
  testsRun: false,
  componentModified: false,
  lockedSpecModified: false,
  uiRendered: false,
  complianceClaimMade: false,
};

export function generateTests(options: GenerateTestsOptions): TestGenerationResult {
  const projectRoot = options.projectRoot ?? process.cwd();
  const lockedSpecPath = resolveLockedSpecPath(options.input, projectRoot);
  const runDir = path.dirname(lockedSpecPath);
  const resultPath = path.join(runDir, "testGenerationResult.json");
  const writeArtifacts = options.writeArtifacts ?? true;
  const relativeLockedSpecPath = relativePath(projectRoot, lockedSpecPath);

  const fail = (reason: string, message: string, details?: unknown): TestGenerationFailed => {
    const result: TestGenerationFailed = {
      schemaVersion: "1.0.0",
      status: "failed",
      lockedSpecPath: relativeLockedSpecPath,
      reason,
      message,
      ...(details === undefined ? {} : { details }),
      nextPhase: { canContinue: false },
    };
    if (writeArtifacts) {
      writeJson(resultPath, result);
    }
    return result;
  };

  const lockedSpecRead = readJsonFile<LockedSpecResult>(lockedSpecPath);
  if (!lockedSpecRead.ok) {
    return fail("locked_spec_unavailable", "lockedSpec.json is missing or malformed.", lockedSpecRead.error);
  }

  const lockedSpec = lockedSpecRead.value;
  if (lockedSpec.schemaVersion !== "1.0.0") {
    return fail("unsupported_locked_spec_schema", `Unsupported lockedSpec schemaVersion: ${String(lockedSpec.schemaVersion)}.`);
  }

  if (lockedSpec.status === "skipped") {
    return skip(resultPath, writeArtifacts, relativeLockedSpecPath, lockedSpec.component, "locked_spec_skipped", lockedSpec.reason, {
      lockedSpecStatus: lockedSpec.status,
      lockedSpecCanContinue: false,
    });
  }

  if (lockedSpec.status !== "locked") {
    return fail("locked_spec_not_locked", "Phase 5 can only generate tests from a locked spec.", {
      lockedSpecStatus: lockedSpec.status,
    });
  }

  const validation = validateLockedSpec(lockedSpec, lockedSpecPath, projectRoot);
  if (!validation.ok) {
    return fail(validation.reason, validation.message, validation.details);
  }

  const scope = parseScopeSelector(lockedSpec.componentScope.selector, lockedSpec.component.name);
  if (!scope.ok) {
    return fail(scope.reason, scope.message, scope.details);
  }

  const paths = buildOutputPaths(projectRoot, lockedSpec.component.name);
  const importPath = resolveHarnessImportPath(projectRoot, paths.harnessFile, lockedSpec.component.path);
  if (!importPath.ok) {
    return fail(importPath.reason, importPath.message, importPath.details);
  }

  const demoRoute = `/specfirst/generated/${lockedSpec.component.name}`;
  const generatedCheckIds = lockedSpec.checks.filter((check) => check.testable).map((check) => check.id);
  const harnessText = buildHarnessFile(lockedSpec, scope.value, importPath.value, demoRoute);
  const testText = buildTestFile(lockedSpec, relativeLockedSpecPath, paths.relativeTestFile, demoRoute);

  try {
    if (writeArtifacts) {
      writeText(paths.harnessFile, harnessText);
      writeText(paths.testFile, testText);
    }
  } catch (error) {
    return fail("artifact_write_failed", "Failed to write generated test or harness file.", stringifyError(error));
  }

  const testFileHash = hashText(testText);
  const harnessFileHash = hashText(harnessText);
  const result: TestGenerationGenerated = {
    schemaVersion: "1.0.0",
    status: "generated",
    lockedSpecPath: relativeLockedSpecPath,
    lockedSpecHash: hashFile(lockedSpecPath),
    testFilePath: paths.relativeTestFile,
    testFileHash,
    harnessFilePath: paths.relativeHarnessFile,
    harnessFileHash,
    generatedArtifactHashes: {
      testFile: testFileHash,
      harnessFile: harnessFileHash,
      combined: hashText(`${testFileHash}\n${harnessFileHash}`),
    },
    demoRoute,
    generatedCheckIds,
    testCount: generatedCheckIds.length,
    generationPolicy,
    nextPhase: {
      canContinue: true,
      baselineTestCommand: `npx playwright test ${paths.relativeTestFile}`,
      demoRoute,
    },
  };

  if (writeArtifacts) {
    writeJson(resultPath, result);
  }

  return result;
}

function validateLockedSpec(
  lockedSpec: LockedSpecSuccess,
  lockedSpecPath: string,
  projectRoot: string,
): { ok: true } | { ok: false; reason: string; message: string; details?: unknown } {
  if (!lockedSpec.nextPhase.canContinue) {
    return {
      ok: false,
      reason: "locked_spec_blocked",
      message: "Locked spec does not allow continuation to test generation.",
    };
  }

  if (lockedSpec.classification.pattern !== supportedPattern) {
    return {
      ok: false,
      reason: "unsupported_pattern",
      message: `Phase 5 MVP only supports ${supportedPattern}.`,
      details: { pattern: lockedSpec.classification.pattern },
    };
  }

  if (!lockedSpec.integrity?.hash) {
    return { ok: false, reason: "missing_locked_spec_hash", message: "Locked spec integrity.hash is required." };
  }

  if (
    lockedSpec.integrity.hashAlgorithm !== "sha256" ||
    lockedSpec.integrity.hashFieldPolicy !== "integrity.hash set to null before hashing" ||
    lockedSpec.integrity.canonicalization !== "recursive-key-sort"
  ) {
    return {
      ok: false,
      reason: "unsupported_hash_policy",
      message: "Locked spec hash policy is not supported by Phase 5.",
      details: { integrity: lockedSpec.integrity },
    };
  }

  const recomputedHash = hashLockedSpec(lockedSpec);
  if (recomputedHash !== lockedSpec.integrity.hash) {
    return {
      ok: false,
      reason: "locked_spec_hash_mismatch",
      message: "Locked spec integrity.hash does not match the current lockedSpec.json content.",
      details: { expected: lockedSpec.integrity.hash, actual: recomputedHash },
    };
  }

  if (!Array.isArray(lockedSpec.checks) || lockedSpec.checks.length === 0) {
    return { ok: false, reason: "missing_checks", message: "Locked spec must include at least one check." };
  }

  const testableChecks = lockedSpec.checks.filter((check) => check.testable);
  if (testableChecks.length === 0) {
    return { ok: false, reason: "missing_testable_checks", message: "Locked spec has no testable checks." };
  }

  const unsupportedStrategies = testableChecks
    .filter((check) => !supportedStrategies.has(check.testStrategy))
    .map((check) => ({ id: check.id, testStrategy: check.testStrategy }));
  if (unsupportedStrategies.length > 0) {
    return {
      ok: false,
      reason: "unsupported_test_strategy",
      message: "Locked spec contains one or more unsupported test strategies.",
      details: { unsupportedStrategies },
    };
  }

  if (!lockedSpec.componentScope?.selector) {
    return { ok: false, reason: "missing_component_scope", message: "Locked spec componentScope.selector is required." };
  }

  if (!lockedSpec.testHarnessHints?.needsLabelProp || !lockedSpec.testHarnessHints?.needsOptionsCollection || !lockedSpec.testHarnessHints?.needsOnChangeSpy) {
    return {
      ok: false,
      reason: "insufficient_harness_hints",
      message: "Phase 5 MVP requires label, options collection, and onChange harness hints.",
      details: { testHarnessHints: lockedSpec.testHarnessHints },
    };
  }

  if (!Array.isArray(lockedSpec.testHarnessHints.recommendedOptions) || lockedSpec.testHarnessHints.recommendedOptions.length < 2) {
    return {
      ok: false,
      reason: "insufficient_harness_options",
      message: "Phase 5 MVP requires at least two recommended options for generated tests.",
    };
  }

  const componentPath = path.resolve(projectRoot, lockedSpec.component.path);
  if (!fs.existsSync(componentPath)) {
    return {
      ok: false,
      reason: "component_source_unavailable",
      message: "Locked spec component path does not resolve to a source file.",
      details: { componentPath: relativePath(projectRoot, componentPath), lockedSpecPath: relativePath(projectRoot, lockedSpecPath) },
    };
  }

  return { ok: true };
}

function buildHarnessFile(lockedSpec: LockedSpecSuccess, scope: ScopeBinding, importPath: string, demoRoute: string): string {
  const componentName = lockedSpec.component.name;
  const importLine = lockedSpec.component.exportType === "default"
    ? `import ${componentName} from "${importPath}";`
    : `import { ${componentName} } from "${importPath}";`;
  const options = lockedSpec.testHarnessHints.recommendedOptions;
  const labelText = getLabelText(lockedSpec);

  return `// AUTO-GENERATED BY SPECFIRST
// Harness for ${componentName}.
// Bob must not edit this file.

import { useState } from "react";
${importLine}

export const routePath = ${JSON.stringify(demoRoute)};

const options = ${JSON.stringify(options, null, 2)};

export default function ${componentName}Harness() {
  const [value, setValue] = useState<string | undefined>(undefined);

  return (
    <div ${scope.attribute}=${JSON.stringify(scope.value)}>
      <${componentName}
        label=${JSON.stringify(labelText)}
        options={options}
        value={value}
        onChange={setValue}
      />
      <output aria-label="SpecFirst selected value">{value ?? ""}</output>
    </div>
  );
}
`;
}

function buildTestFile(lockedSpec: LockedSpecSuccess, lockedSpecPath: string, testFilePath: string, demoRoute: string): string {
  const checkBlocks = lockedSpec.checks.filter((check) => check.testable).map((check) => buildCheckTest(check, lockedSpec)).join("\n\n");
  const labelText = getLabelText(lockedSpec);
  const options = lockedSpec.testHarnessHints.recommendedOptions;
  const axeCheck = lockedSpec.checks.find((check) => check.id === "axe-scan");
  const axeTags = readStringArrayParam(axeCheck, "axeTags");

  return `// AUTO-GENERATED BY SPECFIRST
// Source locked spec: ${lockedSpecPath}
// Locked spec hash: ${lockedSpec.integrity.hash}
// Bob must not edit this file.

import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const demoRoute = ${JSON.stringify(demoRoute)};
const scopeSelector = ${JSON.stringify(lockedSpec.componentScope.selector)};
const comboboxName = ${regexLiteral(labelText)};
const optionNames = ${JSON.stringify(options.map((option) => option.label))};
const axeTags = ${JSON.stringify(axeTags)};

async function gotoHarness(page: import("@playwright/test").Page) {
  await page.goto(demoRoute);
}

async function combobox(page: import("@playwright/test").Page) {
  return page.getByRole("combobox", { name: comboboxName });
}

async function openWithClick(page: import("@playwright/test").Page) {
  const trigger = await combobox(page);
  await trigger.click();
  return trigger;
}

test.describe("SpecFirst contract: ${lockedSpec.component.name}", () => {
${checkBlocks}
});
`;
}

function buildCheckTest(check: LockedSpecCheck, lockedSpec: LockedSpecSuccess): string {
  const title = `${check.id} [${check.id}]`;

  switch (check.testStrategy) {
    case "role-name-query":
      return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  await expect(await combobox(page)).toBeVisible();
});`;
    case "role-query":
      return buildRoleQueryTest(title, check);
    case "attribute-toggle":
      return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  const trigger = await combobox(page);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await trigger.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});`;
    case "attribute-check":
      return buildAttributeCheckTest(title, check);
    case "keyboard-open":
      return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  const trigger = await combobox(page);
  await trigger.focus();
  await trigger.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  const activeDescendant = await trigger.getAttribute("aria-activedescendant");
  expect(activeDescendant).toBeTruthy();
  const activeOption = page.locator(\`[id="\${activeDescendant}"]\`);
  await expect(activeOption).toHaveAttribute("role", "option");
  await expect(activeOption).toBeVisible();
});`;
    case "keyboard-select":
      return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  const trigger = await combobox(page);
  await trigger.focus();
  await trigger.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await trigger.press("Enter");
  await expect(trigger).toContainText(optionNames[0]);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});`;
    case "keyboard-close":
      return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  const trigger = await openWithClick(page);
  await expect(page.getByRole("listbox")).toBeVisible();
  await trigger.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("listbox")).toHaveCount(0);
});`;
    case "axe-scan":
      return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  const collapsedResults = await new AxeBuilder({ page }).include(scopeSelector).withTags(axeTags).analyze();
  expect(collapsedResults.violations).toEqual([]);

  await openWithClick(page);
  const expandedResults = await new AxeBuilder({ page }).include(scopeSelector).withTags(axeTags).analyze();
  expect(expandedResults.violations).toEqual([]);
});`;
    default:
      throw new Error(`Unsupported test strategy after validation: ${check.testStrategy}`);
  }
}

function buildRoleQueryTest(title: string, check: LockedSpecCheck): string {
  if (check.id === "combobox-role") {
    return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  await expect(page.getByRole("combobox")).toBeVisible();
});`;
  }

  if (check.id === "popup-listbox") {
    return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  await openWithClick(page);
  await expect(page.getByRole("listbox")).toBeVisible();
});`;
  }

  if (check.id === "option-roles") {
    return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  await openWithClick(page);
  await expect(page.getByRole("option", { name: new RegExp(optionNames[0], "i") })).toBeVisible();
  await expect(page.getByRole("option", { name: new RegExp(optionNames[1], "i") })).toBeVisible();
});`;
  }

  return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  await expect(page.getByRole(${JSON.stringify(String(check.params.expectedRole ?? "combobox"))})).toBeVisible();
});`;
}

function buildAttributeCheckTest(title: string, check: LockedSpecCheck): string {
  if (check.id === "popup-associated") {
    return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  const trigger = await openWithClick(page);
  const controls = await trigger.getAttribute("aria-controls");
  expect(controls).toBeTruthy();
  const popup = page.locator(\`[id="\${controls}"]\`);
  await expect(popup).toHaveAttribute("role", "listbox");
});`;
  }

  if (check.id === "selected-state") {
    return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  const trigger = await openWithClick(page);
  await page.getByRole("option", { name: new RegExp(optionNames[0], "i") }).click();
  if (await page.getByRole("listbox").count() === 0) {
    await trigger.click();
  }
  await expect(page.getByRole("option", { name: new RegExp(optionNames[0], "i") })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("option", { name: new RegExp(optionNames[1], "i") })).toHaveAttribute("aria-selected", "false");
});`;
  }

  return `test(${JSON.stringify(title)}, async ({ page }) => {
  await gotoHarness(page);
  const trigger = await combobox(page);
  await expect(trigger).toHaveAttribute(${JSON.stringify(String(check.params.attribute ?? "aria-expanded"))}, /.+/);
});`;
}

function parseScopeSelector(
  selector: string,
  componentName: string,
): { ok: true; value: ScopeBinding } | { ok: false; reason: string; message: string; details?: unknown } {
  const match = selector.match(/^\[data-specfirst-root="([^"]+)"\]$/);
  if (!match) {
    return {
      ok: false,
      reason: "unsupported_scope_selector",
      message: "Phase 5 MVP supports only [data-specfirst-root=\"<ComponentName>\"] selectors.",
      details: { selector },
    };
  }

  if (match[1] !== componentName) {
    return {
      ok: false,
      reason: "scope_selector_component_mismatch",
      message: "componentScope.selector value must match the locked component name.",
      details: { selectorValue: match[1], componentName },
    };
  }

  return { ok: true, value: { attribute: "data-specfirst-root", value: match[1] } };
}

function resolveHarnessImportPath(
  projectRoot: string,
  harnessPath: string,
  componentPath: string,
): { ok: true; value: string } | { ok: false; reason: string; message: string; details?: unknown } {
  const componentAbs = path.resolve(projectRoot, componentPath);
  if (!fs.existsSync(componentAbs)) {
    return {
      ok: false,
      reason: "component_source_unavailable",
      message: "Cannot resolve component source path for generated harness import.",
      details: { componentPath },
    };
  }

  const extension = path.extname(componentAbs);
  if (![".tsx", ".jsx", ".ts", ".js"].includes(extension)) {
    return {
      ok: false,
      reason: "unsupported_component_extension",
      message: "Generated harness import supports TS/JS React component files only.",
      details: { componentPath, extension },
    };
  }

  const withoutExtension = componentAbs.slice(0, -extension.length);
  let relativeImport = path.relative(path.dirname(harnessPath), `${withoutExtension}.js`).replace(/\\/g, "/");
  if (!relativeImport.startsWith(".")) {
    relativeImport = `./${relativeImport}`;
  }

  return { ok: true, value: relativeImport };
}

function buildOutputPaths(projectRoot: string, componentName: string) {
  const testFile = path.join(projectRoot, "tests", "a11y", `${componentName}.spec.ts`);
  const harnessFile = path.join(projectRoot, "src", "specfirst-demo", "generated", `${componentName}Harness.tsx`);

  return {
    testFile,
    harnessFile,
    relativeTestFile: relativePath(projectRoot, testFile),
    relativeHarnessFile: relativePath(projectRoot, harnessFile),
  };
}

function getLabelText(lockedSpec: LockedSpecSuccess): string {
  return lockedSpec.componentBindings.accessibleNameBinding.text
    ?? lockedSpec.componentBindings.accessibleNameBinding.fallbackText
    ?? "Choose fruit";
}

function readStringArrayParam(check: LockedSpecCheck | undefined, key: string): string[] {
  const value = check?.params[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function regexLiteral(value: string): string {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `/${escaped}/i`;
}

function skip(
  outputPath: string,
  writeArtifacts: boolean,
  lockedSpecPath: string,
  component: TestGenerationSkipped["component"],
  reason: string,
  message: string,
  upstream: TestGenerationSkipped["upstream"],
): TestGenerationSkipped {
  const result: TestGenerationSkipped = {
    schemaVersion: "1.0.0",
    status: "skipped",
    lockedSpecPath,
    ...(component ? { component } : {}),
    reason,
    message,
    upstream,
    nextPhase: { canContinue: false },
  };

  if (writeArtifacts) {
    writeJson(outputPath, result);
  }

  return result;
}

function resolveLockedSpecPath(input: string, projectRoot: string): string {
  if (input.endsWith(".json")) {
    return path.resolve(projectRoot, input);
  }

  return path.resolve(projectRoot, "specfirst", "runs", input, "lockedSpec.json");
}

function hashLockedSpec(lockedSpec: LockedSpecSuccess): string {
  return hashCanonical({
    ...lockedSpec,
    integrity: {
      ...lockedSpec.integrity,
      hash: null,
    },
  });
}

function hashFile(filePath: string): string {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function hashText(value: string): string {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function hashCanonical(value: unknown): string {
  return hashText(JSON.stringify(canonicalize(value)));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalize(record[key])]));
  }

  return value;
}

function readJsonFile<T>(filePath: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, "utf8")) as T };
  } catch (error) {
    return { ok: false, error: stringifyError(error) };
  }
}

function writeText(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function writeJson(filePath: string, value: unknown): void {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relativePath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const testGenerationInternals = {
  hashFile,
  hashText,
};
