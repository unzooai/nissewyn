/**
 * 控制台任务和 unterm 运行时之间的换算。
 *
 * 装好的 Unzoo One 里，任务归运行时管（unterm GET /api/console/tasks）：
 * 关掉页面任务照样跑，定时任务到点自己起来，换个浏览器任务还在。页面仍然
 * 本地优先地改任务，改完整个推给运行时；运行记录和由它决定的任务状态则只
 * 从运行时读回来。
 *
 * 这里全是纯函数，页面和测试共用。
 */

import type { TaskItem, TaskRun, TaskRunStatus, TaskStatus, Weekday } from "../types";
import { dateLocale, t } from "../i18n";

export type RuntimeSchedule =
  | { kind: "daily"; time: string }
  | { kind: "weekly"; time: string; weekday: number };

/** 运行时里一次运行：引擎的 run 加上它那一步 agent_turn 的记录。 */
export type RuntimeRun = {
  id: string;
  attempt: number;
  /** pending | running | succeeded | failed | cancelled | interrupted */
  state: string;
  started_at: string;
  ended_at?: string | null;
  trigger?: string | null;
  agent?: string | null;
  adapter?: string | null;
  session_id?: string | null;
  summary?: string | null;
  error?: string | null;
  /** 运行时自己结束这一轮的原因（start_failed、idle_timeout、session_lost、service_restarted）。 */
  error_code?: string | null;
  /** 正等人在收件箱批准一次工具调用。 */
  waiting?: boolean;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
};

export type RuntimeTask = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  prompt?: string | null;
  schedule?: RuntimeSchedule | null;
  paused: boolean;
  /** 控制台自己的那份任务，运行时原样存、原样还。 */
  console?: unknown;
  /** 最新的在前。 */
  runs: RuntimeRun[];
};

/** 推给运行时的一条任务。 */
export type RuntimeTaskPut = {
  id: string;
  title: string;
  prompt?: string;
  schedule: RuntimeSchedule | null;
  paused: boolean;
  console: Omit<TaskItem, "runs">;
};

const weekdays: readonly Weekday[] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function scheduleOf(task: TaskItem): RuntimeSchedule | null {
  const time = task.scheduleTime && /^\d{1,2}:\d{2}$/.test(task.scheduleTime) ? task.scheduleTime : "09:00";
  if (task.schedule === "每天") return { kind: "daily", time };
  if (task.schedule === "每周") {
    const index = weekdays.indexOf(task.scheduleDay ?? "周一");
    return { kind: "weekly", time, weekday: (index < 0 ? 0 : index) + 1 };
  }
  return null;
}

/** 交给智能体的那段话：标题、说明、目标。和页面直接跑任务时说的一样。 */
export function promptOf(task: Pick<TaskItem, "title" | "description" | "target">): string {
  return [task.title, task.description, task.target && t("目标：{target}", { target: task.target })].filter(Boolean).join("\n");
}

/**
 * 页面里的任务 → 运行时要存的。运行记录不推：那是运行时写的。
 * 交给智能体的话是任务说明；没写说明就用标题。
 */
export function toRuntimePut(task: TaskItem): RuntimeTaskPut {
  const { runs: _runs, ...rest } = task;
  void _runs;
  const prompt = promptOf(task);
  return {
    id: task.id,
    title: task.title.trim() || task.id,
    prompt: prompt || undefined,
    schedule: scheduleOf(task),
    paused: task.status === "已暂停",
    console: rest,
  };
}

/**
 * 判断一条任务要不要再推一次。只看会推过去的内容，所以运行时读回来的
 * 状态、进度改变了页面，也不会白推一遍。
 */
export function putSignature(task: TaskItem): string {
  const put = toRuntimePut(task);
  const { status: _status, progress: _progress, updated: _updated, lastError: _lastError, ...stable } =
    put.console;
  void _status;
  void _progress;
  void _updated;
  void _lastError;
  return JSON.stringify({ ...put, console: stable });
}

const runStatus: Record<string, TaskRunStatus> = {
  pending: "运行中",
  running: "运行中",
  succeeded: "成功",
  cancelled: "已取消",
  failed: "失败",
  interrupted: "失败",
};

/**
 * 一次失败运行的原因，用读者的语言：运行时自己结束的，按原因码翻译；
 * agent 自己报的错，原样给出。
 */
export function runError(run: Pick<RuntimeRun, "error" | "error_code">): string | undefined {
  const raw = run.error?.trim() || undefined;
  switch (run.error_code) {
    case "start_failed":
      return t("智能体没能启动：{error}", { error: raw ?? "" });
    case "idle_timeout":
      return t("十分钟没有任何进展，已停止");
    case "session_lost":
      return t("智能体的会话意外中断了");
    case "service_restarted":
      return t("这次运行还没结束，后台服务就停止了");
    default:
      return raw;
  }
}

