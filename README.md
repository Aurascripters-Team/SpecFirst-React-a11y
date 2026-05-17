# SpecFirst

**Zero-Trust Accessibility Pipeline for AI-Generated React Components**

SpecFirst is an enterprise-grade, 8-phase validation pipeline that prevents Large Language Models from hallucinating ARIA attributes and creating accessibility compliance liabilities in React applications.

---

## The Problem

AI coding assistants like GitHub Copilot, Claude, and ChatGPT frequently generate UI components with **hallucinated accessibility attributes**:

- **Invalid ARIA roles** on inappropriate host elements
- **Incorrect state management** (aria-expanded, aria-selected, aria-checked)
- **Missing keyboard interactions** required by WCAG 2.1/2.2
- **Broken screen reader semantics** that pass automated scanners but fail real assistive technology
- **Mixed interaction patterns** that violate WAI-ARIA Authoring Practices Guide (APG)

These hallucinations create **legal and regulatory risks**:

- **WCAG 2.1 Level AA non-compliance** exposing organizations to ADA/Section 508 litigation
- **False accessibility claims** in product documentation
- **Remediation costs** when accessibility audits reveal systemic failures
- **Reputational damage** from inaccessible user experiences

Traditional linting and automated testing tools cannot detect these issues because:

1. They validate syntax, not semantic correctness
2. They cannot verify screen reader announcement quality
3. They cannot determine if a native HTML element would be more appropriate
4. They cannot enforce pattern-specific ARIA validity rules

**SpecFirst solves this by treating AI-generated code as untrusted input** and validating it against versioned, source-backed accessibility rulebooks before any code reaches production.

---

## The Solution

SpecFirst is a **complete 8-phase Zero-Trust pipeline** that intercepts AI-generated React components, classifies their UI patterns, validates them against strict accessibility manifests, and generates frozen specifications with automated test suites.

### Core Principles

1. **Zero Trust**: AI-generated code is untrusted until proven compliant
2. **Source-Backed Rules**: Every requirement traces to WCAG outcomes and WAI-ARIA APG patterns
3. **Manifest-Driven**: Local, versioned rulebooks define what is allowed
4. **Phase 3 Trust Gate**: No code patching, test generation, or compliance claims without manifest validation
5. **Conservative by Design**: Rejects ambiguous patterns and mixed-interactive components
6. **Audit Trail**: Every run produces timestamped artifacts for compliance documentation

### What SpecFirst Does

- **Analyzes** React component structure using TypeScript AST parsing
- **Classifies** UI patterns (select-only combobox, navigation menu, etc.)
- **Validates** against 7-layer accessibility manifests
- **Freezes** component specifications with cryptographic integrity hashes
- **Generates** Playwright + axe-core test suites
- **Documents** manual review boundaries (what automation cannot verify)
- **Prevents** Bob (or any LLM) from making unsafe ARIA patches

### What SpecFirst Does Not Do

- **Does not claim WCAG compliance** based on automated tests alone
- **Does not patch code silently** without human review
- **Does not support every UI pattern** (only validated patterns with complete manifests)
- **Does not replace manual accessibility testing** (defines what remains manual)

---

## The 8-Phase Architecture

SpecFirst processes components through eight sequential phases, each producing auditable artifacts:

### Phase 1: Component Analysis
**Script**: `npm run specfirst:analyze -- <component-path>`  
**Output**: `componentAnalysis.json`

Parses the React component using `ts-morph` to extract:
- Component name, props, and state hooks
- JSX element tree with ARIA attributes
- Event handlers (onClick, onKeyDown, etc.)
- Interaction model (trigger-controlled, navigation, form)
- Native element signals (button, input, select)
- Risk flags (missing keyboard handlers, invalid ARIA)

### Phase 2: Pattern Classification
**Script**: `npm run specfirst:classify -- <componentAnalysis.json>`  
**Output**: `classification.json`

Classifies the component into a supported UI pattern:
- `react-select-only-combobox`: Single-selection dropdown with listbox popup
- `native-select/manual-review`: Native `<select>` element detected
- `mixed-interactive-popup`: Popup contains checkboxes, links, or buttons (rejected)
- `unsupported`: Pattern not covered by any manifest
- `ambiguous`: Insufficient signals to classify confidently

Includes confidence scoring, blockers, and manual review notes.

### Phase 3: Manifest Loading (Trust Gate)
**Script**: `npm run specfirst:load-manifest -- <classification.json>`  
**Output**: `manifestLoadResult.json`, `manifestUsed.json`

