/**
 * 单实例。
 *
 * 两个 Core 同时开着比没有 Core 更糟：它们会各自持有同一个 SQLite 文件、
 * 各自签发 Grant、各自认为自己是事实来源。所以启动的第一件事是拿锁，
 * 拿不到就不启动。
 *
 * 锁用「独占创建文件」实现（`wx`），这是文件系统层面的原子操作，两个进程
 * 同时创建只有一个成功——不需要额外的协调者。
 *
 * 难的是判断锁里记的那个进程还活着没有。pid 会被复用，光看 pid 存在不够。
 * 这里的判断：
 *
 * | pid 存活 | 探活 endpoint | 结论 |
 * |---|---|---|
 * | 否 | — | 陈旧锁，接管 |
 * | 是 | 通 | 真的在跑，拒绝启动 |
 * | 是 | 不通 | **拒绝启动**，并把锁文件路径告诉用户 |
 *
 * 最后一行是刻意选的保守：pid 被复用和 Core 卡住这两种情况从外面看一模一样，
 * 猜错的代价不对称——猜「陈旧」会让两个 Core 抢一个库，猜「活着」只是让用户
 * 多删一个文件。
 */
import { openSync, closeSync, writeSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { ensureStateDir, statePath, LOCK_JSON } from "./paths.ts";
import { newId } from "./ids.ts";

export type LockRecord = {
  /** 每次启动重新生成。探活时用它确认「回话的就是锁里记的那个实例」。 */
  instance_id: string;
  pid: number;
  started_at: string;
  /** 服务起来之后回填。刚拿到锁时还不知道。 */
  endpoint: string | null;
};

export type LockHeld = {
  record: LockRecord;
  release: () => void;
  /** 服务监听之后回填 endpoint，供别的进程探活。 */
  publish: (endpoint: string) => void;
};

export type LockBusy = {
  reason: "running" | "unverifiable";
  holder: LockRecord;
  lockPath: string;
};

export class LockUnavailable extends Error {
  readonly busy: LockBusy;
  constructor(busy: LockBusy) {
    const where = busy.holder.endpoint ?? "（endpoint 未知）";
    super(
      busy.reason === "running"
        ? `已经有一个 Core 在跑：pid ${busy.holder.pid}，${where}`
        : `锁被 pid ${busy.holder.pid} 持有，但它没有响应探活。` +
            `如果确认那个进程已经死了，删掉 ${busy.lockPath} 再启动。`,
    );
    this.name = "LockUnavailable";
    this.busy = busy;
  }
}

function readLock(path: string): LockRecord | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Partial<LockRecord>;
    if (typeof record.pid !== "number" || typeof record.instance_id !== "string") return null;
    return {
      instance_id: record.instance_id,
      pid: record.pid,
      started_at: typeof record.started_at === "string" ? record.started_at : "",
      endpoint: typeof record.endpoint === "string" ? record.endpoint : null,
    };
  } catch {
    // 锁文件损坏（写到一半断电之类）等同于没有锁：里面没有可信信息。
    return null;
  }
}

function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM 表示进程存在但不归我们管——那也是活着。
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** 探活：能拿到同一个 instance_id 才算数，只看 HTTP 通不通会被别的服务骗过去。 */
async function probe(record: LockRecord, timeoutMs: number): Promise<boolean> {
  if (!record.endpoint) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL("/v0/health", record.endpoint), {
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { instance_id?: unknown };
    return body.instance_id === record.instance_id;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function writeLock(path: string, record: LockRecord): void {
  const fd = openSync(path, "w", 0o600);
  try {
    writeSync(fd, JSON.stringify(record, null, 2));
  } finally {
    closeSync(fd);
  }
}

/**
 * 拿锁。拿不到抛 {@link LockUnavailable}——调用方据此打印「已经在跑了，在这个
 * 地址」而不是一个栈。
 */
export async function acquire(options: { probeTimeoutMs?: number } = {}): Promise<LockHeld> {
  ensureStateDir();
  const path = statePath(LOCK_JSON);
  const probeTimeoutMs = options.probeTimeoutMs ?? 1500;

  const record: LockRecord = {
    instance_id: newId("run").replace("run_", "inst_"),
    pid: process.pid,
    started_at: new Date().toISOString(),
    endpoint: null,
  };

  // 最多两轮：第一轮撞上锁，判定陈旧后删掉，第二轮必须拿到。
  // 不无限重试——一直拿不到说明有别的进程在和我们抢，那就该报错而不是空转。
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(path, "wx", 0o600);
      try {
        writeSync(fd, JSON.stringify(record, null, 2));
      } finally {
        closeSync(fd);
      }
      return {
        record,
        publish: (endpoint: string) => {
          record.endpoint = endpoint;
          writeLock(path, record);
        },
        release: () => {
          // 只删自己的锁。别的实例接管过之后再删，会把活着的 Core 的锁删掉。
          const current = readLock(path);
          if (current && current.instance_id === record.instance_id) {
            try {
              unlinkSync(path);
            } catch {
              /* 已经没了就算了 */
            }
          }
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }

    const holder = readLock(path);
    if (!holder) {
      // 文件在但读不出内容：当陈旧处理。
      try {
        unlinkSync(path);
      } catch {
        /* 别的进程抢先删了，下一轮会重试 */
      }
      continue;
    }

    if (!pidAlive(holder.pid)) {
      try {
        unlinkSync(path);
      } catch {
        /* 同上 */
      }
      continue;
    }

    const responding = await probe(holder, probeTimeoutMs);
    throw new LockUnavailable({
      reason: responding ? "running" : "unverifiable",
      holder,
      lockPath: path,
    });
  }

  throw new Error(`拿不到单实例锁：${path}（重试两轮都被占用）`);
}

/** 给 CLI 用：只看不抢。 */
export function inspect(): LockRecord | null {
  const path = statePath(LOCK_JSON);
  if (!existsSync(path)) return null;
  return readLock(path);
}
