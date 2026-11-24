/**
 * Where a new terminal opens. Kept in this computer's browser storage, like
 * the agents' working folder: project paths differ from machine to machine.
 * Empty: the person's own folder (the runtime's default).
 */

export const TERMINAL_CWD_KEY = "nissewyn.terminal.cwd";

export function readTerminalCwd(): string {
  try {
    return window.localStorage.getItem(TERMINAL_CWD_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeTerminalCwd(cwd: string): boolean {
  try {
    const value = cwd.trim();
    if (value) window.localStorage.setItem(TERMINAL_CWD_KEY, value);
    else window.localStorage.removeItem(TERMINAL_CWD_KEY);
    return true;
  } catch {
    return false;
  }
}