**This is the critical trust gate.** Phase 3:
- Validates `canContinue=true` from Phase 2
- Loads the manifest from the local registry (`specfirst/rules/registry.json`)
- Validates the 7-layer rulebook structure
- Verifies applicability rules match the component
- Confirms manual review boundaries are defined
- **Stops the pipeline** if any validation fails

No code patching, test generation, or compliance claims occur without passing Phase 3.

### Phase 4: Freeze Specification
**Script**: `npm run specfirst:freeze-spec -- <manifestLoadResult.json>`  
**Output**: `lockedSpec.json`

Generates a component-specific frozen specification:
- Maps manifest requirements to component-specific checks
- Extracts accessible names, option labels, and test data
- Computes SHA-256 integrity hash
- Locks the specification for Phase 5 test generation

### Phase 5: Test Generation
**Script**: `npm run specfirst:generate-tests -- <lockedSpec.json>`  
**Output**: `tests/a11y/<Component>.spec.ts`, `src/specfirst-demo/generated/<Component>Harness.tsx`

Generates:
- **Playwright test suite** with role queries, keyboard interactions, and axe-core scans
- **Test harness component** for isolated testing
- **Demo route** for manual verification
- Test file integrity hash

### Phase 6: Test Execution
**Script**: `npx playwright test tests/a11y/<Component>.spec.ts`

Runs the generated Playwright tests:
- Role and accessible name queries
- ARIA state validation (aria-expanded, aria-selected)
- Keyboard interaction tests (ArrowDown, Enter, Escape)
- axe-core WCAG scans in collapsed and expanded states

### Phase 7: Manual Review
**Process**: Human accessibility auditor reviews the component

Validates what automation cannot:
- Screen reader announcement quality (NVDA, JAWS, VoiceOver)
- Visual focus indicator quality (WCAG 2.4.11)
- Cross-browser assistive technology behavior
- Whether a native element would be more appropriate
- Option label meaningfulness in product context

### Phase 8: Compliance Documentation
**Process**: Generate audit-ready compliance reports

Produces documentation that:
- Lists automated checks passed
- Documents manual review boundaries
- Provides artifact trail (analysis → classification → manifest → spec → tests)
- **Never claims "WCAG compliant"** based on automation alone

---

## The 7-Layer Manifest

SpecFirst manifests are **versioned, local rulebooks** that define accessibility requirements through seven distinct layers. This structure makes rules traceable, testable, and defensible.

### Layer 1: WCAG Outcomes
Maps requirements to high-level accessibility outcomes:
- **2.1.1 Keyboard**: All functionality operable via keyboard
- **2.1.2 No Keyboard Trap**: Focus never trapped
- **1.3.1 Info and Relationships**: Programmatically determinable semantics
- **4.1.2 Name, Role, Value**: Accessible name and state exposed

### Layer 2: WAI-ARIA APG Pattern
Defines expected behavior from the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/):
- Trigger semantics (role=combobox, aria-expanded, aria-controls)
- Popup association and listbox semantics
- Option semantics (role=option, aria-selected)
- Keyboard model (ArrowDown, Enter, Escape, Home, End)

### Layer 3: ARIA Validity
Constrains roles, states, and properties:
- Allowed host elements (e.g., `<button>` for combobox, not `<input>`)
- Required attributes (aria-expanded, aria-controls)
- Forbidden attributes (aria-checked on role=option)
- Focus management strategy (aria-activedescendant)

### Layer 4: Accessible Name
Defines allowed naming strategies:
- `aria-labelledby` (preferred)
- `aria-label` (acceptable)
- Visible label association via `<label>`
- **Forbidden**: Using placeholder or selected value as name

### Layer 5: Automation
Maps requirements to test strategies:
- Role queries (`getByRole('combobox')`)
- Attribute toggles (`aria-expanded` before/after interaction)
- Keyboard interactions (`press('ArrowDown')`)
- axe-core scans with WCAG tags

### Layer 6: Manual Review Boundary
Explicitly lists what remains manual:
- Screen reader announcement quality
- Visual focus indicator quality
- Native element preference evaluation
- Cross-browser AT behavior
- Option label meaningfulness
- Cognitive load assessment

### Layer 7: SpecFirst Safety Policy
Protects the pipeline from unsafe remediation:
- **Native-first policy**: Prefer native elements when sufficient
- **Bob patch constraints**: Only add ARIA/keyboard handlers from manifest
- **Reject-if rules**: Stop for mixed-interactive popups, multi-select, etc.
- **Report boundaries**: Forbid claiming "WCAG compliant" from automation

