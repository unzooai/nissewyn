/**
 * 事件日志。
 *
 * 客户端不轮询对象，它按 cursor 追事件。这带来三条要求，都在这里实现：
 *
 * 1. **每个 Task 内单调、不跳号。** 客户端拿 cursor=N 回来，看到 N+1 就知道
 *    没漏。序号在写事务里取，两个并发写入不会拿到同一个号。
 * 2. **断线可续。** cursor 是序号本身，不是不透明游标，客户端存下来就行。
 * 3. **可验证。** 每条事件带 prev_hash，串成链。导出时附 manifest，篡改中间
 *    一条会让后面全部对不上。
 *
 * 序号是 **per task** 的，不是全局的。跨 Task 之间不可比——这是刻意的：
 * 全局序号会让每次写入都去争同一行，任务一多就成瓶颈。
 */
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { newId, nowIso } from "./ids.ts";

export type Actor = {
  type: "user" | "core" | "brain" | "provider" | "automation" | "system";
  id: string;
};

export type AggregateType =
  | "task"
  | "run"
  | "step"
  | "tool_call"
  | "approval"
  | "grant"
  | "artifact"
  | "provider"
  | "inbox"
  | "brain_thread";

export type EventInput = {
  type: string;
  aggregate_type: AggregateType;
  aggregate_id: string;
  task_id: string;
  run_id?: string | null;
  actor: Actor;
  data?: Record<string, unknown>;
};

/** 对外的事件信封，形状由 contracts/v0/events/envelope.schema.json 约束。 */
export type EventEnvelope = {
  schema_version: "event.v0";
  event_id: string;
  sequence: number;
  type: string;
  aggregate_type: AggregateType;
  aggregate_id: string;
  task_id: string;
  run_id: string | null;
  actor: Actor;
  timestamp: string;
  data: Record<string, unknown>;
  prev_hash?: string;
};

/**
 * 规范化 JSON：键按码位排序，无空白。
 *
 * 哈希链要跨语言可验证——unterm 是 Rust、unzoo 可能是别的——所以「同一个对象
 * 序列化成同一串字节」这件事必须有明确规则，不能依赖某个语言的默认行为。
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** 一条事件的哈希 = 规范化 JSON 的 sha256。prev_hash 参与计算，所以成链。 */
export function hashEvent(envelope: EventEnvelope): string {
  return createHash("sha256").update(canonicalJson(envelope), "utf8").digest("hex");
}

/**
 * 追加一条事件。
 *
 * 整段在 `BEGIN IMMEDIATE` 里：取序号和写入必须是一个原子操作，否则两个并发
 * 写入会读到同一个 max(sequence)，然后一个撞在 UNIQUE 上失败——那是能自愈的，
 * 但会把「不跳号」这条变成运气问题。IMMEDIATE 在事务开始时就拿写锁，直接避开。
 */
export function append(db: DatabaseSync, input: EventInput): EventEnvelope {
  db.exec("BEGIN IMMEDIATE");
  try {
    const previous = db
      .prepare("SELECT sequence, hash FROM events WHERE task_id = ? ORDER BY sequence DESC LIMIT 1")
      .get(input.task_id) as { sequence: number; hash: string } | undefined;

    const envelope: EventEnvelope = {
      schema_version: "event.v0",
      event_id: newId("event"),
      sequence: (previous?.sequence ?? 0) + 1,
      type: input.type,
      aggregate_type: input.aggregate_type,
      aggregate_id: input.aggregate_id,
      task_id: input.task_id,
      run_id: input.run_id ?? null,
      actor: input.actor,
      timestamp: nowIso(),
      data: input.data ?? {},
      ...(previous ? { prev_hash: previous.hash } : {}),
    };

    db.prepare(
      `INSERT INTO events
         (event_id, task_id, sequence, type, aggregate_type, aggregate_id,
          run_id, actor, timestamp, data, prev_hash, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      envelope.event_id,
      envelope.task_id,
      envelope.sequence,
      envelope.type,
      envelope.aggregate_type,
      envelope.aggregate_id,
      envelope.run_id,
      JSON.stringify(envelope.actor),
      envelope.timestamp,
      JSON.stringify(envelope.data),
      envelope.prev_hash ?? null,
      hashEvent(envelope),
    );

    db.exec("COMMIT");
    return envelope;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function toEnvelope(row: Record<string, unknown>): EventEnvelope {
  const prevHash = row.prev_hash;
  return {
    schema_version: "event.v0",
    event_id: String(row.event_id),
    sequence: Number(row.sequence),
    type: String(row.type),
    aggregate_type: String(row.aggregate_type) as AggregateType,
    aggregate_id: String(row.aggregate_id),
    task_id: String(row.task_id),
    run_id: row.run_id === null ? null : String(row.run_id),
    actor: JSON.parse(String(row.actor)) as Actor,
    timestamp: String(row.timestamp),
    data: JSON.parse(String(row.data)) as Record<string, unknown>,
    ...(typeof prevHash === "string" ? { prev_hash: prevHash } : {}),
  };
}

/**
 * 读 cursor 之后的事件。
 *
 * `cursor` 是「已经收到的最后一个 sequence」，返回的 cursor 是这批里最后一个。
 * 没有新事件时返回原样的 cursor 和空数组——不是错误，是「还没有新的」。
 */
export function since(
  db: DatabaseSync,
  taskId: string,
  cursor: number,
  limit = 500,
): { cursor: number; events: EventEnvelope[] } {
  const rows = db
    .prepare(
      `SELECT * FROM events
        WHERE task_id = ? AND sequence > ?
        ORDER BY sequence ASC
        LIMIT ?`,
    )
    .all(taskId, cursor, limit) as Record<string, unknown>[];

  const events = rows.map(toEnvelope);
  return { cursor: events.at(-1)?.sequence ?? cursor, events };
}

/**
 * 验证一个 Task 的事件链。
 *
 * 三件事一起验：序号不跳、prev_hash 接得上、每条的哈希和内容对得上。
 * 导出证据包时跑它，导入方也跑它。
 */
export function verifyChain(db: DatabaseSync, taskId: string): { ok: boolean; detail: string } {
  const rows = db
    .prepare("SELECT * FROM events WHERE task_id = ? ORDER BY sequence ASC")
    .all(taskId) as Record<string, unknown>[];

  let expectedSequence = 1;
  let expectedPrev: string | undefined;

  for (const row of rows) {
    const envelope = toEnvelope(row);
    if (envelope.sequence !== expectedSequence) {
      return { ok: false, detail: `序号跳了：应为 ${expectedSequence}，实际 ${envelope.sequence}` };
    }
    if (envelope.prev_hash !== expectedPrev) {
      return { ok: false, detail: `第 ${envelope.sequence} 条的 prev_hash 接不上前一条` };
    }
    const recomputed = hashEvent(envelope);
    if (recomputed !== String(row.hash)) {
      return { ok: false, detail: `第 ${envelope.sequence} 条内容与哈希不符，可能被改过` };
    }
    expectedSequence += 1;
    expectedPrev = recomputed;
  }

  return { ok: true, detail: `${rows.length} 条事件，链完整` };
}
