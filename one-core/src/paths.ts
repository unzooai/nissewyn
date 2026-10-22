/**
 * Core 的状态目录。
 *
 * 只有一个状态目录，这是刻意的。unterm 那边踩过一个坑值得抄下来避开：它有
 * `~/.unterm`（GUI 的实例注册表）和平台数据目录（无头 Core 的 core.json）两处，
 * 结果 supervisor 拿错路径去找活着的 Core，报成 absent；文档里也错了五处。
 * 更麻烦的是设了环境变量的测试会同时覆盖两者，所以测试永远看不出这个 bug。
 *
 * 这里的规则：**一个目录，一个环境变量，测试和生产走同一条解析路径。**
 */
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const APP = "UnzooOne";

/**
 * 平台数据目录。放的是运行时状态（endpoint、token、SQLite），不是用户文档，
 * 所以走数据目录而不是家目录下的点目录。
 */
export function stateDir(): string {
  const override = process.env.UNZOO_ONE_STATE_DIR;
  if (override && override.length > 0) return override;

  if (platform() === "win32") {
    const base = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
    return join(base, APP);
  }
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", APP);
  }
  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".local", "share");
  return join(base, "unzoo-one");
}

export function statePath(...parts: string[]): string {
  return join(stateDir(), ...parts);
}

/** 状态目录本身权限收到 0700：core.json 里有 token，同机器上的别的用户不该读到。 */
export function ensureStateDir(): string {
  const dir = stateDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/** 运行中的 Core 把 endpoint 和 token 写在这里，客户端读它来连。 */
export const CORE_JSON = "core.json";
/** 单实例锁。内容见 lock.ts。 */
export const LOCK_JSON = "core.lock.json";
/** 任务库。 */
export const DB_FILE = "core.db";
