"use client";

import { Building2, LogIn, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { dateLocale, t } from "./i18n";
import {
  orgDismissRemoved,
  orgError,
  orgJoin,
  orgLeave,
  orgRefresh,
  orgSsoBegin,
  orgSsoCancel,
  orgSsoWait,
  orgStatus,
  type OrgError,
  type OrgStatus,
} from "./lib/core-connection";

/** How often an open page asks the server whether this computer is still in. */
const RECHECK_MS = 10 * 60 * 1000;

/**
 * 设置 › 组织（只在桌面版里）。
 *
 * 公司自己部署了 Nissewyn Server（企业版）时，这台电脑在这里加入：填服务器
 * 地址，然后用公司账号登录（系统浏览器里），或者填管理员给的加入码。设备
 * 密钥在系统的密钥库里，服务器只有公钥；公司拿不到模型账号、浏览器登录和
 * 密码。被管理员移出后回到“未加入”，说一次。
 */
export function OrganizationPanel({ notify }: { notify: (message: string) => void }) {
  const [status, setStatus] = useState<OrgStatus | null>(null);
  const [error, setError] = useState<OrgError | null>(null);
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState("");
  const [code, setCode] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  /** The sign-in page's address while the browser is out signing in. */
  const [signingIn, setSigningIn] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const known = await orgStatus();
      setStatus(known);
      if (known.membership) setStatus(await orgRefresh());
    } catch (failure) {
      setError(orgError(failure));
    }
  }, []);

  useEffect(() => {
    void check();
    const again = setInterval(() => void check(), RECHECK_MS);
    return () => clearInterval(again);
  }, [check]);

  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      setError(orgError(failure));
    } finally {
      setBusy(false);
    }
  }

  const join = () =>
    act(async () => {
      const joined = await orgJoin(server, code);
      setStatus(joined);
      setCode("");
      notify(t("这台电脑已加入 {name}", { name: joined.membership?.organization.name ?? "" }));
    });

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      setSigningIn(await orgSsoBegin(server));
      setBusy(false);
      const joined = await orgSsoWait({
        done: t("已登录。可以关掉这个页面，回到 Nissewyn。"),
        failed: t("没有登录成功。回到 Nissewyn 看原因。"),
      });
      setStatus(joined);
      setCode("");
      notify(t("这台电脑已加入 {name}", { name: joined.membership?.organization.name ?? "" }));
    } catch (failure) {
      const problem = orgError(failure);
      if (problem.code !== "sso_cancelled") setError(problem);
    } finally {
      setBusy(false);
      setSigningIn(null);
    }
  }

  const refresh = () =>
    act(async () => {
      setStatus(await orgRefresh());
    });

  const leave = () =>
    act(async () => {
      const name = status?.membership?.organization.name ?? "";
      const left = await orgLeave();
      setStatus(left.status);
      setConfirmLeave(false);
      notify(
        left.server_not_told
          ? t("已离开 {name}。服务器没连上，请让管理员在后台移除这台电脑。", { name })
          : t("已离开 {name}", { name }),
      );
    });

  const membership = status?.membership;
  const removed = status?.removed;

  return (
    <section className="settings-group proxy-group org-group" id="settings-organization" aria-label={t("组织")}>
      <div className="skills-heading">
        <span>{t("组织")}</span>
        <h2>{membership ? t("已加入 {name}", { name: membership.organization.name }) : t("加入公司的 Nissewyn")}</h2>
        {membership && (
          <button type="button" onClick={() => void refresh()} aria-label={t("重新检查")} title={t("重新检查")} disabled={busy}>
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="skills-intro">
        {t("公司自己部署了 Nissewyn Server 时，在这里加入。加入后，公司可以为这台电脑设定智能体的规则，并保存操作记录的副本。公司拿不到你的模型账号、浏览器登录和密码。")}
      </p>

      {removed && (
        <div className="org-removed" role="status">
          <p>
            {t("{name} 的管理员已把这台电脑移出组织（{when}）。要重新加入，请用公司账号再登录一次，或向管理员要一个新的加入码。", {
              name: removed.organization,
              when: formatWhen(removed.at),
            })}
          </p>
          <button type="button" disabled={busy} onClick={() => void act(async () => setStatus(await orgDismissRemoved()))}>
            {t("知道了")}
          </button>
        </div>
      )}

      {!status ? (
        error ? <p className="skills-empty">{explain(error)}</p> : <p className="skills-empty">{t("正在读取…")}</p>
      ) : membership ? (
        <>
          <ul className="clients-list">
            <li>
              <Building2 size={15} aria-hidden="true" />
              <span>
                <strong>{membership.organization.name}</strong>
                <small>
                  {t("服务器：{server}", { server: membership.server })}
                  {" · "}
                  {t("这台电脑：{name}", { name: membership.device_name })}
                </small>
                <small>
                  {membership.user && (
                    <>
                      {t("登录为 {who}", { who: membership.user.email ?? membership.user.name ?? "" })}
                      {" · "}
                    </>
                  )}
                  {t("加入于 {when}", { when: formatWhen(membership.joined_at) })}
                  {" · "}
                  {membership.last_contact
                    ? t("最近确认：{when}", { when: formatWhen(membership.last_contact) })
                    : t("还没和服务器确认过")}
                </small>
              </span>
            </li>
          </ul>
          {membership.problem && <p className="proxy-problem">{explain(membership.problem)}</p>}
          {error && <p className="proxy-problem">{explain(error)}</p>}
          <div className="phone-actions">
            {confirmLeave ? (
              <>
                <span>{t("离开后，公司的规则不再用于这台电脑。确定离开 {name}？", { name: membership.organization.name })}</span>
                <button type="button" className="primary" disabled={busy} onClick={() => void leave()}>
                  {t("离开")}
                </button>
                <button type="button" disabled={busy} onClick={() => setConfirmLeave(false)}>
                  {t("取消")}
                </button>
              </>
            ) : (
              <button type="button" disabled={busy} onClick={() => setConfirmLeave(true)}>
                {t("离开组织")}
              </button>
            )}
          </div>
        </>
      ) : signingIn ? (
        <div className="org-signing-in" role="status">
          <p>{t("已在浏览器里打开公司的登录页。登录后，这里会自动完成加入。")}</p>
          <p className="proxy-note">{t("浏览器没有打开？把这个地址复制到浏览器里：")}</p>
          <code className="org-sign-in-url">{signingIn}</code>
          <div className="phone-actions">
            <button type="button" onClick={() => void orgSsoCancel()}>
              {t("取消")}
            </button>
          </div>
        </div>
      ) : (
        <form
          className="proxy-form"
          onSubmit={(event) => {
            event.preventDefault();
            void join();
          }}
        >
          <div className="proxy-fields">
            <label>
              <strong>{t("服务器地址")}</strong>
              <span className="agent-run-input">
                <input
                  type="text"
                  value={server}
                  onChange={(event) => setServer(event.target.value)}
                  placeholder="nissewyn.example.com"
                  aria-label={t("服务器地址")}
                  autoComplete="url"
                  spellCheck={false}
                  disabled={busy}
                />
              </span>
            </label>
            <label>
              <strong>{t("加入码（不用公司账号时）")}</strong>
              <span className="agent-run-input">
                <input
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="K7QM-2XFD-9RWA-HT4B"
                  aria-label={t("加入码")}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                />
              </span>
            </label>
          </div>
          {error && <p className="proxy-problem">{explain(error)}</p>}
          <div className="proxy-footer">
            <p className="proxy-note">
              <Building2 size={14} aria-hidden="true" />
              {t("服务器地址向公司的 IT 管理员要。公司开了单点登录时，用公司账号登录就行；否则填管理员给的加入码。")}
            </p>
            <button type="button" className="primary" disabled={busy || !server.trim()} onClick={() => void signIn()}>
              <LogIn size={14} aria-hidden="true" />
              {t("用公司账号登录")}
            </button>
            <button type="submit" disabled={busy || !server.trim() || !code.trim()}>
              {busy ? t("正在加入…") : t("用加入码加入")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/** A failure in the person's language; the server's or system's own words follow where they help. */
export function explain(error: OrgError): string {
  const detail = error.detail;
  switch (error.code) {
    case "server_missing":
      return t("先填公司服务器的地址");
    case "server_unreadable":
      return t("这个地址读不懂：{detail}", { detail });
    case "https_required":
      return t("公司服务器要用 https 地址；http 只能用于这台电脑上的测试服务器");
    case "unreachable":
      return t("连不上这个服务器：{detail}", { detail });
    case "not_nissewyn":
      return t("这个地址上不是 Nissewyn Server（{detail}）", { detail });
    case "protocol_mismatch":
      if (detail === "server") return t("服务器的版本比这台电脑的 Nissewyn 旧，请管理员更新 Nissewyn Server");
      if (detail === "desktop") return t("这台电脑的 Nissewyn 比服务器旧，请先更新 Nissewyn");
      return t("这台电脑和服务器的版本对不上：{detail}", { detail });
    case "server_degraded":
      return t("服务器连上了，但它的数据库没有就绪（{detail}），请告诉管理员", { detail });
    case "code_missing":
      return t("填上管理员给的加入码");
    case "bad_join_code":
      return t("加入码不对，或者已经用完、过期、被收回。请向管理员要一个新的。");
    case "key_in_use":
      return t("这把设备密钥已经加入过，请再试一次");
    case "key_store":
      return t("没能使用系统的密钥库：{detail}", { detail });
    case "key_missing":
      return t("系统密钥库里找不到这台电脑的设备密钥，没法向服务器证明身份。请离开组织后重新加入。");
    case "already_joined":
      return t("这台电脑已经加入了一个组织，先离开它");
    case "device_refused":
      if (/clock/i.test(detail)) return t("这台电脑的时间和服务器差了 5 分钟以上。请在系统设置里打开“自动设置时间”后再试。");
      return t("服务器没有接受这台电脑的请求：{detail}", { detail });
    case "not_saved":
      return t("没能保存：{detail}", { detail });
    case "server_error":
      return t("服务器出错了：{detail}", { detail });
    case "sso_off":
      return t("这个服务器没有开单点登录，请用管理员给的加入码");
    case "sso_failed":
      return detail
        ? t("没有登录成功：{detail}", { detail })
        : t("没有登录成功，请再试一次");
    case "sso_timeout":
      return t("等了 10 分钟还没有登录完成，请再试一次");
    case "bad_sso_code":
      return t("这次登录已经过期，请再登录一次");
    case "sso_not_started":
      return t("登录没有开始，请再点一次“用公司账号登录”");
    case "desktop_only":
      return t("只有 Nissewyn 桌面版能加入组织");
    default:
      return detail || error.code;
  }
}

function formatWhen(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(dateLocale(), {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
