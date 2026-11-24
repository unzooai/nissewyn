/**
 * Core 进程入口。
 *
 * 启动顺序是有讲究的：
 *
 * 1. **先拿单实例锁**，再碰数据库。反过来的话，第二个实例会先打开同一个 SQLite
 *    文件，然后才发现自己不该启动。
 * 2. 起服务，拿到真实端口。
 * 3. 把 endpoint 写进锁（供别的进程探活）和 core.json（供客户端连接）。
 *
 * 退出时把 core.json 和锁一起清掉。留着的话，下一次启动会拿一个连不上的地址
 * 去探活，白等一个超时。
 */
import { writeFileSync, unlinkSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { acquire, LockUnavailable, type LockHeld } from "./lock.ts";
import { openDatabase } from "./db.ts";
import { newToken } from "./auth.ts";
import { startServer, type RunningServer } from "./server.ts";
import { ensureStateDir, statePath, CORE_JSON } from "./paths.ts";

export type CoreHandle = {
  endpoint: string;
  token: string;
  instanceId: string;
  db: DatabaseSync;
  stop: () => Promise<void>;
};

export async function start(): Promise<CoreHandle> {
  const lock: LockHeld = await acquire();

  let db: DatabaseSync | undefined;
  let running: RunningServer | undefined;
  try {
    db = openDatabase();
    const token = newToken();
    running = await startServer({ db, token, instanceId: lock.record.instance_id });

    lock.publish(running.endpoint);

    ensureStateDir();
    // 0600：token 在里面。同机器上的别的用户不该读到。
    writeFileSync(
      statePath(CORE_JSON),
      JSON.stringify(
        {
          endpoint: running.endpoint,
          token,
          instance_id: lock.record.instance_id,
          pid: process.pid,
          started_at: lock.record.started_at,
          contract: "contracts/v0",
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );

    const server = running;
    const database = db;
    let stopped = false;

    return {
      endpoint: server.endpoint,
      token,
      instanceId: lock.record.instance_id,
      db: database,
      stop: async () => {
        if (stopped) return;
        stopped = true;
        await server.close();
        database.close();
        try {
          unlinkSync(statePath(CORE_JSON));
        } catch {
          /* 已经没了就算了 */
        }
        lock.release();
      },
    };
  } catch (error) {
    // 起到一半失败：把已经拿到的东西还回去，别留下一个假的锁。
    await running?.close();
    db?.close();
    lock.release();
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    const core = await start();
    process.stdout.write(
      `one-core 已启动\n` +
        `  endpoint  ${core.endpoint}\n` +
        `  instance  ${core.instanceId}\n` +
        `  state     ${statePath("")}\n` +
        `  停止      Ctrl-C\n`,
    );

    const shutdown = (signal: string) => {
      process.stdout.write(`\n收到 ${signal}，正在停止…\n`);
      core
        .stop()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          process.stderr.write(`停止时出错：${String(error)}\n`);
          process.exit(1);
        });
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    if (error instanceof LockUnavailable) {
      // 这不是崩溃，是「已经有一个在跑了」。用退出码区分开，脚本才好判断。
      process.stderr.write(`${error.message}\n`);
      process.exit(3);
    }
    process.stderr.write(`启动失败：${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  }
}

if (import.meta.filename === process.argv[1]) {
  await main();
}