export function toTaskRun(run: RuntimeRun): TaskRun {
  const status = runStatus[run.state] ?? "失败";
  const started = Date.parse(run.started_at);
  const ended = run.ended_at ? Date.parse(run.ended_at) : NaN;
  const summary = run.summary?.trim() ?? "";
  const scheduled = run.trigger === "schedule" ? `${t("按计划运行")} · ` : "";
  let text: string;
  if (status === "运行中") {
    text = run.waiting ? t("等你在收件箱确认一次工具调用") : summary ? summary.slice(-120) : t("智能体正在处理");
  } else if (status === "成功") {
    text = summary ? summary.slice(-160) : t("运行完成");
  } else if (status === "已取消") {
    text = t("已停止");
  } else {
    text = runError(run) || (summary ? summary.slice(-160) : t("运行失败"));
  }
  return {
    id: run.id,
    status,
    startedAt: Number.isNaN(started) ? run.started_at : new Date(started).toISOString(),
    durationSeconds:
      Number.isNaN(started) || Number.isNaN(ended) ? undefined : Math.max(0, Math.round((ended - started) / 1000)),
    summary: `${scheduled}${text}`,
    errorMessage: status === "失败" ? runError(run) : undefined,
    sessionId: run.session_id ?? undefined,
    waiting: status === "运行中" && run.waiting === true,
  };
}

/** 运行时里最近一次运行决定任务的状态；没跑过就沿用页面的。 */
export function statusFrom(remote: RuntimeTask, fallback: TaskStatus): TaskStatus {
  const latest = remote.runs[0];
  if (latest && (latest.state === "running" || latest.state === "pending")) return "运行中";
  if (remote.paused) return "已暂停";
  if (!latest) return fallback === "运行中" ? "待确认" : fallback;
  if (latest.state === "succeeded") return "已完成";
  if (latest.state === "cancelled") return "已暂停";
  return "失败";
}

function isTaskItem(value: unknown): value is Omit<TaskItem, "runs"> {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TaskItem>;
  return typeof item.id === "string" && typeof item.title === "string" && typeof item.status === "string";
}

/** 刚在页面上发起、运行时还没回报的运行，留这么久。 */
const optimisticMs = 30_000;

/**
 * 把运行时读回来的并进页面的任务列表。
 *
 * 只动运行时说了算的：运行记录、由它们得出的状态、进度和错误。用户正在
 * 页面上改的标题、说明、计划不碰。运行时里还没有的本地任务（刚建、还没
 * 推上去）保留。
 */
export function mergeRuntimeTasks(
  local: TaskItem[],
  remote: RuntimeTask[],
  nowMs = Date.now(),
  /** 页面上刚删掉、删除还没传到运行时的。 */
  removed: ReadonlySet<string> = new Set(),
): TaskItem[] {
  const remoteById = new Map(remote.map((task) => [task.id, task]));
  const merge = (base: TaskItem, from: RuntimeTask): TaskItem => {
    const runs = from.runs.map(toTaskRun);
    const known = new Set(runs.map((run) => run.id));
    // 页面刚发起、运行时还没记下的运行先留着，免得"运行中"闪一下又没了。
    const pending = (base.runs ?? []).filter(
      (run) => !known.has(run.id) && run.status === "运行中" && nowMs - Date.parse(run.startedAt) < optimisticMs,
    );
    const allRuns = [...pending, ...runs].slice(0, 12);
    const view: RuntimeTask = pending.length
      ? { ...from, runs: [{ id: pending[0].id, attempt: 0, state: "running", started_at: pending[0].startedAt }, ...from.runs] }
      : from;
    const status = statusFrom(view, base.status);
    const latest = from.runs[0];
    return {
      ...base,
      status,
      updated: updatedFrom(latest, status, base.updated),
      progress: status === "已完成" ? 100 : status === "运行中" ? Math.max(base.progress, 8) : base.progress,
      runs: allRuns,
      lastError: status === "失败" ? (latest ? runError(latest) : undefined) ?? base.lastError : undefined,
    };
  };

  const merged = local.map((task) => {
    const from = remoteById.get(task.id);
    return from ? merge(task, from) : task;
  });
  const localIds = new Set(local.map((task) => task.id));
  const fresh = remote
    .filter((task) => !localIds.has(task.id) && !removed.has(task.id))
    .flatMap((task) => {
      const base = isTaskItem(task.console)
        ? ({ ...task.console, id: task.id, title: task.title } as TaskItem)
        : ({
            id: task.id,
            title: task.title,
            description: task.prompt ?? "",
            target: "",
            status: "待确认",
            progress: 0,
            updated: t("刚刚"),
          } satisfies TaskItem);
      return [merge(base, task)];
    });
  return [...fresh, ...merged];
}

/** "最后更新"那一栏：最近一次运行何时结束、怎么结束的。 */
export function updatedFrom(latest: RuntimeRun | undefined, status: TaskStatus, fallback: string): string {
  if (!latest) return fallback;
  if (status === "运行中") return latest.waiting ? t("等你确认") : t("运行中");
  const at = Date.parse(latest.ended_at ?? latest.started_at);
  if (Number.isNaN(at)) return fallback;
  const when = new Date(at).toLocaleString(dateLocale(), {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const verb = latest.state === "succeeded" ? t("完成") : latest.state === "cancelled" ? t("停止") : t("失败");
  return t("{when} {verb}", { when, verb });
}

/** 是否该快一点刷新：有任务在跑。 */
export function anyRunning(tasks: TaskItem[]): boolean {
  return tasks.some((task) => task.status === "运行中");
}
