/**
 * 任务生命周期。
 *
 * 这一层只做两件事：把对象写进库，以及为每次状态变化追加一条事件。**顺序是
 * 先写对象再写事件，两者在同一个逻辑操作里**——事件是对外的唯一叙述，对象和
 * 事件对不上的话，客户端看到的历史就是假的。
 *
 * 对象的形状全部按 contracts/v0。tests/contracts.test.ts 拿真 schema 校验这里
 * 产出的每一个对象，所以字段名写错在测试里就会红，不用等到跨仓库联调。
 */
import type { DatabaseSync } from "node:sqlite";
import { newId, nowIso } from "./ids.ts";
import { append, since, type Actor, type EventEnvelope } from "./events.ts";

export type TaskMode = "ask" | "work" | "code" | "automate";
export type PermissionMode = "ask" | "plan" | "interactive" | "scoped_auto" | "custom";

export type Task = {
  schema_version: "task.v0";
  task_id: string;
  title: string;
  goal: string;
  mode: TaskMode;
  state: string;
  created_by: string;
  permission_mode: PermissionMode;
  workspace_refs?: string[];
  profile_refs?: string[];
  preferred_brain?: string;
  automation_id?: string;
  budget?: Record<string, number>;
  active_run_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Run = {
  schema_version: "run.v0";
  run_id: string;
  task_id: string;
  attempt: number;
  trigger: { type: string; ref: string | null };
  state: string;
  brain_thread_ids?: string[];
  started_at: string;
  finished_at: string | null;
  result_summary: string | null;
  error: null;
};

export type CreateTaskInput = {
  title: string;
  goal: string;
  mode: TaskMode;
  permission_mode?: PermissionMode;
  created_by?: string;
  workspace_refs?: string[];
  profile_refs?: string[];
  preferred_brain?: string;
  automation_id?: string;
  budget?: Record<string, number>;
};

const USER: Actor = { type: "user", id: "user_local" };
const CORE: Actor = { type: "core", id: "one_core" };

/** 终态。到了这里就不再回到 running——要继续干活是开新 Run。 */
const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

function readTask(db: DatabaseSync, taskId: string): Task | null {
  const row = db.prepare("SELECT doc FROM tasks WHERE task_id = ?").get(taskId) as
    | { doc: string }
    | undefined;
  return row ? (JSON.parse(row.doc) as Task) : null;
}

function saveTask(db: DatabaseSync, task: Task): void {
  db.prepare(
    `INSERT INTO tasks (task_id, state, mode, created_at, updated_at, doc)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (task_id) DO UPDATE SET
       state = excluded.state,
       updated_at = excluded.updated_at,
       doc = excluded.doc`,
  ).run(task.task_id, task.state, task.mode, task.created_at, task.updated_at, JSON.stringify(task));
}

function saveRun(db: DatabaseSync, run: Run): void {
  db.prepare(
    `INSERT INTO runs (run_id, task_id, attempt, state, doc)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (run_id) DO UPDATE SET
       state = excluded.state,
       doc = excluded.doc`,
  ).run(run.run_id, run.task_id, run.attempt, run.state, JSON.stringify(run));
}

export class StoreError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "StoreError";
    this.code = code;
    this.status = status;
  }
}

/**
 * 建任务。
 *
 * 带 `Idempotency-Key` 时同一个键只建一次——重复的键返回上次那个任务，不是新建
 * 一个。这条是给重试用的：客户端发出请求之后连接断了，它不知道服务端做没做，
 * 只能重发；没有幂等键的话，重发就多一个任务。
 */
export function createTask(
  db: DatabaseSync,
  input: CreateTaskInput,
  idempotencyKey?: string,
): { task: Task; created: boolean } {
  if (!input.title?.trim()) throw new StoreError("validation.missing_title", 400, "title 不能为空");
  if (!input.goal?.trim()) throw new StoreError("validation.missing_goal", 400, "goal 不能为空");
  if (input.mode === "automate" && !input.automation_id) {
    // 契约里这条是硬约束：automate 的任务必须回指来源，否则 Run History
    // 和 Attention Route 找不到归属。
    throw new StoreError(
      "validation.missing_automation_id",
      400,
      "mode 为 automate 时必须给 automation_id",
    );
  }

  if (idempotencyKey) {
    const seen = db
      .prepare("SELECT result_id FROM idempotency WHERE scope = ? AND key = ?")
      .get("task.create", idempotencyKey) as { result_id: string } | undefined;
    if (seen) {
      const existing = readTask(db, seen.result_id);
      if (existing) return { task: existing, created: false };
    }
  }

  const at = nowIso();
  const task: Task = {
    schema_version: "task.v0",
    task_id: newId("task"),
    title: input.title.trim(),
    goal: input.goal.trim(),
    mode: input.mode,
    state: "queued",
    created_by: input.created_by ?? "user_local",
    permission_mode: input.permission_mode ?? "interactive",
    active_run_id: null,
    created_at: at,
    updated_at: at,
    ...(input.workspace_refs ? { workspace_refs: input.workspace_refs } : {}),
    ...(input.profile_refs ? { profile_refs: input.profile_refs } : {}),
    ...(input.preferred_brain ? { preferred_brain: input.preferred_brain } : {}),
    ...(input.automation_id ? { automation_id: input.automation_id } : {}),
    ...(input.budget ? { budget: input.budget } : {}),
  };

  saveTask(db, task);
  if (idempotencyKey) {
    db.prepare(
      "INSERT INTO idempotency (key, scope, result_id, created_at) VALUES (?, ?, ?, ?)",
    ).run(idempotencyKey, "task.create", task.task_id, at);
  }

  append(db, {
    type: "task.created",
    aggregate_type: "task",
    aggregate_id: task.task_id,
    task_id: task.task_id,
    actor: USER,
    data: { title: task.title, mode: task.mode, permission_mode: task.permission_mode },
  });

  return { task, created: true };
}

