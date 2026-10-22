import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";

process.env.UNZOO_ONE_STATE_DIR = mkdtempSync(join(tmpdir(), "one-core-foundation-"));

const { newId, isId, ulid, nowIso } = await import("../src/ids.ts");
const { stateDir, statePath } = await import("../src/paths.ts");

/** 和 contracts/v0/common/primitives.schema.json 里的 pattern 保持一致。 */
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

test("ID：格式对得上契约里的 pattern", () => {
  for (const prefix of ["task", "run", "step", "call", "approval", "event"] as const) {
    const id = newId(prefix);
    assert.ok(id.startsWith(`${prefix}_`), id);
    assert.match(id.slice(prefix.length + 1), ULID, id);
    assert.ok(isId(prefix, id));
    assert.ok(!isId("run", newId("task")), "前缀不同就不该认");
  }
});

test("ID：不含 I L O U —— 手抄时最容易认错的四个", () => {
  const sample = Array.from({ length: 200 }, () => ulid()).join("");
  for (const bad of ["I", "L", "O", "U"]) {
    assert.ok(!sample.includes(bad), `不该出现 ${bad}`);
  }
});

test("ID：同一毫秒内严格单调，且不重复", () => {
  const at = 1_767_225_600_000;
  const ids = Array.from({ length: 500 }, () => ulid(at));

  assert.equal(new Set(ids).size, ids.length, "同毫秒内不能撞");
  const sorted = [...ids].sort();
  assert.deepEqual(ids, sorted, "字典序必须等于生成顺序——事件按 ID 排序要靠这个");
});

test("ID：时间前缀随时间推进", () => {
  const early = ulid(1_700_000_000_000);
  const late = ulid(1_800_000_000_000);
  assert.ok(early < late, "晚生成的 ID 必须排在后面");
});

test("时间：只产出 Z 结尾的 UTC", () => {
  const at = nowIso(1_767_225_600_123);
  assert.equal(at, "2026-01-01T00:00:00.123Z");
  assert.ok(at.endsWith("Z"), "存储层只留一种写法，比较和排序才不用考虑两种形式");
});

test("状态目录：环境变量优先", () => {
  assert.equal(stateDir(), process.env.UNZOO_ONE_STATE_DIR);
  assert.equal(statePath("core.json"), join(stateDir(), "core.json"));
});

test("状态目录：没有环境变量时按平台走数据目录", () => {
  // 只有一个状态目录是刻意的。unterm 那边有两个（~/.unterm 和平台数据目录），
  // supervisor 拿错路径把活着的 Core 报成 absent，文档还错了五处。
  const saved = process.env.UNZOO_ONE_STATE_DIR;
  delete process.env.UNZOO_ONE_STATE_DIR;
  try {
    const dir = stateDir();
    assert.ok(dir.length > 0);
    if (platform() === "win32") {
      assert.ok(dir.endsWith("UnzooOne"), dir);
    } else if (platform() === "darwin") {
      assert.ok(dir.includes("Application Support"), dir);
    } else {
      assert.ok(dir.includes("unzoo-one"), dir);
    }
  } finally {
    process.env.UNZOO_ONE_STATE_DIR = saved;
  }
});
