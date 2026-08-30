/**
 * 到本机 unterm 的代理。
 *
 * unterm 的 MCP 是裸 TCP，浏览器连不上；但 unterm-settings 起了一个 HTTP
 * 服务（默认 127.0.0.1:19877），已经把审批、provider、租约、会话、审计都
 * 开成了 REST。控制台走这层，不需要 MCP。
 *
 * 认证：Bearer token，记在 ~/.unterm/server.json 里。Worker 环境没有文件
 * 系统读不到，所以本地开发用 .dev.vars 传进来（见 README 的 Web 控制台
 * 一节）。真正的解法是让 unterm 自己托管这个控制台 —— 同源之后 token
 * 由它注入，不用用户操心。
 *
 * 和 /api/unzoo 一样只放行读和低风险写。approvals/decide 放行，因为审批
 * 决定本来就是控制台的核心动作，且它在 unterm 侧还要再过一次策略检查。
 */

export const dynamic = "force-dynamic";

const DEFAULT_ENDPOINT = "http://127.0.0.1:19877";

const ALLOWED_PATHS = new Set([
  "/api/health",
  "/api/state",
  "/api/approvals",
  "/api/approvals/decide",
  "/api/providers",
  "/api/providers/diagnose",
  "/api/providers/leases",
  "/api/providers/leases/revoke",
  "/api/sessions",
  "/api/mcp/audit",
  "/api/agents/list",
]);

type ProxyRequest = { path: string; method?: string; body?: unknown };

function isProxyRequest(value: unknown): value is ProxyRequest {
  return typeof value === "object" && value !== null && typeof (value as ProxyRequest).path === "string";
}

export async function POST(request: Request) {
  // 动态 import：静态导出（output: "export"）预渲染时不执行 handler，
  // 也就不会去解析 cloudflare: 协议，两种构建目标才能共存。
  const { env } = await import("cloudflare:workers");
  const vars = env as unknown as { UNTERM_TOKEN?: string; UNTERM_ENDPOINT?: string };
  const token = vars.UNTERM_TOKEN;
  const endpoint = vars.UNTERM_ENDPOINT ?? DEFAULT_ENDPOINT;

  if (!token) {
    return Response.json(
      {
        error: "没有配置 unterm 的访问令牌",
        hint: "把 ~/.unterm/server.json 里的 auth_token 写进 .dev.vars 的 UNTERM_TOKEN",
      },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  if (!isProxyRequest(payload)) {
    return Response.json({ error: "请求体需要 { path, method?, body? }" }, { status: 400 });
  }
  if (!ALLOWED_PATHS.has(payload.path)) {
    return Response.json(
      { error: `路径不在白名单里: ${payload.path}`, allowed: [...ALLOWED_PATHS] },
      { status: 403 },
    );
  }

  try {
    const method = payload.method ?? "GET";
    const response = await fetch(`${endpoint}${payload.path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(payload.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: payload.body === undefined ? undefined : JSON.stringify(payload.body),
      signal: AbortSignal.timeout(8000),
    });

    const text = await response.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // 非 JSON 原样返回。
    }
    if (!response.ok) {
      return Response.json({ error: `unterm 返回 HTTP ${response.status}`, data }, { status: 502 });
    }
    return Response.json({ path: payload.path, data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json(
      {
        error: "连不上本机 unterm",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
