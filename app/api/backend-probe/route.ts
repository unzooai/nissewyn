/**
 * 探针：本机的 unzoo / unterm 能不能从控制台的服务端触达。
 *
 * 控制台跑在 Cloudflare Worker 上。本地 dev 时 Worker 由 miniflare 模拟，
 * 出站 fetch 走本机网络，能打到 127.0.0.1；部署到云端之后就打不到用户的
 * 机器了。这个 route 用来确认这条边界到底在哪。
 *
 * unzoo 的 REST 固定在 9399。unterm Core 是随机端口（记在
 * %LOCALAPPDATA%\Unterm\core.json），Worker 环境没有文件系统读不到，
 * 所以要么由用户在设置里填，要么 unterm 那边给个固定入口。
 */

export const dynamic = "force-dynamic";

type ProbeResult = {
  name: string;
  url: string;
  reachable: boolean;
  status?: number;
  detail?: string;
};

async function probe(name: string, url: string, init?: RequestInit): Promise<ProbeResult> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(3000) });
    return { name, url, reachable: true, status: response.status };
  } catch (error) {
    return {
      name,
      url,
      reachable: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  const results = await Promise.all([
    probe("unzoo REST", "http://127.0.0.1:9399/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }),
    probe("unzoo CDP", "http://127.0.0.1:9222/json/version"),
    probe("unterm HTTP", "http://127.0.0.1:19877/"),
    probe("unterm localhost", "http://localhost:19877/"),
  ]);

  return Response.json(
    { checkedAt: new Date().toISOString(), results },
    { headers: { "cache-control": "no-store" } },
  );
}
