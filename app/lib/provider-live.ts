/**
 * 真实后端实现。目前只接了能接的那部分，其余委托给传进来的 fallback。
 *
 * 这是 provider 层存在的意义：不改任何组件，把数据源从内存换成本机的
 * unzoo / unterm，能接一块换一块。
 *
 * 边界：
 * - 只在浏览器里生效。SSR 阶段没有同源地址可用，直接走 fallback，
 *   首屏因此始终有数据。
 * - 只在本地运行时能通。控制台部署到云端之后，127.0.0.1 是那台服务器
 *   自己，不是用户的机器。/api/backend-probe 可以确认当前环境。
 * - unterm 还没接：它的 Core 是随机端口（记在 core.json 里），Worker
 *   环境读不到文件。要么 unterm 给个固定入口，要么让用户在设置里填。
 */

import type { ConnectorCheckResult, ConnectorId } from "../types";
import {
  isAgentApprovalId,
  parseAgentApprovalId,
  toApprovalItem,
  type RawAgentApproval,
} from "./agent-approvals";
import type { ApprovalDecision, CapabilityLease, WorkspaceProvider } from "./provider";

/** unzoo 的能力名和控制台的连接器 id 不是一套词，这里对上。 */
const CAPABILITY_BY_CONNECTOR: Partial<Record<ConnectorId, string>> = {
  browser: "browser",
};

type UnzooResponse<T> = { tool: string; data: T } | { error: string; detail?: string };

async function callUnzoo<T>(tool: string, args?: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/unzoo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tool, args }),
  });
  const body = (await response.json()) as UnzooResponse<T>;
  if ("error" in body) throw new Error(body.detail ? `${body.error}（${body.detail}）` : body.error);
  return body.data;
}

function nowLabel(): string {
  return "刚刚";
}

/**
 * unterm 的 API 要 Bearer token，token 从同源的 /bootstrap.json 取一次。
 * 和 unterm 自己的设置页是同一套：控制台由 unterm 托管时同源，不用配置。
 *
 * 取不到就说明这份控制台不是 unterm 在托管（云端演示版，或者本机没起
 * unterm），调用方据此落回 mock。
 */
let untermToken: Promise<string> | null = null;

function authToken(): Promise<string> {
  if (!untermToken) {
    untermToken = fetch("/bootstrap.json")
      .then((response) => {
        if (!response.ok) throw new Error(`bootstrap.json 返回 ${response.status}`);
        return response.json() as Promise<{ auth_token?: string }>;
      })
      .then((body) => {
        if (!body.auth_token) throw new Error("bootstrap.json 里没有 auth_token");
        return body.auth_token;
      })
      .catch((error: unknown) => {
        // 下次调用重新试，别把一次失败缓存成永久失败。
        untermToken = null;
        throw error;
      });
  }
  return untermToken;
}

async function getUnterm<T>(path: string): Promise<T> {
  const token = await authToken();
  const response = await fetch(path, { headers: { authorization: `Bearer ${token}` } });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok || body?.error) throw new Error(body?.error ?? `unterm 返回 ${response.status}`);
  return body;
}

/**
 * 已经在这里答复过的托管审批。答复发出去和 unterm 把它移出队列之间有一个
 * 来回，这期间的一次轮询还会看到它；不滤掉，刚处理完的审批会闪回收件箱。
 */
const answeredAgentApprovals = new Set<string>();

async function decideAgentApproval(id: string, decision: ApprovalDecision): Promise<void> {
  const parsed = parseAgentApprovalId(id);
  if (!parsed) throw new Error(`不是托管会话的审批：${id}`);
  answeredAgentApprovals.add(id);
  try {
    await callUnterm("/api/agent/decide", {
      session_id: parsed.sessionId,
      request_id: parsed.requestId,
      allow: decision.kind === "approve",
      ...(decision.kind === "approve" && decision.remember ? { remember: true } : {}),
      // 控制台的拒绝 = 拒绝并停止这一轮：不停的话 agent 往往换个命令再问一遍。
      ...(decision.kind === "reject" ? { message: decision.reason, interrupt: true } : {}),
    });
  } catch (error) {
    answeredAgentApprovals.delete(id);
    throw error;
  }
}

async function callUnterm<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const token = await authToken();
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok || body?.error) throw new Error(body?.error ?? `unterm 返回 ${response.status}`);
  return body;
}

/**
 * 包一层真实后端。能接的方法走本机服务，接不了或失败的落回 fallback，
 * 这样任何一块后端没起来，控制台仍然是完整可用的。
 */
