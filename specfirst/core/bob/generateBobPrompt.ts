import fs from "node:fs";
import path from "node:path";
import type { BaselineRedConfirmed } from "../baseline/types.js";
import type { LockedSpecSuccess } from "../spec/types.js";
import type { TestGenerationGenerated } from "../test-generation/types.js";
import type { GenerateBobPromptResult } from "./types.js";

export function generateBobPrompt(
  lockedSpec: LockedSpecSuccess,
  baseline: BaselineRedConfirmed,
  testGen: TestGenerationGenerated,
  projectRoot: string,
  outputPath: string,
): GenerateBobPromptResult {
  const componentPath = lockedSpec.component.path;
  const componentName = lockedSpec.component.name;
  const testFilePath = testGen.testFilePath;
  const harnessFilePath = testGen.harnessFilePath;
  const lockedSpecPath = baseline.lockedSpecPath;
  const lockedSpecHash = baseline.lockedSpecHash;

  const failedChecks = baseline.failedChecks;
  const bobConstraints: string[] = Array.isArray(lockedSpec.bobPatchConstraints)
    ? lockedSpec.bobPatchConstraints.map((c) => String(c))
    : [];

  const manualReviewItems: string[] = Array.isArray(lockedSpec.manualReviewRequired)
    ? lockedSpec.manualReviewRequired.map((item) => (typeof item === "object" && item !== null && "id" in item ? String((item as { id: string }).id) : String(item)))
    : [];

  const failedSection = failedChecks
    .map((c, i) => `${i + 1}. \`${c.id}\`\n   - Failure: ${c.message}`)
    .join("\n\n");

  const constraintSection = bobConstraints.length > 0
    ? bobConstraints.map((c) => `- ${c}`).join("\n")
    : "- Patch only the target component file.\n- Preserve public props and export signature.";

  const prompt = `# IBM Bob Remediation Task: SpecFirst React A11y

## Target component

\`${componentPath}\`

## Locked spec

\`${lockedSpecPath}\`

Locked spec hash:

\`${lockedSpecHash}\`

## Generated test file

\`${testFilePath}\`

Bob must not edit this file.

## Generated harness

\`${harnessFilePath}\`

Bob must not edit this file.

## Baseline result

Status: \`red-confirmed\`

Failed checks:

${failedSection}

## Contract requirements to satisfy

Use the locked spec as source of truth.

Relevant checks to fix:

${failedChecks.map((c) => `- \`${c.id}\``).join("\n")}

## Patch constraints

${constraintSection}

## Forbidden edits

Do NOT edit any of the following files:

- \`${lockedSpecPath}\`
- \`${testFilePath}\`
- \`${harnessFilePath}\`

## Focus management strategy

The locked spec uses **aria-activedescendant** focus management:
- DOM focus remains on the trigger element.
- The active option is referenced via \`aria-activedescendant\` on the trigger.
- Ensure \`aria-activedescendant\` points to the ID of the currently active option element.
- The active option element must exist in the DOM when it is referenced.

## Desired output

Make the minimal code changes needed so the generated Playwright tests pass.

After patching, summarize:
- Files changed
- Checks addressed
- Props/API preserved
- Any assumptions made

Component name: **${componentName}**
Pattern: **${lockedSpec.classification.pattern}**
Manual review still required after patch: ${manualReviewItems.join(", ")}
`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, prompt);

  return { promptPath: outputPath, promptText: prompt };
}
