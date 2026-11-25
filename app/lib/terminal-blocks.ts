/**
 * Command blocks: the shell marks each command with OSC 133 -- A where the
 * prompt starts, B where the typed command starts, C where its output starts,
 * D;<exit code> when it ends. The terminal page keeps one block per command,
 * so it can jump between commands, mark the ones that failed, and hand a
 * failed one (command and output) to the agent.
 */

export type ShellMark = { kind: "A" | "B" | "C" | "D"; code?: number };

/** The payload of an OSC 133 sequence (what follows `133;`), or null if it is not one we use. */
export function parseShellMark(data: string): ShellMark | null {
  const [kind, ...rest] = data.split(";");
  if (kind !== "A" && kind !== "B" && kind !== "C" && kind !== "D") return null;
  if (kind !== "D") return { kind };
  const code = rest[0] === undefined || rest[0] === "" ? undefined : Number(rest[0]);
  return Number.isInteger(code) ? { kind, code } : { kind };
}

/** What a block needs from a marker: the buffer line it sits on (-1 once trimmed away). */
export type LineMark = { readonly line: number; readonly isDisposed: boolean };

export type CommandBlock<M extends LineMark = LineMark> = {
  prompt: M;
  /** Where the typed command starts: its line and column. */
  command?: { mark: M; x: number };
  output?: M;
  end?: M;
  code?: number;
};

export const blockFailed = (block: CommandBlock) => block.code !== undefined && block.code !== 0;
export const blockAlive = (block: CommandBlock) => !block.prompt.isDisposed && block.prompt.line >= 0;

/** The part of a terminal buffer the blocks read. */
export type BufferLike = {
  getLine(y: number): { translateToString(trimRight?: boolean, start?: number): string; isWrapped: boolean } | undefined;
};

/** Lines [from, to) as text, wrapped rows joined back into the lines they were. */
function readLines(buffer: BufferLike, from: number, to: number, firstColumn = 0): string[] {
  const lines: string[] = [];
  for (let y = from; y < to; y++) {
    const row = buffer.getLine(y);
    if (!row) break;
    const text = row.translateToString(true, y === from ? firstColumn : 0);
    if (row.isWrapped && lines.length) lines[lines.length - 1] += text;
    else lines.push(text);
  }
  return lines;
}

/** The command the person (or agent) typed. */
export function blockCommand(buffer: BufferLike, block: CommandBlock): string {
  if (!block.command || block.command.mark.line < 0) return "";
  const from = block.command.mark.line;
  const to = block.output && block.output.line >= from ? Math.max(block.output.line, from + 1) : from + 1;
  return readLines(buffer, from, to, block.command.x).join("\n").trim();
}

/** What the command printed: the last `maxLines` lines, at most `maxChars` characters. */
export function blockOutput(buffer: BufferLike, block: CommandBlock, maxLines = 200, maxChars = 8000): string {
  if (!block.output || block.output.line < 0) return "";
  const from = block.output.line;
  const to = block.end && block.end.line >= from ? block.end.line : from;
  let lines = readLines(buffer, from, to);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (lines.length > maxLines) lines = lines.slice(-maxLines);
  let text = lines.join("\n");
  if (text.length > maxChars) text = text.slice(-maxChars);
  return text;
}

/**
 * Index of the block to jump to from `fromLine` (the top of the view):
 * the nearest one above (`up`) or below, optionally only failed ones.
 */
export function nearestBlock(blocks: CommandBlock[], fromLine: number, up: boolean, onlyFailed = false): number {
  let found = -1;
  blocks.forEach((block, index) => {
    if (!blockAlive(block) || (onlyFailed && !blockFailed(block))) return;
    const line = block.prompt.line;
    if (up ? line < fromLine && (found < 0 || line > blocks[found].prompt.line) : line > fromLine && found < 0) found = index;
  });
  return found;
}