export function listTasks(db: DatabaseSync): Task[] {
  const rows = db
    .prepare("SELECT doc FROM tasks ORDER BY created_at DESC")
    .all() as { doc: string }[];
  return rows.map((row) => JSON.parse(row.doc) as Task);
}

export function getTask(db: DatabaseSync, taskId: string): Task {
  const task = readTask(db, taskId);
  if (!task) throw new StoreError("task.not_found", 404, `没有这个任务：${taskId}`);
  return task;
}

/** 改任务状态并记一条事件。from/to 都写进事件，读历史时不用去比对前后两条。 */
function transition(db: DatabaseSync, task: Task, to: string, actor: Actor): Task {
  const from = task.state;
  const updated: Task = {
    ...task,
    state: to,
    updated_at: nowIso(),
    active_run_id: TERMINAL.has(to) ? null : task.active_run_id,
  };
  saveTask(db, updated);
  append(db, {
    type: "task.state_changed",
    aggregate_type: "task",
    aggregate_id: task.task_id,
    task_id: task.task_id,
    run_id: updated.active_run_id,
    actor,
    data: { from, to },
  });
  return updated;
}

/**
 * 开一次 Run。
 *
 * 同一个 Task 默认最多一个活动 Run。这里直接拒绝而不是排队——排队策略属于
 * Automation 的 concurrency_policy，不该在这一层偷偷决定。
 */
export function startRun(db: DatabaseSync, taskId: string): { task: Task; run: Run } {
  const task = getTask(db, taskId);
  if (TERMINAL.has(task.state)) {
    throw new StoreError(
      "task.terminal",
      409,
      `任务已是终态（${task.state}），要继续请新建任务或新建 Run 的上层流程`,
    );
  }
  if (task.active_run_id) {
    throw new StoreError("task.run_active", 409, `已经有活动 Run：${task.active_run_id}`);
  }

  const previous = db
    .prepare("SELECT COUNT(*) AS n FROM runs WHERE task_id = ?")
    .get(taskId) as { n: number };

  const run: Run = {
    schema_version: "run.v0",
    run_id: newId("run"),
    task_id: taskId,
    attempt: Number(previous.n) + 1,
    trigger: { type: "user", ref: null },
    state: "running",
    started_at: nowIso(),
    finished_at: null,
    result_summary: null,
    error: null,
  };
  saveRun(db, run);

  const withRun: Task = { ...task, active_run_id: run.run_id, updated_at: nowIso() };
  saveTask(db, withRun);

  append(db, {
    type: "run.started",
    aggregate_type: "run",
    aggregate_id: run.run_id,
    task_id: taskId,
    run_id: run.run_id,
    actor: CORE,
    data: { attempt: run.attempt },
  });

  return { task: transition(db, withRun, "running", CORE), run };
}

/** 收尾一次 Run，并把任务带到对应终态。 */
export function finishRun(
  db: DatabaseSync,
  taskId: string,
  outcome: "succeeded" | "failed",
  summary?: string,
): { task: Task; run: Run } {
  const task = getTask(db, taskId);
  if (!task.active_run_id) throw new StoreError("task.no_active_run", 409, "没有活动 Run");

  const row = db.prepare("SELECT doc FROM runs WHERE run_id = ?").get(task.active_run_id) as
    | { doc: string }
    | undefined;
  if (!row) throw new StoreError("internal.run_missing", 500, "活动 Run 在库里找不到");

  const run: Run = {
    ...(JSON.parse(row.doc) as Run),
    state: outcome,
    finished_at: nowIso(),
    result_summary: summary ?? null,
  };
  saveRun(db, run);

  append(db, {
    type: "run.completed",
    aggregate_type: "run",
    aggregate_id: run.run_id,
    task_id: taskId,
    run_id: run.run_id,
    actor: CORE,
    data: { state: outcome, ...(summary ? { result_summary: summary } : {}) },
  });

  return { task: transition(db, task, outcome, CORE), run };
}

/**
 * 取消。
 *
 * 骨架阶段直接落到 cancelled。真做起来要先进 cancelling、把取消送到 Brain 和
 * Provider、确认对面真的停了才算——契约里 `cancelling → cancelled | cancel_failed`
 * 那个分叉就是为这件事留的。这里先不假装做到了。
 */
export function cancelTask(db: DatabaseSync, taskId: string): Task {
  const task = getTask(db, taskId);
  if (TERMINAL.has(task.state)) return task;
  return transition(db, task, "cancelled", USER);
}

export function taskEvents(
  db: DatabaseSync,
  taskId: string,
  cursor: number,
  limit?: number,
): { cursor: number; events: EventEnvelope[] } {
  getTask(db, taskId);
  return since(db, taskId, cursor, limit);
}
