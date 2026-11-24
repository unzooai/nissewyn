/**
 * 「Core 重启后任务不会消失」是 M1 的退出标准之一。
 *
 * 别的测试大多跑在 `:memory:` 上——快，而且互不干扰。但正因为如此，它们
 * 证明不了持久化：内存库关掉就没了，测不出「关掉再开还在」。这一份专门用
 * 文件库，关掉、重新打开、再读。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UNZOO_ONE_STATE_DIR = mkdtempSync(join(tmpdir(), "one-core-persist-"));

const { openDatabase } = await import("../src/db.ts");
const { createTask, startRun, finishRun, getTask, listTasks, taskEvents } = await import(
  "../src/store.ts"
);
const { verifyChain } = await import("../src/events.ts");

const dbFile = join(process.env.UNZOO_ONE_STATE_DIR as string, "persist.db");

test("持久化：关掉再打开，任务、Run 和事件都还在", () => {
  let taskId: string;
  let runId: string;

  {
    const db = openDatabase(dbFile);
    const { task } = createTask(db, {
      title: "重启之后我还得在",
      goal: "验证 Core 重启不丢任务",
      mode: "work",
    });
    taskId = task.task_id;
    const started = startRun(db, taskId);
    runId = started.run.run_id;
    finishRun(db, taskId, "succeeded", "干完了");
    db.close();
  }

  // 到这里为止，相当于 Core 进程已经退出。下面是重新启动。
  {
    const db = openDatabase(dbFile);

    const task = getTask(db, taskId);
    assert.equal(task.state, "succeeded");
    assert.equal(task.title, "重启之后我还得在");
    assert.equal(listTasks(db).length, 1);

    const { events } = taskEvents(db, taskId, 0);
    assert.deepEqual(
      events.map((e) => e.type),
      [
        "task.created",
        "run.started",
        "task.state_changed",
        "run.completed",
        "task.state_changed",
      ],
    );
    assert.ok(events.some((e) => e.aggregate_id === runId));

    // 链要跨重启成立——哈希是按内容算的，不依赖任何进程内状态。
    const check = verifyChain(db, taskId);
    assert.ok(check.ok, check.detail);
    db.close();
  }
});

test("持久化：重新打开之后序号接着往下走，不从 1 重来", () => {
  const file = join(process.env.UNZOO_ONE_STATE_DIR as string, "seq.db");
  let taskId: string;

  {
    const db = openDatabase(file);
    const { task } = createTask(db, { title: "接着数", goal: "验证序号", mode: "work" });
    taskId = task.task_id;
    startRun(db, taskId);
    db.close();
  }

  {
    const db = openDatabase(file);
    const before = taskEvents(db, taskId, 0).events.at(-1)?.sequence;
    assert.ok(before && before > 0);

    finishRun(db, taskId, "succeeded");
    const after = taskEvents(db, taskId, 0).events;

    assert.equal(after.at(-1)?.sequence, before + 2, "重启不该让序号重来");
    assert.ok(verifyChain(db, taskId).ok, "跨重启的链也要接得上");
    db.close();
  }
});

test("持久化：幂等键跨重启仍然有效", () => {
  const file = join(process.env.UNZOO_ONE_STATE_DIR as string, "idem.db");
  const input = { title: "只建一次", goal: "验证幂等跨重启", mode: "work" as const };
  let firstId: string;

  {
    const db = openDatabase(file);
    firstId = createTask(db, input, "key-across-restart").task.task_id;
    db.close();
  }

  {
    // 客户端在 Core 重启后重发同一个请求——最容易发生的场景就是它没等到响应。
    const db = openDatabase(file);
    const second = createTask(db, input, "key-across-restart");
    assert.equal(second.created, false);
    assert.equal(second.task.task_id, firstId);
    assert.equal(listTasks(db).length, 1);
    db.close();
  }
});

test("持久化：库的版本比程序新时拒绝启动，而不是照着写", () => {
  const file = join(process.env.UNZOO_ONE_STATE_DIR as string, "future.db");
  {
    const db = openDatabase(file);
    db.exec("PRAGMA user_version = 99");
    db.close();
  }
  assert.throws(() => openDatabase(file), /降级会写坏数据/);
});
