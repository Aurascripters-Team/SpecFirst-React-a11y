import fs from "node:fs";
import type { RunContext } from "./runContext.js";
import { fatal } from "./logger.js";

export function assertStatus<T extends { status: string; reason?: string; message?: string }>(
  result: T,
  allowed: string[]
): void {
  if (!allowed.includes(result.status)) {
    const detail = result.message ?? result.reason ?? "";
    throw new Error(
      `Unexpected status "${result.status}". Expected one of: ${allowed.join(", ")}. ${detail}`.trim()
    );
  }
}

export function handleCommandError(
  error: unknown,
  context: RunContext | null,
  debug: boolean
): never {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? (error.stack ?? message) : message;

  if (debug && context !== null) {
    const entry = `[${new Date().toISOString()}]\n${stack}\n\n`;
    try {
      fs.appendFileSync(context.debugLogPath, entry);
    } catch {
      // If we can't write the log, just continue to fatal
    }
  }

  fatal(message);
}
