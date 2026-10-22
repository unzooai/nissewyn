/**
 * 本机认证。
 *
 * 安全模型 §6.3：localhost 默认认证。同一台机器上的别的进程默认不可信——
 * 没有认证的 localhost REST 等于把终端和浏览器的控制权交给任何一个本地进程。
 *
 * 两条不能省的：
 * - **Origin/CORS 不能代替认证。** 它挡的是浏览器里的跨站请求，挡不住
 *   `curl http://127.0.0.1:...`。
 * - **只监听回环。** 绑 0.0.0.0 的话，同一个 Wi-Fi 下的任何人都能来试 token。
 */
import { randomBytes, timingSafeEqual } from "node:crypto";

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * 定长比较。用 `===` 的话，比较耗时随公共前缀长度变化，逐字节试就能把 token
 * 猜出来——本机接口一样要防，因为攻击者可能就是本机上一个低权限进程。
 */
export function tokenMatches(expected: string, given: string | undefined): boolean {
  if (typeof given !== "string") return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given, "utf8");
  // 长度不同时不能直接交给 timingSafeEqual（它会抛），但也不能提前返回就完事——
  // 拿它和自己比一次，让两条路径的耗时接近。
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function bearerFrom(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return undefined;
  const token = header.slice(prefix.length).trim();
  return token.length > 0 ? token : undefined;
}

/** 只接受回环地址。反向代理转发进来的请求会带别的 remoteAddress，一律拒。 */
export function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address.startsWith("::ffff:") ? address.slice(7) : address;
  return normalized === "127.0.0.1" || normalized === "::1" || normalized.startsWith("127.");
}
