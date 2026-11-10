import assert from "node:assert/strict";
import { test } from "node:test";

import {
  mergeRuntimeTasks,
  putSignature,
  scheduleOf,
  statusFrom,
  toRuntimePut,
  toTaskRun,
} from "../.test-build/runtime-tasks.mjs";

const task = {
  id: "task-1",
  title: "周报",
  description: "汇总本周提交",
  target: "演示仓库",
  status: "待确认",
  progress: 0,
  updated: "刚刚",
  schedule: "每周",
  scheduleTime: "17:30",
  scheduleDay: "周五",
  runs: [{ id: "run-old", status: "成功", startedAt: "2026-11-01T00:00:00Z", summary: "x" }],
};

test("推给运行时的：提示词、计划、暂停；运行记录不推", () => {
  const put = toRuntimePut(task);
  assert.equal(put.prompt, "周报\n汇总本周提交\n目标：演示仓库");
  assert.deepEqual(put.schedule, { kind: "weekly", time: "17:30", weekday: 5 });
  assert.equal(put.paused, false);
  assert.equal("runs" in put.console, false);
  assert.equal(toRuntimePut({ ...task, status: "已暂停" }).paused, true);
  assert.deepEqual(scheduleOf({ ...task, schedule: "每天", scheduleTime: undefined }), { kind: "daily", time: "09:00" });
  assert.equal(scheduleOf({ ...task, schedule: "仅运行一次" }), null);
});

test("运行时读回来的状态和进度变了，不算要再推", () => {
  const before = putSignature(task);
  assert.equal(putSignature({ ...task, status: "运行中", progress: 40, runs: [] }), before);
  assert.notEqual(putSignature({ ...task, title: "月报" }), before);
});

test("一次运行在控制台里的样子", () => {
  const waiting = toTaskRun({
    id: "run-1",
    attempt: 1,
    state: "running",
    started_at: "2026-11-10T11:40:45Z",
    waiting: true,
    session_id: "ags_1",
  });
  assert.equal(waiting.status, "运行中");
  assert.equal(waiting.summary, "等你在收件箱确认一次工具调用");
  assert.equal(waiting.sessionId, "ags_1");

  const done = toTaskRun({
    id: "run-1",
    attempt: 1,
    state: "succeeded",
    started_at: "2026-11-10T11:40:45Z",
    ended_at: "2026-11-10T11:40:58Z",
    trigger: "schedule",
    summary: "已新建 hello.txt",
  });
  assert.equal(done.status, "成功");
  assert.equal(done.durationSeconds, 13);
  assert.equal(done.summary, "按计划运行 · 已新建 hello.txt");

  const lost = toTaskRun({ id: "r", attempt: 2, state: "interrupted", started_at: "x", error: "Unterm stopped" });
  assert.equal(lost.status, "失败");
  assert.equal(lost.errorMessage, "Unterm stopped");
  assert.equal(toTaskRun({ id: "r", attempt: 3, state: "cancelled", started_at: "x" }).status, "已取消");
});

test("任务状态由最近一次运行决定", () => {
  const remote = (runs, paused = false) => ({ id: "t", title: "t", created_at: "", updated_at: "", paused, runs });
  const run = (state) => ({ id: state, attempt: 1, state, started_at: "2026-11-10T00:00:00Z" });
  assert.equal(statusFrom(remote([run("running")], true), "已暂停"), "运行中");
  assert.equal(statusFrom(remote([run("succeeded")], true), "已完成"), "已暂停");
  assert.equal(statusFrom(remote([run("succeeded")]), "运行中"), "已完成");
  assert.equal(statusFrom(remote([run("cancelled")]), "运行中"), "已暂停");
  assert.equal(statusFrom(remote([run("interrupted")]), "运行中"), "失败");
  assert.equal(statusFrom(remote([]), "待确认"), "待确认");
});

test("合并：只动运行时说了算的，刚发起的运行不闪掉，别处建的任务带上来", () => {
  const now = Date.parse("2026-11-10T12:00:10Z");
  const local = [
    { ...task, title: "周报（正在改）", runs: [{ id: "run-new", status: "运行中", startedAt: "2026-11-10T12:00:00Z", summary: "" }] },
    { ...task, id: "task-local-only", runs: [] },
  ];
  const remote = [
    {
      id: "task-1",
      title: "周报",
      created_at: "",
      updated_at: "",
      paused: false,
      runs: [{ id: "run-old", attempt: 1, state: "succeeded", started_at: "2026-11-01T00:00:00Z", summary: "上周的" }],
    },
    {
      id: "task-elsewhere",
      title: "另一台浏览器建的",
      created_at: "",
      updated_at: "",
      paused: false,
      console: { ...task, id: "task-elsewhere", title: "另一台浏览器建的" },
      runs: [],
    },
    { id: "task-gone", title: "刚删的", created_at: "", updated_at: "", paused: false, runs: [] },
  ];
  const merged = mergeRuntimeTasks(local, remote, now, new Set(["task-gone"]));
  assert.deepEqual(merged.map((t) => t.id), ["task-elsewhere", "task-1", "task-local-only"]);
  const mine = merged[1];
  assert.equal(mine.title, "周报（正在改）", "页面上正在改的不被覆盖");
  assert.equal(mine.status, "运行中", "刚发起、运行时还没记下的运行算在跑");
  assert.deepEqual(mine.runs.map((r) => r.id), ["run-new", "run-old"]);

  // 半分钟后运行时还没有它，就不再当它在跑。
  const later = mergeRuntimeTasks(local, remote, now + 60_000).find((t) => t.id === "task-1");
  assert.equal(later.status, "已完成");
  assert.deepEqual(later.runs.map((r) => r.id), ["run-old"]);
});