---

## Local Setup & Usage

### Prerequisites

- **Node.js**: 18.x or later
- **npm**: 9.x or later
- **TypeScript**: 5.6.x (included in devDependencies)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd SpecFirst-React-a11y

# Install dependencies
npm install

# Verify installation
npm run typecheck
```

### Running the Full Pipeline

#### Step 1: Analyze a Component

```bash
npm run specfirst:analyze -- src/components/MyCombobox.tsx
```

This creates a timestamped run directory in `specfirst/runs/` with `componentAnalysis.json`.

#### Step 2: Classify the Pattern

```bash
npm run specfirst:classify -- specfirst/runs/<run-id>/componentAnalysis.json
```

Produces `classification.json` in the same run directory.

#### Step 3: Load the Manifest (Trust Gate)

```bash
npm run specfirst:load-manifest -- specfirst/runs/<run-id>/classification.json
```

Validates the manifest and produces `manifestLoadResult.json` and `manifestUsed.json`.

**If this step fails, the pipeline stops.** No test generation or code patching occurs.

#### Step 4: Freeze the Specification

```bash
npm run specfirst:freeze-spec -- <run-id>
```

Generates `lockedSpec.json` with component-specific checks and integrity hash.

#### Step 5: Generate Tests

```bash
npm run specfirst:generate-tests -- <run-id>
```

Creates:
- `tests/a11y/<Component>.spec.ts`
- `src/specfirst-demo/generated/<Component>Harness.tsx`

#### Step 6: Run Tests

```bash
# Run all accessibility tests
npx playwright test tests/a11y/

# Run specific component tests
npx playwright test tests/a11y/SelectOnlyCombobox.spec.ts

# Run with UI mode for debugging
npx playwright test --ui
```

#### Step 7: View Demo Harness

```bash
npm run specfirst:demo
```

Navigate to `http://localhost:5173/specfirst/generated/<Component>` to manually test the component.

### Example: Complete Workflow

```bash
# Analyze the SelectOnlyCombobox component
npm run specfirst:analyze -- src/components/SelectOnlyCombobox.tsx

# Output: specfirst/runs/2026-05-17T10-30-00-000Z-analyze/componentAnalysis.json

# Classify the pattern
npm run specfirst:classify -- specfirst/runs/2026-05-17T10-30-00-000Z-analyze/componentAnalysis.json

# Load manifest (Trust Gate)
npm run specfirst:load-manifest -- 2026-05-17T10-30-00-000Z-analyze

# Freeze specification
npm run specfirst:freeze-spec -- 2026-05-17T10-30-00-000Z-analyze

# Generate tests
npm run specfirst:generate-tests -- 2026-05-17T10-30-00-000Z-analyze

# Run tests
npx playwright test tests/a11y/SelectOnlyCombobox.spec.ts

# View demo
npm run specfirst:demo
```

---

## Project Structure

```
SpecFirst-React-a11y/
├── specfirst/
│   ├── cli/                    # Phase CLI scripts
│   │   ├── analyze.ts          # Phase 1: Component analysis
│   │   ├── classify.ts         # Phase 2: Pattern classification
│   │   ├── loadManifest.ts     # Phase 3: Manifest loading (Trust Gate)
│   │   ├── freezeSpec.ts       # Phase 4: Freeze specification
│   │   └── generateTests.ts    # Phase 5: Test generation
│   ├── core/                   # Core pipeline logic
│   │   ├── analysis/           # Phase 1 implementation
│   │   ├── classification/     # Phase 2 implementation
│   │   ├── manifest/           # Phase 3 implementation
│   │   ├── spec/               # Phase 4 implementation
│   │   └── test-generation/    # Phase 5 implementation
│   ├── rules/                  # Manifest registry and rulebooks
│   │   ├── registry.json       # Allowed manifest set
│   │   └── react-select-only-combobox.v1.json  # 7-layer manifest
│   └── runs/                   # Timestamped run artifacts
│       └── <run-id>/
│           ├── componentAnalysis.json
│           ├── classification.json
│           ├── manifestLoadResult.json
│           ├── manifestUsed.json
│           ├── lockedSpec.json
│           └── testGenerationResult.json
├── tests/
│   ├── a11y/                   # Generated Playwright tests
│   ├── analysis/               # Phase 1 unit tests
│   ├── classification/         # Phase 2 unit tests
│   ├── manifest/               # Phase 3 unit tests
│   ├── spec/                   # Phase 4 unit tests
│   └── test-generation/        # Phase 5 unit tests
├── src/
│   ├── components/             # React components to analyze
│   └── specfirst-demo/         # Demo harness application
│       └── generated/          # Generated test harnesses
├── architecture_guidelines/    # Phase documentation PDFs
└── package.json
```

