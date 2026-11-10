"use client";

import { FolderOpen, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  readAgentRunSettings,
  writeAgentRunSettings,
  type AgentRunSettings,
} from "./lib/agent-run-settings";
import type { AgentRule, AgentRulePort } from "./lib/provider";

/**
 * 设置 › 智能体：任务交给 agent 时在哪个目录跑、是否受管，以及托管会话的
 * 常设规则。
 *
 * 规则只能由人在这里加（或审批时勾"记住"）—— agent 没有任何途径给自己加。
 */
export function AgentRunPanel({
  rules: rulePort,
  notify,
}: {
  rules: AgentRulePort;
  notify: (message: string) => void;
}) {
  const [settings, setSettings] = useState<AgentRunSettings>({ cwd: "", governed: true });
  const [cwdDraft, setCwdDraft] = useState("");
  const [rules, setRules] = useState<AgentRule[]>([]);
  const [store, setStore] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tool, setTool] = useState("Bash");
  const [prefix, setPrefix] = useState("");
  const [decision, setDecision] = useState<"allow" | "deny">("deny");
  const [scoped, setScoped] = useState(true);
  const [busy, setBusy] = useState(false);

  // 存储只在浏览器里有，挂载后再读，免得和服务端渲染的首屏对不上。
  useEffect(() => {
    const stored = readAgentRunSettings();
    setSettings(stored);
    setCwdDraft(stored.cwd);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await rulePort.list();
      setRules(data.rules);
      setStore(data.store);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [rulePort]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function save(next: AgentRunSettings, message: string) {
    setSettings(next);
    notify(writeAgentRunSettings(next) ? message : `${message}（这个浏览器不能保存设置，刷新后会恢复默认）`);
  }

  function saveCwd() {
    const cwd = cwdDraft.trim();
    if (cwd === settings.cwd) return;
    save({ ...settings, cwd }, cwd ? `智能体的工作目录已设为 ${cwd}` : "已清除智能体的工作目录");
  }

  async function addRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tool.trim() || busy) return;
    if (scoped && !settings.cwd) {
      notify("先设好工作目录，或者取消“只在工作目录里生效”");
      return;
    }
    setBusy(true);
    try {
      const rule = await rulePort.add({
        tool: tool.trim(),
        commandPrefix: prefix.trim() || undefined,
        decision,
        workspace: scoped ? settings.cwd : undefined,
      });
      setRules((items) => [...items, rule]);
      setPrefix("");
      notify(`已添加规则：${describeRule(rule)}`);
    } catch (error) {
      notify(`没能添加规则：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeRule(rule: AgentRule) {
    setBusy(true);
    try {
      await rulePort.remove(rule.id);
      setRules((items) => items.filter((item) => item.id !== rule.id));
      notify(`已删除规则：${describeRule(rule)}`);
    } catch (error) {
      notify(`没能删除规则：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-group agent-run-group" id="settings-agents">
      <div>
        <span>智能体执行</span>
        <h2>工作目录、受管模式与常设规则</h2>
      </div>

      <form
        className="setting-row agent-run-cwd"
        onSubmit={(event) => {
          event.preventDefault();
          saveCwd();
        }}
      >
        <span>
          <strong>工作目录</strong>
          <small>任务交给智能体后，它在这个目录里读写文件、执行命令。留空则用 Unterm 自己的目录。</small>
          <span className="agent-run-input">
            <FolderOpen size={14} aria-hidden="true" />
            <input
              type="text"
              value={cwdDraft}
              spellCheck={false}
              placeholder="例如 C:\code\my-project"
              aria-label="智能体的工作目录"
              onChange={(event) => setCwdDraft(event.target.value)}
              onBlur={saveCwd}
            />
          </span>
        </span>
        <button type="submit" disabled={cwdDraft.trim() === settings.cwd}>
          保存
        </button>
      </form>

      <label className="setting-row">
        <span>
          <strong>受管模式</strong>
          <small>
            关掉 Claude Code 自带的 Bash、PowerShell 和联网工具，命令只能经 Unterm 执行，每一步都先进收件箱。
            其它智能体不支持受管，会以托管模式运行：用自己的工具，但同样逐条等你批准。
          </small>
        </span>
        <button
          className={`switch-control ${settings.governed ? "on" : ""}`}
          type="button"
          role="switch"
          aria-checked={settings.governed}
          aria-label="受管模式"
          onClick={() =>
            save(
              { ...settings, governed: !settings.governed },
              settings.governed ? "已改为托管模式" : "已改为受管模式",
            )
          }
        >
          <i />
        </button>
      </label>

      <section className="agent-rules" aria-label="常设规则">
        <header>
          <span>
            <strong>常设规则</strong>
            <small>
              命中的工具调用不再进收件箱，直接放行或拒绝。只有人能定规则；放行规则不会匹配拼接命令（&&、|、重定向）。
            </small>
          </span>
          <button type="button" aria-label="刷新规则" title="刷新规则" onClick={() => void reload()} disabled={loading}>
            <RefreshCw size={14} className={loading ? "is-spinning" : undefined} />
          </button>
        </header>

        {loadError ? (
          <p className="agent-rules-empty">读取规则失败：{loadError}</p>
        ) : rules.length === 0 ? (
          <p className="agent-rules-empty">{loading ? "正在读取…" : "还没有规则。每次工具调用都会进收件箱。"}</p>
        ) : (
          <ul>
            {rules.map((rule) => (
              <li key={rule.id} data-rule-id={rule.id}>
                <em className={rule.decision === "allow" ? "is-allow" : "is-deny"}>
                  {rule.decision === "allow" ? "放行" : "拒绝"}
                </em>
                <span>
                  <code>
                    {rule.tool}
                    {rule.commandPrefix ? ` · ${rule.commandPrefix}` : ""}
                  </code>
                  <small>
                    {rule.workspace ? `只在 ${rule.workspace}` : "所有工作区"}
                    {" · "}
                    {rule.createdBy === "remember" ? "审批时记住" : "在设置里添加"}
                  </small>
                </span>
                <button
                  type="button"
                  aria-label={`删除规则 ${describeRule(rule)}`}
                  title="删除规则"
                  disabled={busy}
                  onClick={() => void removeRule(rule)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="agent-rule-form" onSubmit={addRule}>
          <select aria-label="规则的决定" value={decision} onChange={(event) => setDecision(event.target.value as "allow" | "deny")}>
            <option value="deny">拒绝</option>
            <option value="allow">放行</option>
          </select>
          <input
            type="text"
            aria-label="工具名"
            placeholder="工具，如 Bash"
            value={tool}
            spellCheck={false}
            onChange={(event) => setTool(event.target.value)}
          />
          <input
            type="text"
            aria-label="命令前缀"
            placeholder="命令前缀（可选），如 git push"
            value={prefix}
            spellCheck={false}
            onChange={(event) => setPrefix(event.target.value)}
          />
          <label>
            <input type="checkbox" checked={scoped} onChange={(event) => setScoped(event.target.checked)} />
            只在工作目录里生效
          </label>
          <button type="submit" disabled={busy || !tool.trim()}>
            <Plus size={14} />
            添加
          </button>
        </form>
        {store && (
          <small className="agent-rules-store">
            <ShieldCheck size={12} aria-hidden="true" /> 规则保存在 {store}
          </small>
        )}
      </section>
    </div>
  );
}

function describeRule(rule: AgentRule): string {
  const verb = rule.decision === "allow" ? "放行" : "拒绝";
  return `${verb} ${rule.tool}${rule.commandPrefix ? ` ${rule.commandPrefix}` : ""}`;
}
