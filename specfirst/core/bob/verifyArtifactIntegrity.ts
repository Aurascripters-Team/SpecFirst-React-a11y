import crypto from "node:crypto";
import fs from "node:fs";
import type { ArtifactIntegrityResult } from "./types.js";

export function verifyArtifactIntegrity(
  lockedSpecPath: string,
  testFilePath: string,
  harnessFilePath: string,
  expectedLockedSpecHash: string,
  expectedTestFileHash: string,
  expectedHarnessFileHash: string,
): ArtifactIntegrityResult {
  const lockedSpecHash = hashFile(lockedSpecPath);
  const testFileHash = hashFile(testFilePath);
  const harnessFileHash = hashFile(harnessFilePath);

  return {
    lockedSpecUnchanged: lockedSpecHash === expectedLockedSpecHash,
    testFileUnchanged: testFileHash === expectedTestFileHash,
    harnessFileUnchanged: harnessFileHash === expectedHarnessFileHash,
    lockedSpecHash,
    testFileHash,
    harnessFileHash,
  };
}

function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return "sha256:file-not-found";
  }
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}
