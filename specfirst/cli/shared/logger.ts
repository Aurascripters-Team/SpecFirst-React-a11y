import chalk from "chalk";
import ora, { type Ora } from "ora";

export function step(label: string): Ora {
  return ora(label).start();
}

export function info(message: string): void {
  console.log(message);
}

export function warn(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

export function printChecks(failed: string[]): void {
  console.log("");
  console.log("Failed checks:");
  for (const check of failed) {
    console.log(`  - ${check}`);
  }
}

export function printNextAction(message: string): void {
  console.log("");
  console.log(chalk.bold("Next:"));
  console.log(message);
}

export function fatal(message: string, options?: { exitCode?: number }): never {
  console.error(chalk.red(`✗ ${message}`));
  process.exit(options?.exitCode ?? 1);
}