export function createLiveProvider(fallback: WorkspaceProvider): WorkspaceProvider {
  const inBrowser = typeof window !== "undefined";

  return {
    ...fallback,

    /**
     * 审批：本地队列照旧走 fallback，托管会话的审批走 unterm。
     * live() 取不到（云端演示版、本机没起 unterm）就当没有，不影响其它审批。
     */
    approvals: {
      ...fallback.approvals,

      async live() {
        if (!inBrowser) return [];
        try {
          const data = await getUnterm<{ approvals?: RawAgentApproval[] }>("/api/agent/approvals");
          const now = Date.now();
          return (data.approvals ?? [])
            .map((raw) => toApprovalItem(raw, now))
            .filter((item) => !answeredAgentApprovals.has(item.id));
        } catch {
          return [];
        }
      },

      async decide(id, decision) {
        if (isAgentApprovalId(id)) return decideAgentApproval(id, decision);
        return fallback.approvals.decide(id, decision);
      },

      async decideMany(ids, decision) {
        const agent = ids.filter(isAgentApprovalId);
        const local = ids.filter((id) => !isAgentApprovalId(id));
        await Promise.all([
          ...agent.map((id) => decideAgentApproval(id, decision)),
          ...(local.length ? [fallback.approvals.decideMany(local, decision)] : []),
        ]);
      },
    },

    /**
     * 真的跑一个 brain。这条只在 unterm 托管这份控制台时通 —— 别处拿不到
     * /bootstrap.json，start 会抛错，任务详情页据此退回演示事件。
     *
     * 只有 start 会落回 fallback。会话一旦真的起来了，后续的
     * events / status / close 就必须打在同一个后端上，悄悄换成 mock 只会
     * 让界面显示一段根本没发生过的事。
     */
    brain: {
      async start(input) {
        if (!inBrowser) return fallback.brain.start(input);
        try {
          const data = await callUnterm<{ agent: string; adapter: string; session: { session_id: string } }>(
            "/api/agent/start",
            {
              agent: input.agent,
              prompt: input.prompt,
              task_id: input.taskId,
              run_id: input.runId,
              step_id: input.stepId,
            },
          );
          return {
            sessionId: data.session.session_id,
            agent: input.agent,
            adapter: data.adapter,
          };
        } catch {
          return fallback.brain.start(input);
        }
      },

      async events(sessionId, cursor) {
        if (!sessionId.startsWith("ags_")) return fallback.brain.events(sessionId, cursor);
        const data = await callUnterm<{ cursor: number; events: Array<Record<string, unknown>> }>(
          "/api/agent/events",
          { session_id: sessionId, cursor },
        );
        return {
          cursor: data.cursor,
          events: (data.events ?? []).map((raw) => ({
            event: String(raw.event ?? ""),
            at: String(raw.at ?? ""),
            taskId: raw.task_id as string | undefined,
            runId: raw.run_id as string | undefined,
            stepId: raw.step_id as string | undefined,
            message: raw.message as string | undefined,
            model: raw.model as string | undefined,
          })),
        };
      },

      async status(sessionId) {
        if (!sessionId.startsWith("ags_")) return fallback.brain.status(sessionId);
        const data = await callUnterm<{
          state: string;
          turns?: number;
          usage?: { input_tokens?: number; output_tokens?: number; cached_input_tokens?: number };
        }>("/api/agent/status", { session_id: sessionId });
        return {
          state: data.state,
          turns: data.turns ?? 0,
          usage: {
            inputTokens: data.usage?.input_tokens ?? 0,
            outputTokens: data.usage?.output_tokens ?? 0,
            cachedInputTokens: data.usage?.cached_input_tokens ?? 0,
          },
        };
      },

      async interrupt(sessionId, graceMs) {
        if (!sessionId.startsWith("ags_")) return fallback.brain.interrupt(sessionId, graceMs);
        await callUnterm("/api/agent/interrupt", {
          session_id: sessionId,
          ...(graceMs === undefined ? {} : { grace_ms: graceMs }),
        });
      },

      async close(sessionId) {
        if (!sessionId.startsWith("ags_")) return fallback.brain.close(sessionId);
        const data = await callUnterm<{ exit_code?: number; reason?: string }>("/api/agent/close", {
          session_id: sessionId,
        });
        return { exitCode: data.exit_code ?? 0, reason: data.reason ?? undefined };
      },
    },

    connectors: {
      ...fallback.connectors,

      async diagnose(id: ConnectorId): Promise<ConnectorCheckResult> {
        if (!inBrowser || id !== "browser") return fallback.connectors.diagnose(id);
        const startedAt = Date.now();
        try {
          await callUnzoo<{ version: string; chromium_version: string }>("service_version");
          return { checkedAt: nowLabel(), latency: Date.now() - startedAt };
        } catch {
          // 本机 unzoo 没起来时不该让诊断整个失败，退回演示值。
          return fallback.connectors.diagnose(id);
        }
      },

      async leases(): Promise<CapabilityLease[]> {
        if (!inBrowser) return fallback.connectors.leases();
        try {
          const data = await callUnzoo<{ enforced: boolean; leases: unknown[] }>("lease_list");
          if (!Array.isArray(data?.leases)) return fallback.connectors.leases();
          return data.leases.map((raw) => {
            const item = raw as Record<string, unknown>;
            return {
              id: String(item.id ?? ""),
              capability: String(item.capability ?? ""),
              holder: String(item.holder ?? ""),
              scope: String(item.scope ?? ""),
              expiresAt: String(item.expires_at ?? item.expiresAt ?? ""),
              status: (item.status as CapabilityLease["status"]) ?? "active",
            };
          });
        } catch {
          return fallback.connectors.leases();
        }
      },

      async acquire(capability: string, scope: string, ttlSeconds: number) {
        const mapped = CAPABILITY_BY_CONNECTOR[capability as ConnectorId] ?? capability;
        if (!inBrowser) return fallback.connectors.acquire(capability, scope, ttlSeconds);
        try {
          const data = await callUnzoo<Record<string, unknown>>("lease_request", {
            capability: mapped,
            holder: "unzoo-one-console",
            scope,
            ttl_secs: ttlSeconds,
          });
          return {
            id: String(data.id ?? ""),
            capability: mapped,
            holder: "unzoo-one-console",
            scope,
            expiresAt: String(data.expires_at ?? ""),
            status: (data.status as CapabilityLease["status"]) ?? "pending",
          };
        } catch {
          return fallback.connectors.acquire(capability, scope, ttlSeconds);
        }
      },
    },
  };
}
