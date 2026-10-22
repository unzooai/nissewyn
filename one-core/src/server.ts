/**
 * 本机 HTTP 接口。
 *
 * 路径按 domain-model-and-contracts.md §16 的 API Surface v0。错误按
 * contracts/v0/common/error.schema.json：调用方只对 `code` 分支，不解析 message。
 *
 * 只监听 127.0.0.1，端口交给系统分配（0）。不写死端口是因为写死就会撞——
 * 真实地址写进 core.json，客户端读文件而不是猜。
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { bearerFrom, isLoopback, tokenMatches } from "./auth.ts";
import { verifyChain } from "./events.ts";
import {
  cancelTask,
  createTask,
  finishRun,
  getTask,
  listTasks,
  startRun,
  taskEvents,
  StoreError,
  type CreateTaskInput,
} from "./store.ts";

export type ServerOptions = {
  db: DatabaseSync;
  token: string;
  instanceId: string;
  host?: string;
  port?: number;
};

export type RunningServer = {
  server: Server;
  endpoint: string;
  close: () => Promise<void>;
};

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    // 这个接口不给浏览器页面直接用，明确关掉跨源读取。
    "access-control-allow-origin": "null",
  });
  res.end(payload);
}

function fail(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  userMessage?: string,
): void {
  send(res, status, {
    error: {
      code,
      message,
      ...(userMessage ? { user_message: userMessage } : {}),
      retryable: status >= 500,
    },
  });
}

async function readJson(req: IncomingMessage, limitBytes = 1_000_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    total += buffer.length;
    // 本机接口也要设上限：一个跑飞的客户端不该把 Core 的内存吃光。
    if (total > limitBytes) throw new StoreError("validation.body_too_large", 413, "请求体过大");
    chunks.push(buffer);
  }
  if (total === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new StoreError("validation.invalid_json", 400, "请求体不是合法 JSON");
  }
}

export function startServer(options: ServerOptions): Promise<RunningServer> {
  const { db, token, instanceId } = options;
  const startedAt = Date.now();

  const server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (error instanceof StoreError) {
        fail(res, error.status, error.code, error.message);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      fail(res, 500, "internal.unhandled", message, "Core 内部出错，请查看日志。");
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    const method = req.method ?? "GET";

    // 健康检查不需要认证：它只回自证身份的 instance_id，不含任何任务数据。
    // 单实例锁靠它判断「锁里记的那个进程是不是真的还在」——那时候拿不到 token。
    if (method === "GET" && path === "/v0/health") {
      send(res, 200, {
        instance_id: instanceId,
        pid: process.pid,
        uptime_ms: Date.now() - startedAt,
        schema_contract: "contracts/v0",
      });
      return;
    }

    if (!isLoopback(req.socket.remoteAddress)) {
      fail(res, 403, "auth.not_loopback", "只接受本机回环地址的请求");
      return;
    }
    if (!tokenMatches(token, bearerFrom(req.headers.authorization))) {
      fail(res, 401, "auth.invalid_token", "缺少或不正确的 Bearer token");
      return;
    }

    const segments = path.split("/").filter(Boolean); // ["v0","tasks",id,action?]
    if (segments[0] !== "v0") {
      fail(res, 404, "validation.unknown_route", `没有这个路径：${path}`);
      return;
    }

    if (segments[1] === "tasks" && segments.length === 2) {
      if (method === "GET") {
        send(res, 200, { tasks: listTasks(db) });
        return;
      }
      if (method === "POST") {
        const body = (await readJson(req)) as CreateTaskInput;
        const key = req.headers["idempotency-key"];
        const { task, created } = createTask(
          db,
          body,
          typeof key === "string" ? key : undefined,
        );
        send(res, created ? 201 : 200, { task, created });
        return;
      }
    }

    if (segments[1] === "tasks" && segments.length >= 3) {
      const taskId = segments[2] as string;
      const action = segments[3];

      if (method === "GET" && action === undefined) {
        send(res, 200, { task: getTask(db, taskId) });
        return;
      }
      if (method === "GET" && action === "events") {
        const cursor = Number(url.searchParams.get("cursor") ?? "0");
        if (!Number.isInteger(cursor) || cursor < 0) {
          fail(res, 400, "validation.bad_cursor", "cursor 必须是非负整数");
          return;
        }
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam === null ? undefined : Number(limitParam);
        send(res, 200, taskEvents(db, taskId, cursor, limit));
        return;
      }
      if (method === "GET" && action === "verify") {
        getTask(db, taskId);
        send(res, 200, verifyChain(db, taskId));
        return;
      }
      if (method === "POST" && action === "start") {
        send(res, 200, startRun(db, taskId));
        return;
      }
      if (method === "POST" && action === "cancel") {
        send(res, 200, { task: cancelTask(db, taskId) });
        return;
      }
      if (method === "POST" && action === "finish") {
        // 骨架期占位。真正结束一次 Run 应该由 Brain 的收敛结果驱动，
        // 不该由客户端说了算——Brain Router（unzoo-one#10）落地后这条就撤掉。
        const body = (await readJson(req)) as { outcome?: "succeeded" | "failed"; summary?: string };
        send(res, 200, finishRun(db, taskId, body.outcome ?? "succeeded", body.summary));
        return;
      }
    }

    fail(res, 404, "validation.unknown_route", `没有这个路径：${method} ${path}`);
  }

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, options.host ?? "127.0.0.1", () => {
      server.removeListener("error", reject);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("拿不到监听地址"));
        return;
      }
      resolve({
        server,
        endpoint: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((done, failed) => {
            server.close((error) => (error ? failed(error) : done()));
          }),
      });
    });
  });
}
