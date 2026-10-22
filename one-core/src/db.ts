/**
 * 存储层。
 *
 * 一个 SQLite 文件就是全部真相。GUI 关掉、Core 重启、机器断电之后任务还在——
 * 这是 M1 的退出标准之一，也是「Core 是唯一事实来源」这句话的物理形式。
 *
 * 表的设计有一处刻意的取舍：每张表既有几个提出来的列（用于查询和约束），
 * 又存一份完整的 JSON `doc`。理由是 contracts/v0 是唯一事实来源，把它的每个
 * 字段都摊成列，等于把契约抄写了第二遍，改契约就要改两处、而且容易漏。
 * 提出来的列只是索引，doc 才是对象本身。
 */
import { DatabaseSync } from "node:sqlite";
import { ensureStateDir, statePath, DB_FILE } from "./paths.ts";

/** 改这个数字就要写一段迁移。当前版本的表结构见 SCHEMA。 */
const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE tasks (
  task_id    TEXT PRIMARY KEY,
  state      TEXT NOT NULL,
  mode       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  doc        TEXT NOT NULL
);
CREATE INDEX idx_tasks_state ON tasks (state, created_at);

CREATE TABLE runs (
  run_id  TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks (task_id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  state   TEXT NOT NULL,
  doc     TEXT NOT NULL
);
CREATE INDEX idx_runs_task ON runs (task_id, attempt);

CREATE TABLE events (
  event_id       TEXT PRIMARY KEY,
  task_id        TEXT NOT NULL,
  sequence       INTEGER NOT NULL,
  type           TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id   TEXT NOT NULL,
  run_id         TEXT,
  actor          TEXT NOT NULL,
  timestamp      TEXT NOT NULL,
  data           TEXT NOT NULL,
  prev_hash      TEXT,
  hash           TEXT NOT NULL,
  UNIQUE (task_id, sequence)
);
CREATE INDEX idx_events_cursor ON events (task_id, sequence);

-- 幂等键。同一个 key 再来一次返回上次的结果，而不是再做一遍。
CREATE TABLE idempotency (
  key        TEXT NOT NULL,
  scope      TEXT NOT NULL,
  result_id  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (scope, key)
);
`;

export function openDatabase(file?: string): DatabaseSync {
  const path = file ?? (ensureStateDir(), statePath(DB_FILE));
  const db = new DatabaseSync(path);

  // WAL：读不挡写。Core 一边写事件，客户端一边按 cursor 读，这是常态。
  db.exec("PRAGMA journal_mode = WAL");
  // 外键默认是关的。runs 靠它级联，不开等于没写。
  db.exec("PRAGMA foreign_keys = ON");
  // 拿不到写锁时先等，不要立刻抛 SQLITE_BUSY。
  db.exec("PRAGMA busy_timeout = 5000");

  migrate(db);
  return db;
}

function migrate(db: DatabaseSync): void {
  const row = db.prepare("PRAGMA user_version").get() as { user_version?: number } | undefined;
  const current = typeof row?.user_version === "number" ? row.user_version : 0;

  if (current === SCHEMA_VERSION) return;
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `这个库是版本 ${current} 建的，当前程序只认到 ${SCHEMA_VERSION}。` +
        `降级会写坏数据，拒绝启动。`,
    );
  }

  // v0 → v1 就是建表。以后加迁移在这里按版本号往下接。
  if (current === 0) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(SCHEMA);
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
