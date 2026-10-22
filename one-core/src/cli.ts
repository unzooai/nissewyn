/**
 * 没有 UI 的客户端。
 *
 * ONE-C003 的验收物是「无 UI 的 CLI demo」——在没有任何产品界面的情况下把一个
 * 任务从创建跑到收尾，并且把事件流完整读出来。`demo` 子命令做的就是这件事。
 *
 * 它走的是和将来的桌面端完全相同的路径：读 core.json 拿 endpoint 和 token，
 * 带 Bearer 调 /v0。没有任何只给 CLI 开的后门。
 */
import { readFileSync } from "node:fs";
import { statePath, CORE_JSON } from "./paths.ts";
import { inspect } from "./lock.ts";

type CoreJson = { endpoint: string; token: string; instance_id: string; pid: number };

function connection(): CoreJson {
  try {
    return JSON.parse(readFileSync(statePath(CORE_JSON), "utf8")) as CoreJson;
  } catch {
    const held = inspect();
    const hint = held
      ? `锁里记着 pid ${held.pid}，但 core.json 不在——Core 可能正在启动或者没清干净。`
      : "没有正在运行的 Core。先跑 npm start。";
    throw new Error(hint);
  }
}

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const core = connection();
  const response = await fetch(new URL(path, core.endpoint), {
    method,
    headers: {
      authorization: `Bearer ${core.token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = (await response.json()) as T & { error?: { code: string; message: string } };
  if (!response.ok) {
    const error = payload.error;
    throw new Error(error ? `${error.code}: ${error.message}` : `HTTP ${response.status}`);
  }
  return payload;
}

const out = (value: unknown) =>
  process.stdout.write(
    (typeof value === "string" ? value : JSON.stringify(value, null, 2)) + "\n",
  );

async function status(): Promise<void> {
  const held = inspect();
  if (!held) {
    out("没有正在运行的 Core。");
    return;
  }
  const core = connection();
  const health = await fetch(new URL("/v0/health", core.endpoint)).then((r) => r.json());
  out({ lock: held, endpoint: core.endpoint, health });
}

async function demo(): Promise<void> {
  out("— 建任务 —");
  const created = await call<{ task: { task_id: string; state: string } }>(
    "POST",
    "/v0/tasks",
    {
      title: "调研竞品定价并生成报告",
      goal: "看一下竞品的三档价格，和我们现在的定价做个对比，写成一页报告。",
      mode: "work",
      permission_mode: "interactive",
    },
    // 同一个键再跑一次 demo 不会重复建任务——这正是幂等键要证明的事。
    { "idempotency-key": "demo-fixed-key-1" },
  );
  const taskId = created.task.task_id;
  out(`  ${taskId}  state=${created.task.state}`);

  out("— 开跑 —");
  const started = await call<{ run: { run_id: string; attempt: number } }>(
    "POST",
    `/v0/tasks/${taskId}/start`,
  );
  out(`  ${started.run.run_id}  attempt=${started.run.attempt}`);

  out("— 收尾 —");
  const finished = await call<{ task: { state: string } }>("POST", `/v0/tasks/${taskId}/finish`, {
    outcome: "succeeded",
    summary: "三档价格已对比，报告已生成。",
  });
  out(`  task state=${finished.task.state}`);

  out("— 按 cursor 读事件 —");
  let cursor = 0;
  for (;;) {
    const page = await call<{ cursor: number; events: { sequence: number; type: string }[] }>(
      "GET",
      `/v0/tasks/${taskId}/events?cursor=${cursor}&limit=3`,
    );
    if (page.events.length === 0) break;
    for (const event of page.events) out(`  ${String(event.sequence).padStart(3)}  ${event.type}`);
    cursor = page.cursor;
  }
  out(`  读到 cursor=${cursor}，再读返回空——不是错误，是还没有新的。`);

  out("— 验链 —");
  out(await call("GET", `/v0/tasks/${taskId}/verify`));
}

const USAGE = `用法：
  node src/cli.ts status
  node src/cli.ts list
  node src/cli.ts new <标题> <目标>
  node src/cli.ts start <task_id>
  node src/cli.ts finish <task_id> [摘要]
  node src/cli.ts cancel <task_id>
  node src/cli.ts events <task_id> [cursor]
  node src/cli.ts verify <task_id>
  node src/cli.ts demo            # 建任务 → 开跑 → 收尾 → 读事件 → 验链
`;

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "status":
      await status();
      return;
    case "list":
      out(await call("GET", "/v0/tasks"));
      return;
    case "new":
      out(
        await call("POST", "/v0/tasks", {
          title: args[0] ?? "未命名任务",
          goal: args[1] ?? args[0] ?? "未填写",
          mode: "work",
        }),
      );
      return;
    case "start":
      out(await call("POST", `/v0/tasks/${args[0]}/start`));
      return;
    case "finish":
      out(
        await call("POST", `/v0/tasks/${args[0]}/finish`, {
          outcome: "succeeded",
          ...(args[1] ? { summary: args[1] } : {}),
        }),
      );
      return;
    case "cancel":
      out(await call("POST", `/v0/tasks/${args[0]}/cancel`));
      return;
    case "events":
      out(await call("GET", `/v0/tasks/${args[0]}/events?cursor=${args[1] ?? 0}`));
      return;
    case "verify":
      out(await call("GET", `/v0/tasks/${args[0]}/verify`));
      return;
    case "demo":
      await demo();
      return;
    default:
      process.stdout.write(USAGE);
      process.exit(command === undefined ? 0 : 2);
  }
}

if (import.meta.filename === process.argv[1]) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
