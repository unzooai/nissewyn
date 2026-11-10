/**
 * 控制台交给 agent 跑任务时用的设置：在哪个目录干活、用什么模式。
 *
 * 存在本机浏览器里（每台机器的项目路径本来就不一样），读写都包了 try/catch：
 * 隐私窗口或禁用存储时退回默认值，不影响跑任务。
 */

import type { BrainId, BrainMode } from "./provider";

export type AgentRunSettings = {
  /** 任务交给哪个 agent。 */
  agent: BrainId;
  /** agent 的工作目录。空串：不指定，用 unterm 自己的工作目录。 */
  cwd: string;
  /**
   * 受管：CLI 自己的 shell 和联网工具关掉，只能经 Unterm 执行（AGENTS.md
   * 的要求）。关掉则是托管：CLI 用自己的工具，但每次调用都先进收件箱。
   */
  governed: boolean;
};

export const AGENT_RUN_SETTINGS_KEY = "unzoo-one.agent-run";

export const defaultAgentRunSettings: AgentRunSettings = {
  agent: "claude-code",
  cwd: "",
  governed: true,
};

const knownAgents: readonly string[] = ["claude-code", "codex-cli", "opencode"];

export function parseAgentRunSettings(text: string | null): AgentRunSettings {
  if (!text) return { ...defaultAgentRunSettings };
  try {
    const raw = JSON.parse(text) as Partial<AgentRunSettings>;
    return {
      agent:
        typeof raw.agent === "string" && knownAgents.includes(raw.agent)
          ? (raw.agent as BrainId)
          : defaultAgentRunSettings.agent,
      cwd: typeof raw.cwd === "string" ? raw.cwd.trim() : defaultAgentRunSettings.cwd,
      governed: typeof raw.governed === "boolean" ? raw.governed : defaultAgentRunSettings.governed,
    };
  } catch {
    return { ...defaultAgentRunSettings };
  }
}

export function readAgentRunSettings(): AgentRunSettings {
  try {
    return parseAgentRunSettings(window.localStorage.getItem(AGENT_RUN_SETTINGS_KEY));
  } catch {
    return { ...defaultAgentRunSettings };
  }
}

export function writeAgentRunSettings(settings: AgentRunSettings): boolean {
  try {
    window.localStorage.setItem(AGENT_RUN_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/**
 * 这次运行用什么模式。受管只有 Claude Code 支持（要靠它的
 * --disallowedTools 关掉自带 shell）；别的 agent 退回托管，审批照样进收件箱。
 */
export function brainModeFor(agent: BrainId, settings: AgentRunSettings): BrainMode {
  return settings.governed && agent === "claude-code" ? "governed" : "hosted";
}
