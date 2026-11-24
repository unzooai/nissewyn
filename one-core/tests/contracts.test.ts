/**
 * Core 产出的每个对象都必须符合 contracts/v0。
 *
 * 这是契约存在的意义所在：schema 不是画在文档里的图，是能拦住实现的东西。
 * 字段名写错、状态机漏一档、终态还挂着活动 Run —— 都在这里红，不用等到跨仓库
 * 联调才发现。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ajv 8 是 CJS 包，nodenext 下默认导入拿到的是整个命名空间而不是那个类，
// 所以显式取 .default——两个包运行时都挂了这个属性。
import ajvModule from "ajv/dist/2020.js";
import ajvFormatsModule from "ajv-formats";

const Ajv2020 = ajvModule.default;
const addFormats = ajvFormatsModule.default;

process.env.UNZOO_ONE_STATE_DIR = mkdtempSync(join(tmpdir(), "one-core-contracts-"));

const { openDatabase } = await import("../src/db.ts");
const { createTask, startRun, finishRun, cancelTask, taskEvents } = await import("../src/store.ts");

const CONTRACTS = fileURLToPath(new URL("../../contracts/v0/", import.meta.url));
const BASE = "https://contracts.unzoo.ai/v0/";

function schemaFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return schemaFiles(full);
    return entry.name.endsWith(".schema.json") ? [full] : [];
  });
}

const ajv = new Ajv2020({
  strict: true,
  strictRequired: false,
  strictTypes: false,
  allErrors: true,
  allowUnionTypes: true,
});
addFormats(ajv);
for (const file of schemaFiles(CONTRACTS)) {
  ajv.addSchema(JSON.parse(readFileSync(file, "utf8")));
}

function check(schema: string, instance: unknown, what: string): void {
  const validate = ajv.getSchema(BASE + schema);
  assert.ok(validate, `找不到 schema：${schema}`);
  assert.ok(validate(instance), `${what} 不符合 ${schema}：${ajv.errorsText(validate.errors)}`);
}

function scenario() {
  const db = openDatabase(":memory:");
  const { task } = createTask(db, {
    title: "调研竞品定价并生成报告",
    goal: "看一下竞品的三档价格，和我们现在的定价做个对比。",
    mode: "work",
    permission_mode: "interactive",
    workspace_refs: ["workspace_research"],
    profile_refs: ["profile_work"],
    budget: { max_usd: 2 },
  });
  return { db, task };
}

test("契约：新建的 Task 符合 task.v0", () => {
  const { db, task } = scenario();
  check("task/task.schema.json", task, "新建的 Task");
  db.close();
});

test("契约：Run 与运行中的 Task 都符合各自的 schema", () => {
  const { db, task } = scenario();
  const { task: running, run } = startRun(db, task.task_id);

  check("task/run.schema.json", run, "新开的 Run");
  check("task/task.schema.json", running, "运行中的 Task");
  assert.equal(running.state, "running");
  assert.equal(running.active_run_id, run.run_id);
  db.close();
});

test("契约：收尾之后的 Run 有 finished_at，Task 不再挂活动 Run", () => {
  const { db, task } = scenario();
  startRun(db, task.task_id);
  const { task: done, run } = finishRun(db, task.task_id, "succeeded", "报告已生成");

  check("task/run.schema.json", run, "收尾的 Run");
  check("task/task.schema.json", done, "终态 Task");

  // 这两条是 schema 里的 if/then，不是这里额外加的规矩：
  // 结束了就得有结束时间，终态不能挂活动 Run。
  assert.notEqual(run.finished_at, null);
  assert.equal(done.active_run_id, null);
  db.close();
});

test("契约：取消之后的 Task 仍然合法", () => {
  const { db, task } = scenario();
  startRun(db, task.task_id);
  const cancelled = cancelTask(db, task.task_id);

  check("task/task.schema.json", cancelled, "取消的 Task");
  assert.equal(cancelled.state, "cancelled");
  assert.equal(cancelled.active_run_id, null);
  db.close();
});

test("契约：产出的每一条事件都符合 event.v0", () => {
  const { db, task } = scenario();
  startRun(db, task.task_id);
  finishRun(db, task.task_id, "succeeded");

  const { events } = taskEvents(db, task.task_id, 0);
  assert.ok(events.length >= 5, `事件太少：${events.length}`);

  for (const event of events) {
    check("events/envelope.schema.json", event, `第 ${event.sequence} 条事件`);
  }
  db.close();
});

test("契约：事件类型都在 v0 的枚举里", () => {
  // 契约里 event_type 是闭集合。新增事件是兼容变更，但得先加进 schema
  // 再发——反过来的话，客户端会收到它无法归类的东西。
  const enumerated = new Set(
    (
      JSON.parse(readFileSync(join(CONTRACTS, "events", "envelope.schema.json"), "utf8")) as {
        $defs: { event_type: { enum: string[] } };
      }
    ).$defs.event_type.enum,
  );

  const { db, task } = scenario();
  startRun(db, task.task_id);
  finishRun(db, task.task_id, "succeeded");

  for (const event of taskEvents(db, task.task_id, 0).events) {
    assert.ok(enumerated.has(event.type), `${event.type} 不在 contracts 的事件枚举里`);
  }
  db.close();
});

test("契约：事件的 aggregate_id 前缀和 aggregate_type 对得上", () => {
  // schema 里逐个 aggregate_type 写了 if/then。这条单独测是因为它最容易在
  // 加新事件时写错，而写错的后果是事件回放挂到错误的对象上。
  const { db, task } = scenario();
  const { run } = startRun(db, task.task_id);
  finishRun(db, task.task_id, "succeeded");

  for (const event of taskEvents(db, task.task_id, 0).events) {
    const expected = event.aggregate_type === "task" ? task.task_id : run.run_id;
    assert.equal(event.aggregate_id, expected, `${event.type} 挂错了对象`);
  }
  db.close();
});
