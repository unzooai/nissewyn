"use client";

import { Bot, ExternalLink, LoaderCircle, Plus, SquareTerminal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "./i18n";
import type { RuntimeTerminal, WorkspaceProvider } from "./lib/provider";
import { continueReplay, startReplay, type ReplayState, type ReplayStep } from "./lib/terminal-replay";

type Runtime = WorkspaceProvider["runtime"];

export type TerminalPageProps = {
  runtime: Runtime;
  notify: (message: string) => void;
  /** Show this terminal first (an agent's, from a conversation). */
  focus?: string;
  /** Bumped to ask for a new terminal on arrival ("打开终端"). */
  newRequest?: number;
  /** The separate window, for heavy full-screen programs (desktop app only). */
  openWindow?: (sessionId: string) => Promise<void>;
};

const errorText = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure));

/**
 * 终端页：人自己的终端就在 Nissewyn 里开、用、关，智能体用过的也在这里接手。
 * 独立窗口还在，给大型全屏程序用。
 */
export function TerminalPage({ runtime, notify, focus, newRequest, openWindow }: TerminalPageProps) {
  const [list, setList] = useState<RuntimeTerminal[] | null>(null);
  const [selected, setSelected] = useState<string | null>(focus ?? null);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const handledNew = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const next = await runtime.terminals();
      setList(next);
      setLoadError(null);
      return next;
    } catch (failure) {
      setLoadError(errorText(failure));
      return null;
    }
  }, [runtime]);

  const create = useCallback(async () => {
    setCreating(true);
    try {
      const id = await runtime.createTerminal();
      await load();
      setSelected(id);
    } catch (failure) {
      notify(t("没能开出新终端：{error}", { error: errorText(failure) }));
    } finally {
      setCreating(false);
    }
  }, [runtime, load, notify]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (focus) setSelected(focus);
  }, [focus]);

  // "打开终端" from elsewhere: a new one, once per request.
  useEffect(() => {
    if (newRequest === undefined || handledNew.current === newRequest) return;
    handledNew.current = newRequest;
    void create();
  }, [newRequest, create]);

  const terminals = list ?? [];
  const current = selected && terminals.some((x) => x.sessionId === selected) ? selected : terminals.at(-1)?.sessionId ?? null;
  const currentInfo = terminals.find((x) => x.sessionId === current);

  async function close(id: string) {
    try {
      await runtime.closeTerminal(id);
      if (selected === id) setSelected(null);
      await load();
    } catch (failure) {
      notify(t("没能关掉这个终端：{error}", { error: errorText(failure) }));
    }
  }

  const name = (item: RuntimeTerminal, index: number) =>
    item.title?.trim() || item.shell?.split(/[\\/]/).pop() || t("终端 {n}", { n: index + 1 });

  return (
    <section className="terminal-page" aria-label={t("终端")}>
      <aside className="terminal-page-list">
        <div className="terminal-page-list-head">
          <strong>{t("终端")}</strong>
          <button type="button" className="terminal-page-new" onClick={() => void create()} disabled={creating}>
            {creating ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
            {t("新终端")}
          </button>
        </div>
        {loadError && <p className="terminal-page-error">{t("读不到终端列表：{error}", { error: loadError })}</p>}
        <ul>
          {terminals.map((item, index) => (
            <li key={item.sessionId} className={item.sessionId === current ? "active" : ""}>
              <button type="button" onClick={() => setSelected(item.sessionId)} title={item.shell ?? undefined}>
                {item.agent ? <Bot size={15} aria-hidden="true" /> : <SquareTerminal size={15} aria-hidden="true" />}
                <span>{name(item, index)}</span>
                {item.agent && <em>{t("智能体")}</em>}
              </button>
              {!item.agent && (
                <button
                  type="button"
                  className="terminal-page-close"
                  onClick={() => void close(item.sessionId)}
                  aria-label={t("关掉这个终端")}
                  title={t("关掉这个终端")}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {list && terminals.length === 0 && <p className="terminal-page-hint">{t("还没有开着的终端。")}</p>}
      </aside>

      <div className="terminal-page-main">
        {current ? (
          <>
            <header className="terminal-page-bar">
              <span>
                {currentInfo?.agent ? t("智能体用过的终端：点进去就能直接输入，接手它的工作。") : t("你的终端")}
              </span>
              {openWindow && (
                <button
                  type="button"
                  onClick={() => openWindow(current).catch((failure) => notify(t("没能打开独立窗口：{error}", { error: errorText(failure) })))}
                  title={t("大型全屏程序（vim、htop 这类）在独立窗口里更顺滑")}
                >
                  <ExternalLink size={13} aria-hidden="true" />
                  {t("在独立窗口打开")}
                </button>
              )}
            </header>
            <LiveTerminal key={current} id={current} runtime={runtime} />
          </>
        ) : (
          <div className="terminal-page-empty">
            <SquareTerminal size={28} aria-hidden="true" />
            <p>{t("在这里开一个终端，直接在 Nissewyn 里输入命令。智能体用过的终端也会出现在左边。")}</p>
            <button type="button" className="terminal-page-new" onClick={() => void create()} disabled={creating}>
              <Plus size={14} aria-hidden="true" />
              {t("新终端")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/** What xterm answers by itself to questions in replayed output. */
const TERMINAL_REPORT = /^\x1b\[(\??[\d;]*[Rcn]|>[\d;]*c)$/;
const FOCUS_REPORT = /^\x1b\[[IO]$/;

/** Nissewyn's night: the same blue as the mark, cream text, the star's yellow cursor. */
const THEME = {
  background: "#121a2e",
  foreground: "#ece7dc",
  cursor: "#ffd36b",
  cursorAccent: "#121a2e",
  selectionBackground: "#3a4a72",
  black: "#1b2540",
  red: "#e5483b",
  green: "#7cc49a",
  yellow: "#ffd36b",
  blue: "#7aa2f7",
  magenta: "#c49be0",
  cyan: "#6fc6d1",
  white: "#ece7dc",
  brightBlack: "#5b6787",
  brightRed: "#ff6b5e",
  brightGreen: "#9be0b5",
  brightYellow: "#ffe39b",
  brightBlue: "#9dbcff",
  brightMagenta: "#dab8f2",
  brightCyan: "#95dde6",
  brightWhite: "#ffffff",
};

/**
 * One terminal, drawn in the page and sized to it: what the runtime holds,
 * read as it changes, with the person's keys sent straight in.
 */
function LiveTerminal({ id, runtime }: { id: string; runtime: Runtime }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "closed" | "failed">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let term: import("@xterm/xterm").Terminal | null = null;
    let fit: import("@xterm/addon-fit").FitAddon | null = null;
    let observer: ResizeObserver | null = null;
    let state: ReplayState | null = null;
    let replaying = false;
    let closed = false;
    let timer: number | undefined;
    let reading = false;
    let readAgain = false;
    let typedAt = 0;
    let typed = "";
    let flushTimer: number | undefined;
    let resizeTimer: number | undefined;
    let sentSize = "";

    const schedule = (ms?: number) => {
      window.clearTimeout(timer);
      if (!alive || closed) return;
      const since = Date.now() - typedAt;
      timer = window.setTimeout(() => void read(), ms ?? (since < 3000 ? 150 : since < 60_000 ? 400 : 1200));
    };

    const write = (step: ReplayStep) =>
      new Promise<void>((resolve) => {
        if (!term) return resolve();
        if (step.kind === "reset") term.reset();
        if (!step.data) return resolve();
        replaying = true;
        term.write(step.data, () => {
          replaying = false;
          resolve();
        });
      });

    const flush = () => {
      flushTimer = undefined;
      const keys = typed;
      typed = "";
      if (!keys || closed) return;
      runtime.terminalInput(id, keys).then(
        () => alive && schedule(60),
        (failure: unknown) => alive && setError(t("没能把按键送进终端：{message}", { message: errorText(failure) })),
      );
    };

    // The page decides the size; the runtime follows, so programs lay out for what is seen.
    const sync = () => {
      if (!term || !fit || closed) return;
      try {
        fit.fit();
      } catch {
        return;
      }
      const size = `${term.cols}x${term.rows}`;
      if (size === sentSize) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!term) return;
        sentSize = size;
        runtime.resizeTerminal(id, term.cols, term.rows).then(() => alive && schedule(100), () => undefined);
      }, 150);
    };

    const open = async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      if (!alive || !host.current) return;
      const created = new Terminal({
        scrollback: 5000,
        fontSize: 13,
        fontFamily: '"Cascadia Mono", "JetBrains Mono", ui-monospace, Consolas, Menlo, monospace',
        cursorBlink: true,
        convertEol: true,
        theme: THEME,
      });
      const fitter = new FitAddon();
      created.loadAddon(fitter);
      created.open(host.current);
      created.attachCustomKeyEventHandler((event) => {
        if (event.type === "keydown" && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && created.hasSelection()) {
          void navigator.clipboard?.writeText(created.getSelection());
          created.clearSelection();
          return false;
        }
        return true;
      });
      created.onData((data) => {
        if (closed || FOCUS_REPORT.test(data) || (replaying && TERMINAL_REPORT.test(data))) return;
        typed += data;
        typedAt = Date.now();
        if (flushTimer === undefined) flushTimer = window.setTimeout(flush, 15);
      });
      term = created;
      fit = fitter;
      observer = new ResizeObserver(sync);
      observer.observe(host.current);
      sync();
      created.focus();
    };

    const read = async () => {
      if (reading) {
        readAgain = true;
        return;
      }
      reading = true;
      try {
        if (!term) await open();
        if (!term || !alive) return;
        const screen = await runtime.terminalScreen(id, state ? state.line : undefined);
        if (!alive) return;
        const step = state ? continueReplay(state, screen) : startReplay(screen);
        state = step.state;
        await write(step);
        if (step.kind === "reset") term.scrollToBottom();
        setStatus("ready");
        setError(null);
      } catch (failure) {
        if (!alive) return;
        const message = errorText(failure);
        if (/closed|resolve pane|not open/i.test(message) && state) {
          closed = true;
          if (term) term.options.disableStdin = true;
          setStatus("closed");
        } else if (!state) {
          setStatus("failed");
          setError(message);
        } else {
          setError(message);
        }
      } finally {
        reading = false;
      }
      if (readAgain) {
        readAgain = false;
        schedule(0);
      } else {
        schedule();
      }
    };

    void read();
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearTimeout(flushTimer);
      window.clearTimeout(resizeTimer);
      observer?.disconnect();
      term?.dispose();
    };
  }, [id, runtime]);

  return (
    <div className="terminal-page-screen">
      {status === "loading" && (
        <p className="terminal-page-loading">
          <LoaderCircle size={15} className="spin" aria-hidden="true" /> {t("正在连接终端")}
        </p>
      )}
      {status === "failed" && <p className="terminal-page-error">{t("读不到这个终端：{message}", { message: error ?? "" })}</p>}
      {status === "closed" && <p className="terminal-page-note">{t("这个终端已经关了，下面是它最后的样子。")}</p>}
      <div ref={host} className="terminal-page-host" hidden={status === "failed"} />
      {error && status === "ready" && <p className="terminal-page-error">{error}</p>}
    </div>
  );
}
