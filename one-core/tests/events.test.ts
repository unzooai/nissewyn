import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UNZOO_ONE_STATE_DIR = mkdtempSync(join(tmpdir(), "one-core-events-"));

const { openDatabase } = await import("../src/db.ts");
const { append, since, verifyChain, canonicalJson, hashEvent } = await import("../src/events.ts");
const { newId } = await import("../src/ids.ts");

function fresh() {
  const db = openDatabase(":memory:");
  const taskId = newId("task");
  return { db, taskId };
}

const emit = (db: ReturnType<typeof openDatabase>, taskId: string, type: string) =>
  append(db, {
    type,
    aggregate_type: "task",
    aggregate_id: taskId,
    task_id: taskId,
    actor: { type: "core", id: "one_core" },
    data: { note: type },
  });

test("事件：序号从 1 开始，单调，不跳号", () => {
  const { db, taskId } = fresh();
  const written = Array.from({ length: 25 }, (_, i) => emit(db, taskId, `t.${i}`));

  assert.deepEqual(
    written.map((e) => e.sequence),
    Array.from({ length: 25 }, (_, i) => i + 1),
  );
  db.close();
});

test("事件：序号是 per task 的，跨任务不可比", () => {
  const { db, taskId } = fresh();
  const other = newId("task");

  emit(db, taskId, "a");
  emit(db, taskId, "b");
  const first = emit(db, other, "a");

  assert.equal(first.sequence, 1, "另一个任务从 1 重新开始");
  db.close();
});

test("事件：按 cursor 分页，读完之后返回空而不是报错", () => {
  const { db, taskId } = fresh();
  for (let i = 0; i < 7; i += 1) emit(db, taskId, `t.${i}`);

  const seen: number[] = [];
  let cursor = 0;
  for (;;) {
    const page = since(db, taskId, cursor, 3);
    if (page.events.length === 0) break;
    seen.push(...page.events.map((e) => e.sequence));
    assert.equal(page.cursor, page.events.at(-1)?.sequence);
    cursor = page.cursor;
  }

  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7], "分页不重不漏");

  const empty = since(db, taskId, cursor);
  assert.deepEqual(empty.events, []);
  assert.equal(empty.cursor, cursor, "没有新事件时 cursor 原样返回");
  db.close();
});

test("事件：第一条没有 prev_hash，后面每条都接得上", () => {
  const { db, taskId } = fresh();
  const first = emit(db, taskId, "a");
  const second = emit(db, taskId, "b");

  assert.equal(first.prev_hash, undefined, "第一条没有前一条");
  assert.equal(second.prev_hash, hashEvent(first));

  const check = verifyChain(db, taskId);
  assert.ok(check.ok, check.detail);
  db.close();
});

test("事件：改过库里的内容，验链就会发现", () => {
  const { db, taskId } = fresh();
  emit(db, taskId, "a");
  emit(db, taskId, "b");
  emit(db, taskId, "c");
  assert.ok(verifyChain(db, taskId).ok);

  // 绕过 append 直接改第 2 条的 data —— 模拟有人动了数据库文件。
  db.prepare("UPDATE events SET data = ? WHERE task_id = ? AND sequence = 2").run(
    JSON.stringify({ note: "偷偷改掉" }),
    taskId,
  );

  const check = verifyChain(db, taskId);
  assert.equal(check.ok, false);
  assert.match(check.detail, /第 2 条/, check.detail);
  db.close();
});

test("事件：删掉中间一条会被序号检查抓住", () => {
  const { db, taskId } = fresh();
  for (let i = 0; i < 4; i += 1) emit(db, taskId, `t.${i}`);

  db.prepare("DELETE FROM events WHERE task_id = ? AND sequence = 2").run(taskId);

  const check = verifyChain(db, taskId);
  assert.equal(check.ok, false);
  assert.match(check.detail, /序号跳了/, check.detail);
  db.close();
});

test("事件：同一个序号插两次会被唯一约束挡住", () => {
  const { db, taskId } = fresh();
  const first = emit(db, taskId, "a");

  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO events (event_id, task_id, sequence, type, aggregate_type,
             aggregate_id, run_id, actor, timestamp, data, prev_hash, hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          newId("event"),
          taskId,
          first.sequence,
          "dup",
          "task",
          taskId,
          null,
          "{}",
          first.timestamp,
          "{}",
          null,
          "x",
        ),
    /UNIQUE/i,
    "「不跳号」不能只靠应用层自觉，库里也得挡住",
  );
  db.close();
});

test("规范化 JSON：键序不影响结果，undefined 不参与", () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
  assert.equal(canonicalJson({ a: 1, b: undefined }), '{"a":1}');
  assert.equal(canonicalJson({ x: [3, { z: 1, y: 2 }] }), '{"x":[3,{"y":2,"z":1}]}');
  // 跨语言可验证的前提：同一个对象序列化成同一串字节，不依赖某个语言的默认行为。
  assert.equal(canonicalJson(null), "null");
  assert.equal(canonicalJson("中文"), '"中文"');
});
