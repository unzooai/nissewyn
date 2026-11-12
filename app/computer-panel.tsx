"use client";

import { ExternalLink, Globe2, LoaderCircle, Monitor, SquareTerminal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "./i18n";
import type { TabView, TerminalScreen } from "./lib/provider";
import { trimScreen } from "./lib/conversation";

export type ComputerPanelProps = {
  terminals: string[];
  tabs: string[];
  /** 这段对话有一轮还在跑：画面持续刷新。 */
  live: boolean;
  loadScreen: (sessionId: string) => Promise<TerminalScreen>;
  loadTab: (tabId: string) => Promise<TabView>;
  /** 在 Unzoo One 终端里打开这个会话，人来接手。 */
  onOpenTerminal: (sessionId: string) => Promise<void>;
  /** 把标签页切到 Unzoo 浏览器前台。 */
  onShowTab: (tabId: string) => Promise<void>;
  onClose: () => void;
};

type Selection = { kind: "terminal" | "tab"; id: string };

/**
 * 智能体的电脑：它在用的终端和浏览器，就在对话旁边。
 *
 * 只读地看：终端是屏幕上的字，浏览器是截图。要动手就点“在终端里打开”或
 * “在浏览器里打开”，到真正的窗口里接手 —— 在这里模拟一个可输入的终端或
 * 可点击的网页，只会是个不完整的替身。
 */
export function ComputerPanel(props: ComputerPanelProps) {
  const { terminals, tabs, live, onClose } = props;
  const latest: Selection | null = tabs.length
    ? { kind: "tab", id: tabs[tabs.length - 1] }
    : terminals.length
      ? { kind: "terminal", id: terminals[terminals.length - 1] }
      : null;
  const [selected, setSelected] = useState<Selection | null>(latest);

  // 选中的不在了（换了对话），或者还没选，就跟着最新用到的那个。
  const current =
    selected &&
    ((selected.kind === "terminal" && terminals.includes(selected.id)) || (selected.kind === "tab" && tabs.includes(selected.id)))
      ? selected
      : latest;

  return (
    <aside className="computer-panel" aria-label={t("智能体的电脑")}>
      <header>
        <strong>
          <Monitor size={15} aria-hidden="true" /> {t("智能体的电脑")}
        </strong>
        {live && <em>{t("实时")}</em>}
        <button type="button" onClick={onClose} aria-label={t("收起")} title={t("收起")}>
          <X size={15} aria-hidden="true" />
        </button>
      </header>

      {!current ? (
        <p className="computer-empty">{t("这段对话里智能体还没有用过终端或浏览器。它一用，就会出现在这里。")}</p>
      ) : (
        <>
          <nav className="computer-tabs" aria-label={t("它用过的终端和网页")}>
            {terminals.map((id, index) => (
              <button
                key={`t-${id}`}
                type="button"
                className={current.kind === "terminal" && current.id === id ? "active" : ""}
                onClick={() => setSelected({ kind: "terminal", id })}
              >
                <SquareTerminal size={14} aria-hidden="true" />
                {terminals.length > 1 ? t("终端 {n}", { n: index + 1 }) : t("终端")}
              </button>
            ))}
            {tabs.map((id, index) => (
              <button
                key={`b-${id}`}
                type="button"
                className={current.kind === "tab" && current.id === id ? "active" : ""}
                onClick={() => setSelected({ kind: "tab", id })}
              >
                <Globe2 size={14} aria-hidden="true" />
                {tabs.length > 1 ? t("网页 {n}", { n: index + 1 }) : t("网页")}
              </button>
            ))}
          </nav>
          {current.kind === "terminal" ? (
            <TerminalView key={current.id} id={current.id} {...props} />
          ) : (
            <BrowserView key={current.id} id={current.id} {...props} />
          )}
        </>
      )}
    </aside>
  );
}

/** 每隔一会儿读一次，还在跑时才持续读。 */
function usePolled<T>(load: () => Promise<T>, everyMs: number, live: boolean) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () =>
      load().then(
        (next) => {
          if (!alive) return;
          setValue(next);
          setError(null);
        },
        (failure: unknown) => {
          if (alive) setError(failure instanceof Error ? failure.message : String(failure));
        },
      );
    void read();
    const timer = live ? window.setInterval(() => void read(), everyMs) : undefined;
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
    // load 每次渲染都是新的；换了对象（id）由 key 重建组件。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyMs, live]);
  return { value, error };
}

function TerminalView({ id, live, loadScreen, onOpenTerminal }: ComputerPanelProps & { id: string }) {
  const { value, error } = usePolled(() => loadScreen(id), 1500, live);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const lines = value ? trimScreen(value.lines) : [];
  return (
    <div className="computer-view">
      {error && !value ? (
        <p className="computer-error">{t("读不到这个终端：{message}", { message: error })}</p>
      ) : !value ? (
        <p className="computer-loading">
          <LoaderCircle size={15} className="spin" aria-hidden="true" /> {t("正在读取")}
        </p>
      ) : (
        <pre className="computer-terminal" aria-label={t("终端画面")}>
          {lines.length ? lines.join("\n") : t("（屏幕是空的）")}
        </pre>
      )}
      <footer>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setActionError(null);
            onOpenTerminal(id)
              .catch((failure: unknown) => setActionError(failure instanceof Error ? failure.message : String(failure)))
              .finally(() => setBusy(false));
          }}
        >
          <ExternalLink size={14} aria-hidden="true" />
          {t("在终端里打开")}
        </button>
        <small>{t("在终端窗口里可以直接输入，接手它正在做的事。")}</small>
      </footer>
      {actionError && <p className="computer-error">{actionError}</p>}
    </div>
  );
}

function BrowserView({ id, live, loadTab, onShowTab }: ComputerPanelProps & { id: string }) {
  const { value, error } = usePolled(() => loadTab(id), 3000, live);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  return (
    <div className="computer-view">
      {value && (
        <div className="computer-address" title={value.url}>
          <Globe2 size={13} aria-hidden="true" />
          <span>{value.title || value.url || t("（没有标题）")}</span>
          {value.url && value.title && <small>{value.url}</small>}
        </div>
      )}
      {error && !value ? (
        <p className="computer-error">{t("读不到这个网页：{message}", { message: error })}</p>
      ) : !value ? (
        <p className="computer-loading">
          <LoaderCircle size={15} className="spin" aria-hidden="true" /> {t("正在读取")}
        </p>
      ) : value.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="computer-shot" src={value.image} alt={t("智能体看到的网页")} />
      ) : (
        <p className="computer-empty">{t("这个网页没有截到图。")}</p>
      )}
      <footer>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setActionError(null);
            onShowTab(id)
              .catch((failure: unknown) => setActionError(failure instanceof Error ? failure.message : String(failure)))
              .finally(() => setBusy(false));
          }}
        >
          <ExternalLink size={14} aria-hidden="true" />
          {t("在浏览器里打开")}
        </button>
        <small>{t("要登录、过验证码或自己点几下，就在浏览器里接手。")}</small>
      </footer>
      {actionError && <p className="computer-error">{actionError}</p>}
    </div>
  );
}
