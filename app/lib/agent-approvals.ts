/**
 * 托管会话的审批：unterm 的 approval.requested 事件 → 收件箱里的一条审批。
 *
 * 托管会话（agent_session 带 hosted）里，agent 每次要执行需要授权的工具都会
 * 停下来问；unterm 的 GET /api/agent/approvals 列出所有还在等答复的问题。
 * 这里把它们换成控制台的 ApprovalItem，让它们和其它审批走同一个收件箱、
 * 同一套批准 / 拒绝流程。
 *
 * 纯函数，不碰网络和 DOM：provider-live 负责取数据，页面负责轮询。
 */

import { Terminal } from "lucide-react";
import type { ApprovalItem, ApprovalRisk } from "../types";

/** unterm 返回的一条：approval.requested 事件原样，加 session_id 和 adapter。 */
export type RawAgentApproval = {
  session_id: string;
  adapter?: string;
  at?: string;
  task_id?: string;
  approval: {
    request_id: string;
    description?: string;
    tool_call: { tool: string; arguments?: unknown };
  };
};

const PREFIX = "agent:";

/** 收件箱里的 id。带前缀，和本地审批的 id 不会撞，也能反解出会话和请求。 */
export function agentApprovalId(sessionId: string, requestId: string): string {
  return `${PREFIX}${sessionId}:${requestId}`;
}

export function isAgentApprovalId(id: string): boolean {
  return id.startsWith(PREFIX);
}

/** 反解 id。会话 id 是 `ags_` 加十六进制，不含冒号；请求 id 可能含，所以只切第一个。 */
export function parseAgentApprovalId(id: string): { sessionId: string; requestId: string } | null {
  if (!isAgentApprovalId(id)) return null;
  const rest = id.slice(PREFIX.length);
  const cut = rest.indexOf(":");
  if (cut <= 0 || cut === rest.length - 1) return null;
  return { sessionId: rest.slice(0, cut), requestId: rest.slice(cut + 1) };
}

const AGENT_LABEL: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  agy: "Antigravity",
};

const SHELL_TOOLS = new Set(["bash", "powershell", "shell", "run_command", "execute", "exec_command"]);
const EDIT_TOOLS = new Set(["write", "edit", "multiedit", "notebookedit", "apply_patch", "write_file", "edit_file"]);

function kindOf(tool: string): "shell" | "edit" | "permissions" | "other" {
  const name = tool.toLowerCase();
  if (SHELL_TOOLS.has(name)) return "shell";
  if (EDIT_TOOLS.has(name)) return "edit";
  if (name === "permissions") return "permissions";
  return "other";
}

/** 要做的那件事，一行字：命令本身、文件路径，否则参数的 JSON。 */
function targetOf(args: unknown): string {
  if (args && typeof args === "object") {
    const record = args as Record<string, unknown>;
    for (const key of ["command", "CommandLine", "cmd", "file_path", "path", "url"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  if (args === undefined || args === null) return "（未提供参数）";
  const text = JSON.stringify(args);
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}

function relativeLabel(at: string | undefined, now: number): string {
  const time = at ? Date.parse(at) : NaN;
  if (Number.isNaN(time)) return "刚刚";
  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  return `${Math.floor(minutes / 60)} 小时前`;
}

export function toApprovalItem(raw: RawAgentApproval, now: number = Date.now()): ApprovalItem {
  const tool = raw.approval.tool_call.tool;
  const agent = AGENT_LABEL[raw.adapter ?? ""] ?? raw.adapter ?? "Agent";
  const kind = kindOf(tool);
  const action =
    kind === "shell" ? "执行命令" : kind === "edit" ? "修改文件" : kind === "permissions" ? "授予权限" : `调用 ${tool}`;
  // 执行命令和改文件都会改变本机状态；授予权限会放宽之后的所有调用，单列高风险。
  const risk: ApprovalRisk = kind === "permissions" ? "高风险" : kind === "other" ? "低风险" : "中风险";
  const target = targetOf(raw.approval.tool_call.arguments);
  return {
    id: agentApprovalId(raw.session_id, raw.approval.request_id),
    taskId: raw.task_id ?? "",
    title: `${agent} 请求${action}`,
    reason: raw.approval.description?.trim() || `${agent} 在托管会话中要使用 ${tool}，执行前需要你确认。`,
    impact: kind === "shell" ? `批准后会在本机执行：${target}` : `批准后 ${agent} 会使用 ${tool}：${target}`,
    action,
    target,
    // 只答复这一次调用，不授予更大范围：和 contracts 的 allow_once 一致。
    scope: "仅本次调用",
    risk,
    requestedAt: relativeLabel(raw.at, now),
    expiresAt: "会话关闭时自动拒绝",
    policy: "托管会话：执行前询问",
    icon: Terminal,
  };
}

/**
 * 把轮询到的托管审批合进当前队列。
 *
 * 本地审批一条不动；托管审批以 unterm 为准：还在等的留着（保持原来的位置），
 * 新来的追加到末尾，已经不在 unterm 那边的（答复了、会话关了）去掉。
 * 没有变化时返回原数组，免得每次轮询都触发一次重渲染。
 */
export function reconcileAgentApprovals(items: ApprovalItem[], live: ApprovalItem[]): ApprovalItem[] {
  const liveIds = new Set(live.map((item) => item.id));
  const kept = items.filter((item) => !isAgentApprovalId(item.id) || liveIds.has(item.id));
  const present = new Set(kept.map((item) => item.id));
  const added = live.filter((item) => !present.has(item.id));
  if (added.length === 0 && kept.length === items.length) return items;
  return [...kept, ...added];
}
