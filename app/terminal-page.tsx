"use client";

import { Bot, ChevronDown, ChevronUp, LoaderCircle, Plus, Search, SquareTerminal, X } from "lucide-react";
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
};

const errorText = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure));

/**
 * 终端页：人自己的终端就在 Nissewyn 里开、用、关，智能体在用的也在这里接手。
 * Nissewyn 没有独立的终端窗口，终端就是它的一页。
 */
export function TerminalPage({ runtime, notify, focus, newRequest }: TerminalPageProps) {
  const [list, setList] = useState<RuntimeTerminal[] | null>(null);
  const [selected, setSelected] = useState<string | null>(focus ?? null);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const handledNew = useRef<number | undefined>(undefined);
  const [size, setSize] = useState<string | null>(null);

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

  const shellName = (shell?: string) => {
    const base = shell?.split(/[\\/]/).pop()?.replace(/\.exe$/i, "") ?? "";
    return /^pwsh$|^powershell$/i.test(base) ? "PowerShell" : /^cmd$/i.test(base) ? t("命令提示符") : base;
  };
  const name = (item: RuntimeTerminal, index: number) => {
    const place = (item.cwd || item.title)?.trim().split(/[\\/]/).filter(Boolean).pop();
    const shell = shellName(item.shell);
    return [place, shell].filter(Boolean).join(" · ") || t("终端 {n}", { n: index + 1 });
  };

  return (
    <section className="terminal-page" aria-label={t("终端")}>
      <div className="terminal-page-tabs" role="tablist" aria-label={t("开着的终端")}>
        {terminals.map((item, index) => (
          <div key={item.sessionId} className={`terminal-page-tab${item.sessionId === current ? " active" : ""}`}>
            <button
              type="button"
              role="tab"
              aria-selected={item.sessionId === current}
              onClick={() => setSelected(item.sessionId)}
              title={item.agent ? t("智能体正在用的终端：点进去就能直接输入，接手它的工作。") : item.title ?? undefined}
            >
              {item.agent ? <Bot size={14} aria-hidden="true" className="is-agent" /> : <SquareTerminal size={14} aria-hidden="true" />}
              <span>{name(item, index)}</span>
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
          </div>
        ))}
        <button
          type="button"
          className="terminal-page-add"
          onClick={() => void create()}
          disabled={creating}
          aria-label={t("新终端")}
          title={t("新终端")}
        >
          {creating ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
        </button>
        <span className="terminal-page-tabs-gap" />
      </div>

      {loadError && <p className="terminal-page-error">{t("读不到终端列表：{error}", { error: loadError })}</p>}

      {current ? (
        <>
          <LiveTerminal key={current} id={current} runtime={runtime} onSize={setSize} />
          <footer className="terminal-page-status">
            {currentInfo?.agent ? (
              <span className="is-agent">
                <Bot size={12} aria-hidden="true" /> {t("智能体正在用")}
              </span>
            ) : null}
            <span>{shellName(currentInfo?.shell) || t("终端")}</span>
            {size && <span>{size}</span>}
            <span className="terminal-page-status-gap" />
            <span>{t("选中文字后 Ctrl+C 复制")}</span>
          </footer>
        </>
      ) : (
        <div className="terminal-page-empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/nissewyn-mark.png" alt="" width={56} height={56} />
          <p>{t("在这里开一个终端，直接在 Nissewyn 里输入命令。智能体正在用的终端也会出现在上面。")}</p>
          <button type="button" className="terminal-page-new" onClick={() => void create()} disabled={creating}>
            <Plus size={14} aria-hidden="true" />
            {t("新终端")}
          </button>
        </div>
      )}
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

const FONT_KEY = "nissewyn.terminal.fontSize";
const FONT_MIN = 10;
const FONT_MAX = 24;
const FONT_DEFAULT = 13;

function savedFontSize(): number {
  try {
    const value = Number(window.localStorage.getItem(FONT_KEY));
    return value >= FONT_MIN && value <= FONT_MAX ? value : FONT_DEFAULT;
  } catch {
    return FONT_DEFAULT;
  }
}

/**
 * One terminal, drawn in the page and sized to it. Its output arrives as it
 * comes: each read is held open by the runtime until the terminal shows
 * something new. The person's keys go straight in; Ctrl+F searches, Ctrl+=
 * and Ctrl+- change the size, a right click pastes (or copies a selection).
 */
function LiveTerminal({ id, runtime, onSize }: { id: string; runtime: Runtime; onSize?: (size: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searcher = useRef<import("@xterm/addon-search").SearchAddon | null>(null);
  const terminal = useRef<import("@xterm/xterm").Terminal | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "closed" | "failed">("loading");
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [fontSize, setFontSize] = useState(FONT_DEFAULT);
  const fontRef = useRef(FONT_DEFAULT);

  const zoom = useCallback((next: number) => {
    const size = Math.min(FONT_MAX, Math.max(FONT_MIN, next));
    fontRef.current = size;
    setFontSize(size);
    try {
      window.localStorage.setItem(FONT_KEY, String(size));
    } catch {
      // a private window: the size is for this visit only
    }
    if (terminal.current) {
      terminal.current.options.fontSize = size;
      window.dispatchEvent(new Event("nissewyn-terminal-refit"));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let term: import("@xterm/xterm").Terminal | null = null;
    let fit: import("@xterm/addon-fit").FitAddon | null = null;
    let observer: ResizeObserver | null = null;
    let state: ReplayState | null = null;
    let digest: string | undefined;
    let replaying = false;
    let closed = false;
    let typed = "";
    let flushTimer: number | undefined;
    let resizeTimer: number | undefined;
    let sentSize = "";
    const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

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

    const send = (keys: string) => {
      if (!keys || closed) return;
      runtime.terminalInput(id, keys).catch(
        (failure: unknown) => alive && setError(t("没能把按键送进终端：{message}", { message: errorText(failure) })),
      );
    };

    const flush = () => {
      flushTimer = undefined;
      const keys = typed;
      typed = "";
      send(keys);
    };

    // The page decides the size; the runtime follows, so programs lay out for what is seen.
    const sync = () => {
      if (!term || !fit || closed) return;
      try {
        fit.fit();
      } catch {
        return;
      }
      onSize?.(`${term.cols} × ${term.rows}`);
      const size = `${term.cols}x${term.rows}`;
      if (size === sentSize) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!term) return;
        sentSize = size;
        runtime.resizeTerminal(id, term.cols, term.rows).catch(() => undefined);
      }, 150);
    };

    const open = async () => {
      const [{ Terminal }, { FitAddon }, { SearchAddon }, { WebLinksAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-search"),
        import("@xterm/addon-web-links"),
      ]);
      if (!alive || !host.current) return;
      fontRef.current = savedFontSize();
      setFontSize(fontRef.current);
      const created = new Terminal({
        scrollback: 5000,
        fontSize: fontRef.current,
        fontFamily: '"Cascadia Mono", "JetBrains Mono", ui-monospace, Consolas, Menlo, monospace',
        cursorBlink: true,
        convertEol: true,
        allowProposedApi: true,
        theme: THEME,
      });
      const fitter = new FitAddon();
      const finder = new SearchAddon();
      created.loadAddon(fitter);
      created.loadAddon(finder);
      created.loadAddon(new WebLinksAddon((_event, uri) => window.open(uri, "_blank", "noopener")));
      created.open(host.current);
      created.attachCustomKeyEventHandler((event) => {
        if (event.type !== "keydown") return true;
        const mod = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (mod && key === "c" && created.hasSelection()) {
          void navigator.clipboard?.writeText(created.getSelection());
          created.clearSelection();
          return false;
        }
        if (mod && key === "f") {
          setSearching(true);
          window.setTimeout(() => searchInput.current?.select(), 0);
          return false;
        }
        if (mod && (key === "=" || key === "+")) {
          zoom(fontRef.current + 1);
          return false;
        }
        if (mod && key === "-") {
          zoom(fontRef.current - 1);
          return false;
        }
        if (mod && key === "0") {
          zoom(FONT_DEFAULT);
          return false;
        }
        return true;
      });
      created.onData((data) => {
        if (closed || FOCUS_REPORT.test(data) || (replaying && TERMINAL_REPORT.test(data))) return;
        typed += data;
        if (flushTimer === undefined) flushTimer = window.setTimeout(flush, 12);
      });
      // A right click pastes; with text selected it copies, as in Windows Terminal.
      host.current.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (created.hasSelection()) {
          void navigator.clipboard?.writeText(created.getSelection());
          created.clearSelection();
          return;
        }
        void navigator.clipboard?.readText().then((text) => text && send(text), () => undefined);
      });
      term = created;
      terminal.current = created;
      fit = fitter;
      searcher.current = finder;
      observer = new ResizeObserver(sync);
      observer.observe(host.current);
      window.addEventListener("nissewyn-terminal-refit", sync);
      sync();
      created.focus();
    };

    const follow = async () => {
      await open();
      while (alive && !closed && term) {
        try {
          const screen = await runtime.terminalScreen(
            id,
            state ? state.line : undefined,
            state && digest ? { known: digest, waitMs: 10_000 } : undefined,
          );
          if (!alive) return;
          const step = state ? continueReplay(state, screen) : startReplay(screen);
          state = step.state;
          await write(step);
          if (step.kind === "reset") term.scrollToBottom();
          setStatus("ready");
          setError(null);
          // An older runtime has no digest to wait on: ask now and then instead.
          if (!screen.digest) await sleep(400);
          digest = screen.digest;
        } catch (failure) {
          if (!alive) return;
          const message = errorText(failure);
          if (/closed|resolve pane|not open/i.test(message) && state) {
            closed = true;
            term.options.disableStdin = true;
            setStatus("closed");
            return;
          }
          if (!state) {
            setStatus("failed");
            setError(message);
            return;
          }
          setError(message);
          await sleep(1500);
        }
      }
    };

    void follow();
    return () => {
      alive = false;
      window.clearTimeout(flushTimer);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("nissewyn-terminal-refit", sync);
      observer?.disconnect();
      term?.dispose();
      terminal.current = null;
      searcher.current = null;
    };
    // onSize is a state setter and zoom is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, runtime]);

  const find = (backwards: boolean) => {
    if (!query) return;
    const options = { decorations: { matchOverviewRuler: "#ffd36b", activeMatchColorOverviewRuler: "#ffd36b", matchBackground: "#3a4a72", activeMatchBackground: "#8a6d1f" } };
    if (backwards) searcher.current?.findPrevious(query, options);
    else searcher.current?.findNext(query, options);
  };

  return (
    <div className="terminal-page-screen">
      {status === "loading" && (
        <p className="terminal-page-loading">
          <LoaderCircle size={15} className="spin" aria-hidden="true" /> {t("正在连接终端")}
        </p>
      )}
      {status === "failed" && <p className="terminal-page-error">{t("读不到这个终端：{message}", { message: error ?? "" })}</p>}
      {status === "closed" && <p className="terminal-page-note">{t("这个终端已经关了，下面是它最后的样子。")}</p>}
      {searching && (
        <div className="terminal-page-search" role="search">
          <Search size={13} aria-hidden="true" />
          <input
            ref={searchInput}
            value={query}
            placeholder={t("在终端里查找")}
            aria-label={t("在终端里查找")}
            onChange={(event) => {
              setQuery(event.target.value);
              if (event.target.value) searcher.current?.findNext(event.target.value, { incremental: true });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") find(event.shiftKey);
              if (event.key === "Escape") {
                setSearching(false);
                searcher.current?.clearDecorations();
                terminal.current?.focus();
              }
            }}
          />
          <button type="button" onClick={() => find(true)} aria-label={t("上一个")} title={t("上一个")}>
            <ChevronUp size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => find(false)} aria-label={t("下一个")} title={t("下一个")}>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSearching(false);
              searcher.current?.clearDecorations();
              terminal.current?.focus();
            }}
            aria-label={t("关闭查找")}
            title={t("关闭查找")}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      <div ref={host} className="terminal-page-host" hidden={status === "failed"} />
      {error && status === "ready" && <p className="terminal-page-error">{error}</p>}
      <div className="terminal-page-zoom" aria-label={t("字号")}>
        <button type="button" onClick={() => zoom(fontSize - 1)} disabled={fontSize <= FONT_MIN} aria-label={t("字小一点")} title={t("字小一点（Ctrl+-）")}>
          A−
        </button>
        <span>{fontSize}</span>
        <button type="button" onClick={() => zoom(fontSize + 1)} disabled={fontSize >= FONT_MAX} aria-label={t("字大一点")} title={t("字大一点（Ctrl+=）")}>
          A+
        </button>
        <button
          type="button"
          onClick={() => {
            setSearching(true);
            window.setTimeout(() => searchInput.current?.select(), 0);
          }}
          aria-label={t("在终端里查找")}
          title={t("在终端里查找（Ctrl+F）")}
        >
          <Search size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
