import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.UNZOO_ONE_STATE_DIR = mkdtempSync(join(tmpdir(), "one-core-lock-"));

const { acquire, inspect, LockUnavailable } = await import("../src/lock.ts");
const { statePath, LOCK_JSON, ensureStateDir } = await import("../src/paths.ts");

/** 跑一个立刻退出的进程，拿它的 pid——退出之后这个 pid 保证是死的。 */
function deadPid(): number {
  const child = spawnSync(process.execPath, ["-e", ""]);
  assert.ok(child.pid, "拿不到子进程 pid");
  return child.pid as number;
}

function writeRawLock(record: Record<string, unknown>): void {
  ensureStateDir();
  writeFileSync(statePath(LOCK_JSON), JSON.stringify(record), { mode: 0o600 });
}

test("锁：拿到之后文件在，释放之后文件没了", async () => {
  const held = await acquire();
  assert.ok(existsSync(statePath(LOCK_JSON)));
  assert.equal(inspect()?.pid, process.pid);

  held.publish("http://127.0.0.1:12345");
  assert.equal(inspect()?.endpoint, "http://127.0.0.1:12345");

  held.release();
  assert.ok(!existsSync(statePath(LOCK_JSON)));
});

test("锁：持有者进程已死时接管", async () => {
  writeRawLock({
    instance_id: "inst_dead",
    pid: deadPid(),
    started_at: new Date().toISOString(),
    endpoint: "http://127.0.0.1:1",
  });

  const held = await acquire({ probeTimeoutMs: 200 });
  assert.equal(inspect()?.pid, process.pid, "陈旧锁应该被接管");
  held.release();
});

test("锁：持有者还活着但探不通时拒绝启动，而不是硬抢", async () => {
  // 用自己的 pid：进程当然活着，endpoint 指向一个没人监听的端口，探活必然失败。
  // 这就是 pid 复用和 Core 卡死从外面看不出区别的那种情况。
  writeRawLock({
    instance_id: "inst_other",
    pid: process.pid,
    started_at: new Date().toISOString(),
    endpoint: "http://127.0.0.1:1",
  });

  await assert.rejects(
    () => acquire({ probeTimeoutMs: 200 }),
    (error: unknown) => {
      assert.ok(error instanceof LockUnavailable);
      assert.equal(error.busy.reason, "unverifiable");
      // 错误信息里必须给出锁文件路径——用户确认进程死了之后要能自己删。
      assert.ok(error.message.includes(statePath(LOCK_JSON)), error.message);
      return true;
    },
    "猜错的代价不对称：猜「陈旧」会让两个 Core 抢一个库，猜「活着」只是多删一个文件",
  );

  assert.equal(inspect()?.instance_id, "inst_other", "拒绝之后不能动别人的锁");
});

test("锁：内容损坏等同于没有锁", async () => {
  ensureStateDir();
  writeFileSync(statePath(LOCK_JSON), "{ 写到一半断电了");
  const held = await acquire({ probeTimeoutMs: 200 });
  assert.equal(inspect()?.pid, process.pid);
  held.release();
});

test("锁：release 只删自己的，不动接管者的", async () => {
  const held = await acquire();
  const mine = held.record.instance_id;

  // 模拟别人接管：把锁文件换成另一个实例的。
  writeRawLock({
    instance_id: "inst_took_over",
    pid: process.pid,
    started_at: new Date().toISOString(),
    endpoint: null,
  });

  held.release();
  const after = inspect();
  assert.equal(after?.instance_id, "inst_took_over", "不能把接管者的锁删掉");
  assert.notEqual(after?.instance_id, mine);
  assert.ok(JSON.parse(readFileSync(statePath(LOCK_JSON), "utf8")));
});
