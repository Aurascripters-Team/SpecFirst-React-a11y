import { spawnSync } from "node:child_process";
import path from "node:path";
import type { PatchScopeResult } from "./types.js";

export function runPatchScopeGuard(
  componentPath: string,
  lockedSpecPath: string,
  testFilePath: string,
  harnessFilePath: string,
  projectRoot: string,
): PatchScopeResult {
  const allowedChangedFiles = [componentPath];

  const forbiddenFiles = new Set([
    normalizePath(lockedSpecPath),
    normalizePath(testFilePath),
    normalizePath(harnessFilePath),
  ]);

  const changed = getChangedFiles(projectRoot);

  const changedNormalized = changed.map(normalizePath);
  const forbiddenChangedFiles = changedNormalized.filter((f) => forbiddenFiles.has(f));
  const scopePassed = forbiddenChangedFiles.length === 0;

  return {
    allowedChangedFiles,
    changedFiles: changed,
    forbiddenChangedFiles,
    status: scopePassed ? "passed" : "failed",
  };
}

function getChangedFiles(projectRoot: string): string[] {
  const result = spawnSync("git", ["diff", "--name-only", "HEAD"], {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
  });

  if (result.error || result.status !== 0) {
    const unstaged = spawnSync("git", ["diff", "--name-only"], {
      cwd: projectRoot,
      encoding: "utf8",
      shell: false,
    });
    if (unstaged.error || unstaged.status !== 0) {
      return [];
    }
    return parseFileList(unstaged.stdout);
  }

  const committed = parseFileList(result.stdout);

  const unstaged = spawnSync("git", ["diff", "--name-only"], {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
  });
  const unstagedFiles = unstaged.error ? [] : parseFileList(unstaged.stdout);

  const staged = spawnSync("git", ["diff", "--name-only", "--cached"], {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
  });
  const stagedFiles = staged.error ? [] : parseFileList(staged.stdout);

  return [...new Set([...committed, ...unstagedFiles, ...stagedFiles])];
}

function parseFileList(output: string): string[] {
  return output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}
