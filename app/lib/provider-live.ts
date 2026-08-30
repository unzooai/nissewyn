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
import type { CapabilityLease, WorkspaceProvider } from "./provider";

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
 * 包一层真实后端。能接的方法走本机服务，接不了或失败的落回 fallback，
 * 这样任何一块后端没起来，控制台仍然是完整可用的。
 */
export function createLiveProvider(fallback: WorkspaceProvider): WorkspaceProvider {
  const inBrowser = typeof window !== "undefined";

  return {
    ...fallback,
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
