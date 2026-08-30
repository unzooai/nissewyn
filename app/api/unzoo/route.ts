/**
 * 到本机 unzoo 的代理。
 *
 * 浏览器不能直接打 127.0.0.1:9399（跨域，而且真实部署时用户机器上的服务
 * 也不该暴露给页面），所以走控制台的服务端中转。
 *
 * 只在本地运行时有意义：Worker 部署到云端之后 127.0.0.1 是那台机器自己，
 * 不是用户的机器。用 /api/backend-probe 可以确认当前环境到底通不通。
 *
 * 安全：只放行只读和低风险方法。浏览器自动化里真正危险的那些（cookie 读取、
 * 文件写入、任意导航）必须先过控制台的审批流，不从这里裸奔。
 */

export const dynamic = "force-dynamic";

const UNZOO_ENDPOINT = "http://127.0.0.1:9399/mcp";

/** 白名单。要放行新方法，先想清楚它的 risk_v2 是不是 readonly。 */
const ALLOWED_TOOLS = new Set([
  "service_status",
  "service_version",
  "profile_list",
  "profile_get_current",
  "session_info",
  "tab_list",
  "lease_list",
  "skill_list",
  // 申请权限本身是安全的：高风险能力申请完停在 pending，要另外批准才生效。
  // lease_grant（批准）刻意不放行，它必须走控制台的审批流。
  "lease_request",
]);

type ToolCall = { tool: string; args?: Record<string, unknown> };

function isToolCall(value: unknown): value is ToolCall {
  return typeof value === "object" && value !== null && typeof (value as ToolCall).tool === "string";
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!isToolCall(payload)) {
    return Response.json({ error: "请求体需要 { tool, args? }" }, { status: 400 });
  }
  if (!ALLOWED_TOOLS.has(payload.tool)) {
    return Response.json(
      { error: `方法不在白名单里: ${payload.tool}`, allowed: [...ALLOWED_TOOLS] },
      { status: 403 },
    );
  }

  try {
    const response = await fetch(UNZOO_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: payload.tool, arguments: payload.args ?? {} },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return Response.json(
        { error: `unzoo 返回 HTTP ${response.status}` },
        { status: 502 },
      );
    }

    const body = (await response.json()) as {
      result?: { content?: Array<{ text?: string }>; isError?: boolean };
      error?: { message?: string };
    };
    if (body.error) {
      return Response.json({ error: body.error.message ?? "unzoo 报错" }, { status: 502 });
    }

    const text = body.result?.content?.[0]?.text;
    let data: unknown = text;
    if (typeof text === "string") {
      try {
        data = JSON.parse(text);
      } catch {
        // 不是 JSON 就原样返回文本。
      }
    }
    return Response.json({ tool: payload.tool, data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json(
      {
        error: "连不上本机 unzoo",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
