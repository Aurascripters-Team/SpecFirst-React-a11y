import assert from "node:assert/strict";
import { completer } from "../../specfirst/cli/shell.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

console.log("shell.ts completer");

test("empty input returns all command names", () => {
  const [completions] = completer("");
  assert.ok(completions.includes("run"), "missing 'run'");
  assert.ok(completions.includes("verify"), "missing 'verify'");
  assert.ok(completions.includes("report"), "missing 'report'");
  assert.ok(completions.includes("help"), "missing 'help'");
  assert.ok(completions.includes("exit"), "missing 'exit'");
});

test("prefix 'r' returns run and report", () => {
  const [completions] = completer("r");
  assert.ok(completions.includes("run"), "missing 'run'");
  assert.ok(completions.includes("report"), "missing 'report'");
  assert.ok(!completions.includes("verify"), "should not include 'verify'");
});

test("prefix 've' returns only verify", () => {
  const [completions] = completer("ve");
  assert.deepEqual(completions, ["verify"]);
});

test("prefix 'ex' returns only exit", () => {
  const [completions] = completer("ex");
  assert.deepEqual(completions, ["exit"]);
});

test("prefix 'h' returns only help", () => {
  const [completions] = completer("h");
  assert.deepEqual(completions, ["help"]);
});

test("unrecognised prefix returns empty array", () => {
  const [completions] = completer("zzz");
  assert.deepEqual(completions, []);
});

test("completer second element is the original line", () => {
  const [, line] = completer("ru");
  assert.equal(line, "ru");
});

console.log("");
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