---

## Supported Patterns

### Currently Supported

- **react-select-only-combobox**: Single-selection dropdown with listbox popup (ARIA 1.2 combobox pattern)

### Planned Support

- Navigation menus (menubar, menu, menuitem)
- Tabs (tablist, tab, tabpanel)
- Dialogs (dialog, alertdialog)
- Disclosure widgets (button + aria-expanded)

### Explicitly Rejected

- Mixed-interactive popups (checkboxes, links, buttons inside options)
- Multi-select comboboxes (requires separate manifest)
- Editable comboboxes with freeform text input
- Custom components where native elements suffice

---

## Manifest Registry

The manifest registry (`specfirst/rules/registry.json`) defines the allowed set of accessibility rulebooks. Only manifests with `status: "supported"` may be loaded by Phase 3.

```json
{
  "manifests": {
    "react-select-only-combobox": {
      "file": "react-select-only-combobox.v1.json",
      "status": "supported",
      "displayName": "React Select-Only Combobox",
      "addedVersion": "1.0.0"
    }
  }
}
```

To add a new pattern:
1. Create a 7-layer manifest in `specfirst/rules/`
2. Add an entry to `registry.json` with `status: "supported"`
3. Update Phase 2 classification logic to detect the pattern
4. Document manual review boundaries

---

## Testing

### Run All Tests

```bash
# Phase 1 analysis tests
npm run test:analysis

# Phase 2 classification tests
npm run test:classification

# Phase 3 manifest loading tests
npm run test:manifest

# Phase 4 spec freezing tests
npm run test:spec

# Phase 5 test generation tests
npm run test:test-generation

# Phase 6 accessibility tests (Playwright)
npx playwright test tests/a11y/
```

### Test Fixtures

Test fixtures are located in `tests/fixtures/` and `tests/classification/fixtures/`. They cover:
- Valid select-only comboboxes
- Native select elements
- Mixed-interactive popups (rejected)
- Ambiguous components (insufficient signals)
- Edge cases (arrow functions, default exports, custom components)

---

## Compliance & Legal

### What SpecFirst Validates

- ARIA role, state, and property correctness per WAI-ARIA 1.2
- Keyboard interaction mechanics per ARIA Authoring Practices Guide
- Programmatic structure (aria-controls, aria-expanded, aria-selected)
- axe-core WCAG 2.0/2.1/2.2 Level A/AA rules

### What SpecFirst Does Not Validate

- Screen reader announcement quality (requires manual testing)
- Visual focus indicator quality (WCAG 2.4.11)
- Color contrast in all states (requires manual inspection)
- Cross-browser assistive technology behavior
- Whether a native element would be more appropriate
- Meaningfulness of labels in product context

### Compliance Claims

**SpecFirst does not claim WCAG compliance.** Automated tests verify ARIA structure and keyboard mechanics. They cannot verify screen reader quality, visual focus, or cross-browser AT behavior.

**Allowed language**:
- "Automated checks passed for the requirements defined in this manifest"
- "Manual review is required before making accessibility claims"
- "This manifest covers the select-only combobox pattern only"

**Forbidden language**:
- "WCAG 2.2 AA compliant"
- "Fully accessible"
- "Accessibility guaranteed"
- "Meets all WCAG requirements"
- "Screen reader compatible"

---

## Contributing

SpecFirst is designed for enterprise security and compliance. Contributions must:

1. Maintain the Zero-Trust principle (AI code is untrusted)
2. Preserve the Phase 3 Trust Gate (no bypassing manifest validation)
3. Document manual review boundaries for new patterns
4. Include 7-layer manifests for new UI patterns
5. Provide test fixtures and unit tests
6. Update architecture documentation

---

## License

[Specify license here]

---

## Contact

For enterprise support, custom manifest development, or accessibility consulting:

[Contact information]

---

## Acknowledgments

SpecFirst is built on:
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WCAG 2.1/2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [Playwright Testing Framework](https://playwright.dev/)
- [axe-core Accessibility Engine](https://github.com/dequelabs/axe-core)
- [ts-morph TypeScript AST Library](https://ts-morph.com/)

---

**SpecFirst: Trust, but verify. Especially when AI writes the code.**