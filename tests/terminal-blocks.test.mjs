import assert from "node:assert/strict";
import { test } from "node:test";

import { blockCommand, blockFailed, blockOutput, nearestBlock, parseShellMark } from "../.test-build/terminal-blocks.mjs";

const mark = (line) => ({ line, isDisposed: false });
const buffer = (rows) => ({
  getLine: (y) =>
    rows[y] === undefined
      ? undefined
      : {
          isWrapped: rows[y].startsWith("~"),
          translateToString: (_trim, start = 0) => rows[y].replace(/^~/, "").slice(start).trimEnd(),
        },
});

test("shell marks: prompt, command, output, and the end with its exit code", () => {
  assert.deepEqual(parseShellMark("A"), { kind: "A" });
  assert.deepEqual(parseShellMark("B"), { kind: "B" });
  assert.deepEqual(parseShellMark("C"), { kind: "C" });
  assert.deepEqual(parseShellMark("D;3"), { kind: "D", code: 3 });
  assert.deepEqual(parseShellMark("D"), { kind: "D" });
  assert.deepEqual(parseShellMark("D;x"), { kind: "D" });
  assert.equal(parseShellMark("P;k=v"), null);
});

test("a block reads back its command (without the prompt) and its output", () => {
  const rows = ["PS C:\> npm test", "> build", "Error: boom", "~ continued", "", "PS C:\> "];
  const block = { prompt: mark(0), command: { mark: mark(0), x: rows[0].indexOf("npm") }, output: mark(1), end: mark(5), code: 1 };
  assert.equal(blockCommand(buffer(rows), block), "npm test");
  assert.equal(blockOutput(buffer(rows), block), "> build\nError: boom continued");
  assert.equal(blockFailed(block), true);
  assert.equal(blockFailed({ ...block, code: 0 }), false);
  assert.equal(blockFailed({ ...block, code: undefined }), false);
});

test("long output keeps its end", () => {
  const rows = ["PS> x", ...Array.from({ length: 300 }, (_, i) => `line ${i}`), "PS> "];
  const block = { prompt: mark(0), command: { mark: mark(0), x: 4 }, output: mark(1), end: mark(301), code: 2 };
  const out = blockOutput(buffer(rows), block, 3);
  assert.equal(out, "line 297\nline 298\nline 299");
});

test("jumping finds the nearest command above or below, or only failed ones", () => {
  const blocks = [0, 10, 20, 30].map((line, i) => ({ prompt: mark(line), code: i === 1 ? 1 : 0 }));
  assert.equal(nearestBlock(blocks, 25, true), 2);
  assert.equal(nearestBlock(blocks, 25, false), 3);
  assert.equal(nearestBlock(blocks, 25, true, true), 1);
  assert.equal(nearestBlock(blocks, 5, true, true), -1);
  assert.equal(nearestBlock([{ prompt: { line: -1, isDisposed: true } }], 5, true), -1);
});
