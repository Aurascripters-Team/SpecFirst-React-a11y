const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = './specfirst';
const REGISTRY_PATH = path.join(OUTPUT_DIR, 'registry.json');
const RESULT_PATH = path.join(OUTPUT_DIR, 'manifestLoadResult.json');
const SNAPSHOT_PATH = path.join(OUTPUT_DIR, 'manifestUsed.json');

// ─── Utility: ensure output dir always exists before any write ───────────────
function ensureOutputDir() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ─── Utility: gate failure — writes artifact and returns result ───────────────
function failPipeline(reason, message) {
    console.error(`Validation Failed [${reason}]: ${message}`);
    const result = {
        status: "stopped",
        reason: reason,
        message: message,
        nextPhase: { canContinue: false }
    };
    ensureOutputDir();
    fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2));
    return result;
}

// ─── Main Phase 3 loader ──────────────────────────────────────────────────────
function loadManifestForClassification(classification) {
    console.log("\nStarting Phase 3: Manifest Validation...\n");

    // GATE 1: Continuation Gate
    // Did Phase 2 explicitly set canContinue=true?
    if (!classification.nextPhase || !classification.nextPhase.canContinue) {
        return failPipeline(
            "classification_blocked",
            "Phase 2 determined pipeline cannot continue."
        );
    }

    // GATE 2: Manifest ID Gate
    // Phase 3 must never guess a manifest — ID must be explicit.
    const manifestId = classification.nextPhase.manifestId;
    if (!manifestId) {
        return failPipeline(
            "missing_manifest_id",
            "No manifest ID provided by Phase 2. Phase 3 will not guess."
        );
    }

    // GATE 3: Registry Gate
    // Only manifests listed in registry.json are trusted.
    if (!fs.existsSync(REGISTRY_PATH)) {
        return failPipeline(
            "registry_not_found",
            `registry.json not found at ${REGISTRY_PATH}. Cannot validate manifest.`
        );
    }

    let registry;
    try {
        registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    } catch (e) {
        return failPipeline(
            "registry_malformed",
            `registry.json could not be parsed: ${e.message}`
        );
    }

    const registryEntry = registry.manifests && registry.manifests[manifestId];
    if (!registryEntry) {
        return failPipeline(
            "registry_entry_not_found",
            `Manifest ID '${manifestId}' is not present in registry.json. Pattern unsupported or registry misconfigured.`
        );
    }

    if (registryEntry.status !== "supported") {
        return failPipeline(
            "registry_entry_not_supported",
            `Manifest '${manifestId}' exists in registry but has status '${registryEntry.status}'. Only 'supported' manifests may load.`
        );
    }

    // GATE 4: File Gate
    // The versioned local manifest file must exist on disk.
    const manifestPath = path.join(OUTPUT_DIR, registryEntry.file);
    if (!fs.existsSync(manifestPath)) {
        return failPipeline(
            "file_not_found",
            `Rulebook not found at ${manifestPath}. Registry entry exists but file is missing.`
        );
    }

    // GATE 4b: Parse Gate
    // A corrupt or malformed JSON file must not crash the pipeline silently.
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
        return failPipeline(
            "malformed_json",
            `Manifest at ${manifestPath} contains invalid JSON: ${e.message}`
        );
    }

    // GATE 5: Pattern Gate
    // The manifest's own id must match what Phase 2 requested.
    if (manifest.id !== manifestId) {
        return failPipeline(
            "pattern_mismatch",
            `Loaded manifest id '${manifest.id}' does not match requested '${manifestId}'. Refusing to apply wrong rules.`
        );
    }

    // GATE 6: Seven-Layer Gate (part A)
    // sourceModel must be exactly "7-layer" — old flat manifests are rejected.
    if (manifest.sourceModel !== "7-layer") {
        return failPipeline(
            "invalid_source_model",
            `Manifest sourceModel is '${manifest.sourceModel}'. Only '7-layer' manifests are accepted.`
        );
    }

    // GATE 6: Seven-Layer Gate (part B)
    // All seven source-layer sections must exist (may be lightly populated, but must be present).
    const requiredLayers = [
        "wcagOutcomes",
        "ariaPattern",
        "ariaValidity",
        "accessibleName",
        "automation",
        "manualReview",
        "specfirstPolicy"
    ];
    for (const layer of requiredLayers) {
        if (!manifest.sources || !manifest.sources[layer]) {
            return failPipeline(
                "missing_layer",
                `Manifest is missing required source layer: '${layer}'.`
            );
        }
    }

    // GATE 7: Requirements Gate
    // Cannot hand Phase 4 a manifest with no requirements — it cannot generate a spec.
    if (!manifest.requirements || manifest.requirements.length === 0) {
        return failPipeline(
            "empty_requirements",
            "Manifest has no requirements defined. Phase 4 cannot generate a spec without them."
        );
    }

    // GATE 8: Manual Review Boundary Gate
    // Must define what automation cannot verify — prevents compliance overclaiming.
    if (!manifest.manualReviewRequired || manifest.manualReviewRequired.length === 0) {
        return failPipeline(
            "missing_manual_review",
            "Manifest must define manual review boundaries to prevent compliance overclaiming."
        );
    }

    // GATE 9: Report Boundary Gate
    // Must explicitly forbid compliance language such as "WCAG 2.2 AA compliant".
    if (
        !manifest.reportBoundary ||
        !manifest.reportBoundary.forbidden ||
        manifest.reportBoundary.forbidden.length === 0
    ) {
        return failPipeline(
            "missing_report_boundary",
            "Manifest must define reportBoundary.forbidden to prevent overclaiming in generated reports."
        );
    }

    // GATE 10: Applicability Gate
    // Manifest must declare what it applies to and what it rejects.
    if (
        !manifest.applicability ||
        !manifest.applicability.rejectIf ||
        manifest.applicability.rejectIf.length === 0
    ) {
        return failPipeline(
            "missing_applicability",
            "Manifest must define applicability.rejectIf as a second safety gate."
        );
    }

    // ALL GATES PASSED
    console.log("All validation gates passed.\n");

    const successResult = {
        schemaVersion: "1.0.0",
        component: classification.component,
        classification: {
            pattern: manifestId,
            status: classification.status,
            confidence: classification.confidence ?? null
        },
        manifest: {
            id: manifest.id,
            version: manifest.version,
            path: manifestPath,
            status: "loaded",
            sourceModel: manifest.sourceModel
        },
        sourceLayers: requiredLayers,
        validation: {
            registryEntryFound: true,
            manifestFileFound: true,
            schemaValid: true,
            patternMatchesClassification: true,
            applicabilityValidated: true,
            hasManualReviewBoundary: true,
            hasReportBoundary: true
        },
        nextPhase: {
            canContinue: true,
            loadedManifestPath: manifestPath
        }
    };

    ensureOutputDir();

    // Write the evidence artifact
    fs.writeFileSync(RESULT_PATH, JSON.stringify(successResult, null, 2));
    console.log(`Wrote manifestLoadResult.json  →  ${RESULT_PATH}`);

    // Write the exact manifest snapshot used in this run (for auditability)
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(manifest, null, 2));
    console.log(`Wrote manifestUsed.json        →  ${SNAPSHOT_PATH}`);

    return successResult;
}

// ─── TEST RUN ─────────────────────────────────────────────────────────────────
const mockPhase2Classification = {
    component: { name: "SelectOnlyCombobox", path: "src/components/SelectOnlyCombobox.jsx" },
    status: "supported",
    confidence: 0.92,
    nextPhase: {
        canContinue: true,
        manifestId: "react-select-only-combobox"
    }
};

loadManifestForClassification(mockPhase2Classification);