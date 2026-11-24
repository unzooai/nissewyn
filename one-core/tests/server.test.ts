import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UNZOO_ONE_STATE_DIR = mkdtempSync(join(tmpdir(), "one-core-server-"));

const { openDatabase } = await import("../src/db.ts");
const { startServer } = await import("../src/server.ts");

const TOKEN = "test-token-not-a-real-secret";
let endpoint = "";
let close: () => Promise<void> = async () => {};

before(async () => {
  const running = await startServer({
    db: openDatabase(":memory:"),
    token: TOKEN,
    instanceId: "inst_test",
  });
  endpoint = running.endpoint;
  close = running.close;
});

after(async () => {
  await close();
});

async function api(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: any }> {
  const response = await fetch(new URL(path, endpoint), {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

test("认证：没有 token 一律 401", async () => {
  const response = await fetch(new URL("/v0/tasks", endpoint));
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "auth.invalid_token");
});

test("认证：token 不对也是 401，且错误码稳定", async () => {
  const response = await fetch(new URL("/v0/tasks", endpoint), {
    headers: { authorization: "Bearer wrong-token-guess" },
  });
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: { code: string; retryable: boolean } };
  assert.equal(body.error.code, "auth.invalid_token");
  assert.equal(body.error.retryable, false);
});

test("健康检查：不需要认证，只回自证身份的信息", async () => {
  // 单实例锁靠它判断锁里那个进程还在不在，那时候拿不到 token，所以必须开放。
  const response = await fetch(new URL("/v0/health", endpoint));
  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.instance_id, "inst_test");
  assert.ok(!("token" in body), "健康检查不能泄露 token");
  assert.ok(!("tasks" in body), "也不该带任何任务数据");
});

test("任务：建、查、列", async () => {
  const created = await api("POST", "/v0/tasks", {
    title: "读一下这个页面",
    goal: "把三档价格取出来",
    mode: "work",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.created, true);
  assert.equal(created.body.task.state, "queued");
  assert.equal(created.body.task.active_run_id, null);

  const id = created.body.task.task_id;
  const fetched = await api("GET", `/v0/tasks/${id}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.task.task_id, id);

  const listed = await api("GET", "/v0/tasks");
  assert.ok(listed.body.tasks.some((t: { task_id: string }) => t.task_id === id));
});

test("任务：幂等键让重发不会多建一个", async () => {
  const payload = { title: "重发也只建一次", goal: "验证幂等", mode: "work" };
  const first = await api("POST", "/v0/tasks", payload, { "idempotency-key": "same-key" });
  const second = await api("POST", "/v0/tasks", payload, { "idempotency-key": "same-key" });

  assert.equal(first.status, 201);
  assert.equal(first.body.created, true);
  assert.equal(second.status, 200);
  assert.equal(second.body.created, false, "第二次不是新建");
  assert.equal(second.body.task.task_id, first.body.task.task_id);
});

test("任务：校验失败给出稳定错误码", async () => {
  const empty = await api("POST", "/v0/tasks", { title: "  ", goal: "x", mode: "work" });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, "validation.missing_title");

  // automate 的任务必须回指来源，否则 Run History 找不到归属。
  const automate = await api("POST", "/v0/tasks", { title: "定时", goal: "x", mode: "automate" });
  assert.equal(automate.status, 400);
  assert.equal(automate.body.error.code, "validation.missing_automation_id");
});

test("Run：开跑、收尾，状态和事件一致", async () => {
  const created = await api("POST", "/v0/tasks", {
    title: "跑一轮",
    goal: "验证生命周期",
    mode: "work",
  });
  const id = created.body.task.task_id;

  const started = await api("POST", `/v0/tasks/${id}/start`);
  assert.equal(started.status, 200);
  assert.equal(started.body.task.state, "running");
  assert.equal(started.body.task.active_run_id, started.body.run.run_id);
  assert.equal(started.body.run.attempt, 1);

  const again = await api("POST", `/v0/tasks/${id}/start`);
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, "task.run_active", "默认最多一个活动 Run");

  const finished = await api("POST", `/v0/tasks/${id}/finish`, {
    outcome: "succeeded",
    summary: "done",
  });
  assert.equal(finished.body.task.state, "succeeded");
  assert.equal(finished.body.task.active_run_id, null, "终态不能挂活动 Run");
  assert.equal(finished.body.run.finished_at !== null, true);

  const restart = await api("POST", `/v0/tasks/${id}/start`);
  assert.equal(restart.status, 409);
  assert.equal(restart.body.error.code, "task.terminal", "终态不能回到 running");
});

test("事件：按 cursor 读，顺序完整，链可验证", async () => {
  const created = await api("POST", "/v0/tasks", {
    title: "看事件",
    goal: "验证 cursor",
    mode: "work",
  });
  const id = created.body.task.task_id;
  await api("POST", `/v0/tasks/${id}/start`);
  await api("POST", `/v0/tasks/${id}/finish`, { outcome: "succeeded" });

  const types: string[] = [];
  let cursor = 0;
  for (;;) {
    const page = await api("GET", `/v0/tasks/${id}/events?cursor=${cursor}&limit=2`);
    if (page.body.events.length === 0) break;
    types.push(...page.body.events.map((e: { type: string }) => e.type));
    cursor = page.body.cursor;
  }

  assert.deepEqual(types, [
    "task.created",
    "run.started",
    "task.state_changed",
    "run.completed",
    "task.state_changed",
  ]);

  const verify = await api("GET", `/v0/tasks/${id}/verify`);
  assert.equal(verify.body.ok, true, verify.body.detail);
});

test("路由：不存在的任务和路径分别给出各自的错误码", async () => {
  const missing = await api("GET", "/v0/tasks/task_00000000000000000000000000");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "task.not_found");

  const nowhere = await api("GET", "/v0/nowhere");
  assert.equal(nowhere.status, 404);
  assert.equal(nowhere.body.error.code, "validation.unknown_route");

  const badCursor = await api("GET", "/v0/tasks/x/events?cursor=-1");
  assert.equal(badCursor.status, 400);
  assert.equal(badCursor.body.error.code, "validation.bad_cursor");
});
