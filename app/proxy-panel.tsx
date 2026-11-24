"use client";

import { Globe2, Network, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { t } from "./i18n";
import type { RuntimeProxy, RuntimeProxyMode, RuntimeTaskPort } from "./lib/provider";

const modes: RuntimeProxyMode[] = ["off", "auto", "manual"];

function modeName(mode: RuntimeProxyMode): string {
  if (mode === "off") return t("不用代理");
  if (mode === "auto") return t("跟随系统代理");
  return t("手动填写");
}

function modeDetail(mode: RuntimeProxyMode): string {
  if (mode === "off") return t("程序直接上网。");
  if (mode === "auto") return t("用这台电脑开着的代理（Clash、V2Ray 等设的系统代理），它换了这里也跟着换。");
  return t("用你填的地址，例如公司给的代理。");
}

const PROXY_URL = /^(https?|socks5h?|socks4a?):\/\/[^\s/]+(:\d+)?\/?$/i;

/** A wrong address, or null when it is fine (empty is fine: that kind is not used). */
function addressProblem(value: string, kinds: string): string | null {
  const text = value.trim();
  if (!text || PROXY_URL.test(text)) return null;
  return t("“{value}”不像代理地址，应该是 {kinds}", { value: text, kinds });
}

/**
 * 设置 › 偏好 › 网络代理：整个 Nissewyn 的代理。
 *
 * 后台服务启动的一切都走它：终端、智能体、插件，以及它们再启动的 git、npm、pip、
 * 模型命令行。本机地址永远直连（浏览器、插件和后台服务之间就是这么说话的）。
 * 开了但代理软件没在运行时不会把程序送进死端口：它们直接上网，页面上会说。
 * Unzoo 浏览器有自己的线路，在它的账号环境里设，不归这里管。
 */
export function ProxyPanel({
  runtime,
  notify,
}: {
  runtime: Pick<RuntimeTaskPort, "proxy" | "setProxy">;
  notify: (message: string) => void;
}) {
  const [data, setData] = useState<RuntimeProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<RuntimeProxyMode>("off");
  const [http, setHttp] = useState("");
  const [socks, setSocks] = useState("");
  const [noProxy, setNoProxy] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await runtime.proxy();
      setData(next);
      setMode(next.mode);
      // Manual starts from what is in use now: usually the system's own proxy.
      setHttp(next.http || next.detected?.http || "");
      setSocks(next.socks || next.detected?.socks || "");
      setNoProxy(next.noProxy === "localhost,127.0.0.1,::1" ? "" : next.noProxy);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }, [runtime]);

  useEffect(() => {
    void load();
  }, [load]);

  const problem =
    mode === "manual"
      ? addressProblem(http, t("http://主机:端口")) ??
        addressProblem(socks, t("socks5://主机:端口")) ??
        (!http.trim() && !socks.trim() ? t("至少填一个代理地址。") : null)
      : null;
  const changed =
    !!data &&
    (mode !== data.mode ||
      (mode === "manual" &&
        (http.trim() !== data.http || socks.trim() !== data.socks || noProxy.trim() !== (data.noProxy === "localhost,127.0.0.1,::1" ? "" : data.noProxy))));

  async function save() {
    if (problem) return;
    setBusy(true);
    try {
      await runtime.setProxy(mode === "manual" ? { mode, http, socks, noProxy } : { mode });
      notify(t("代理已改为“{mode}”。新开的终端、智能体和重启后的插件会用上。", { mode: modeName(mode) }));
      await load();
    } catch (failure) {
      notify(t("没有保存：{error}", { error: failure instanceof Error ? failure.message : String(failure) }));
    } finally {
      setBusy(false);
    }
  }

  function inUse(): string {
    if (!data) return "";
    if (data.mode === "off") return t("现在不用代理，程序直接上网。");
    const url = data.applied.http || data.applied.socks;
    if (url) return t("现在启动的程序走 {url}。", { url });
    return data.mode === "auto"
      ? t("没找到开着的代理：这台电脑没设系统代理，常用端口（7890、7897 等）上也没有代理软件。程序先直接上网，代理软件开了以后会自动用上。")
      : t("填的代理现在连不上，程序先直接上网，免得断网。代理软件开了以后会自动用上。");
  }

  return (
    <div className="settings-group proxy-group" id="settings-proxy">
      <div className="skills-heading">
        <span>{t("网络代理")}</span>
        <h2>{t("Nissewyn 怎么上网")}</h2>
        <button type="button" onClick={() => void load()} aria-label={t("重新检查")} title={t("重新检查")} disabled={busy}>
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>
      <p className="skills-intro">
        {t("这是整个应用的代理：终端、智能体、插件，以及它们启动的 git、npm、pip、模型命令行都走它。本机地址（localhost、127.0.0.1）始终直连。Unzoo 浏览器有自己的线路，在它的账号环境里设置。")}
      </p>

      {error ? (
        <p className="skills-empty">{t("读不到代理设置：{error}", { error })}</p>
      ) : !data ? (
        <p className="skills-empty">{t("正在读取…")}</p>
      ) : (
        <form
          className="proxy-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="agent-autonomy-options" role="radiogroup" aria-label={t("网络代理")}>
            {modes.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                className={mode === option ? "active" : ""}
                onClick={() => setMode(option)}
              >
                <strong>{modeName(option)}</strong>
                <small>{modeDetail(option)}</small>
              </button>
            ))}
          </div>

          {mode === "auto" && (
            <p className="proxy-note">
              <Globe2 size={14} aria-hidden="true" />
              {data.detected?.http || data.detected?.socks
                ? t("这台电脑现在的代理：{url}", { url: (data.detected.http || data.detected.socks) as string })
                : t("这台电脑现在没有开代理。")}
            </p>
          )}

          {mode === "manual" && (
            <div className="proxy-fields">
              <label>
                <strong>{t("HTTP 代理")}</strong>
                <span className="agent-run-input">
                  <input
                    type="text"
                    value={http}
                    spellCheck={false}
                    placeholder="http://127.0.0.1:7890"
                    aria-label={t("HTTP 代理")}
                    onChange={(event) => setHttp(event.target.value)}
                  />
                </span>
              </label>
              <label>
                <strong>{t("SOCKS5 代理（可不填）")}</strong>
                <span className="agent-run-input">
                  <input
                    type="text"
                    value={socks}
                    spellCheck={false}
                    placeholder="socks5://127.0.0.1:7891"
                    aria-label={t("SOCKS5 代理（可不填）")}
                    onChange={(event) => setSocks(event.target.value)}
                  />
                </span>
              </label>
              <label>
                <strong>{t("这些地址不走代理（可不填）")}</strong>
                <span className="agent-run-input">
                  <input
                    type="text"
                    value={noProxy}
                    spellCheck={false}
                    placeholder={t("例如 .corp.example, intranet")}
                    aria-label={t("这些地址不走代理（可不填）")}
                    onChange={(event) => setNoProxy(event.target.value)}
                  />
                </span>
              </label>
            </div>
          )}

          {problem && <p className="proxy-problem">{problem}</p>}

          <div className="proxy-footer">
            <p className="proxy-note">
              <Network size={14} aria-hidden="true" />
              {inUse()}
            </p>
            <button type="submit" disabled={busy || !changed || !!problem}>
              {t("保存")}
            </button>
          </div>
          <small className="proxy-hint">
            {t("已经开着的终端和插件不受影响：新开的终端会用上，插件在“插件”页重启一下。")}
          </small>
        </form>
      )}
    </div>
  );
}
