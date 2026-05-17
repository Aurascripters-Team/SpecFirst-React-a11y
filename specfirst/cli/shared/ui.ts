import chalk from "chalk";

export interface RunStats {
  phase: "run" | "verify" | "report";
  runId: string;
  totalChecks: number;
  failedChecks: number;
  frozen: boolean;
  bobPromptReady: boolean;
  artifactPath?: string;
}

const SEP = chalk.hex("#8A8A8A")("│");

const theme = {
  symbol: () => chalk.hex("#A61E5C").bold("◈"),
  brand: (text: string) => chalk.hex("#5B1D87").bold(text),
  muted: (text: string) => chalk.hex("#8A8A8A")(text),
  success: (text: string) => chalk.hex("#22C55E")(text),
  failure: (text: string) => chalk.hex("#EF4444")(text),
  warning: (text: string) => chalk.hex("#FACC15")(text),
};

export function printBanner(version: string, projectPath: string): void {
  console.log(`${theme.symbol()}  ${theme.brand("SpecFirst")} ${theme.muted(`v${version}`)}`);
  console.log(theme.muted("   Accessibility TDD Agent"));
  console.log(theme.muted(`   ${projectPath}`));
  console.log("");
}

export function printDivider(): void {
  const width = process.stdout.columns ?? 62;
  console.log(chalk.hex("#8A8A8A")("─".repeat(width)));
}

export function printResult(stats: RunStats | null): void {
  console.log("");
  printDivider();
  if (stats) {
    printStatusBar(stats);
  }
}

export function printStatusBar(stats: RunStats): void {
  const sym = theme.symbol();
  const brand = theme.brand("SpecFirst");

  if (stats.phase === "run") {
    const failPart =
      stats.failedChecks > 0
        ? theme.failure(`${stats.failedChecks} failed`)
        : theme.success("0 failed");
    const frozenPart = stats.frozen
      ? theme.success("frozen ✓")
      : theme.warning("not frozen");
    const bobPart = stats.bobPromptReady
      ? theme.success("Bob prompt ready")
      : theme.muted("Bob prompt pending");
    const runLabel = theme.muted(stats.runId.slice(0, 19)); // trims to YYYY-MM-DDTHH-MM-SS
    const checksLabel = theme.muted(`${stats.totalChecks} checks`);
    console.log(
      `${sym} ${brand} ${SEP} ${runLabel} ${SEP} ${checksLabel} ${SEP} ${failPart} ${SEP} ${frozenPart} ${SEP} ${bobPart}`
    );
  } else if (stats.phase === "verify") {
    const passed = stats.totalChecks - stats.failedChecks;
    const passPart =
      stats.failedChecks === 0
        ? theme.success(`${passed}/${stats.totalChecks} passed`)
        : theme.failure(`${passed}/${stats.totalChecks} passed`);
    const artifactSuffix = stats.artifactPath
      ? ` ${SEP} ${theme.muted(stats.artifactPath)}`
      : "";
    console.log(
      `${sym} ${brand} ${SEP} ${theme.muted("final verify")} ${SEP} ${passPart} ${SEP} ${theme.muted("manual review required")}${artifactSuffix}`
    );
  } else if (stats.phase === "report") {
    const artifact = stats.artifactPath ?? "evidenceReport.md";
    console.log(
      `${sym} ${brand} ${SEP} ${theme.muted("report")} ${SEP} ${theme.muted(artifact)} ${SEP} ${theme.muted("manual review required")}`
    );
  }
}
