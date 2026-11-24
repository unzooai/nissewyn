/**
 * ID 生成。
 *
 * ULID：48 位毫秒时间戳 + 80 位随机，Crockford Base32 编码成 26 个字符。
 * 选它而不是 UUIDv4 是因为它按时间排序——事件、任务、审批都要按发生顺序读，
 * 有序 ID 让主键索引本身就是时间索引，不用额外排序。
 *
 * 格式必须和 contracts/v0/common/primitives.schema.json 里的 pattern 对得上，
 * 那边逐个前缀写死了。tests/ids.test.ts 拿真 schema 校验。
 */
import { randomBytes } from "node:crypto";

/** Crockford Base32：去掉了 I、L、O、U——手抄时最容易认错的四个。 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 同一毫秒内多次调用时，随机位递增而不是重摇，保证严格单调。 */
let lastTime = -1;
let lastRandom: number[] = [];

function encodeTime(ms: number): string {
  let out = "";
  let value = ms;
  for (let i = 0; i < 10; i += 1) {
    out = ALPHABET[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

function randomChars(): number[] {
  const bytes = randomBytes(16);
  return Array.from({ length: 16 }, (_, i) => (bytes[i] as number) % 32);
}

/** 随机部分加一，用于同毫秒内的后续调用。返回 false 表示进位溢出。 */
function incrementRandom(chars: number[]): boolean {
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const next = (chars[i] as number) + 1;
    if (next < 32) {
      chars[i] = next;
      return true;
    }
    chars[i] = 0;
  }
  return false;
}

export function ulid(now: number = Date.now()): string {
  if (now === lastTime) {
    if (!incrementRandom(lastRandom)) {
      // 同一毫秒内摇满了 32^16 个值——现实中到不了，但溢出就重摇，
      // 宁可让这一毫秒内失去严格单调，也不要产生重复 ID。
      lastRandom = randomChars();
    }
  } else {
    lastTime = now;
    lastRandom = randomChars();
  }
  return encodeTime(now) + lastRandom.map((c) => ALPHABET[c]).join("");
}

/** contracts 里出现过的对象前缀。写成常量是为了拼错时编译期就红。 */
export type IdPrefix =
  | "task"
  | "run"
  | "step"
  | "thread"
  | "turn"
  | "call"
  | "approval"
  | "grant"
  | "action"
  | "artifact"
  | "event"
  | "automation"
  | "inbox"
  | "memory";

export function newId(prefix: IdPrefix, now?: number): string {
  return `${prefix}_${ulid(now)}`;
}

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isId(prefix: IdPrefix, value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!value.startsWith(`${prefix}_`)) return false;
  return ULID_PATTERN.test(value.slice(prefix.length + 1));
}

/**
 * RFC 3339 UTC，毫秒精度，Z 结尾。
 *
 * contracts 收 Z 和 +00:00 两种零偏移写法（unzoo-one#14）。Core 这侧只产出 Z：
 * 存储层只有一种写法，比较和排序就不用考虑两种形式。收得宽、发得窄。
 */
export function nowIso(at: number = Date.now()): string {
  return new Date(at).toISOString();
}
