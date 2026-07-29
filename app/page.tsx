"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  Bell,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FileText,
  Globe2,
  HardDrive,
  History,
  Home,
  ListChecks,
  Link2,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type ViewId = "home" | "tasks" | "approvals" | "activity" | "settings";
type TaskStatus = "运行中" | "待确认" | "已完成" | "已暂停";
type TaskFilter = "全部" | TaskStatus;
type TaskSchedule = "仅运行一次" | "每天" | "每周";
type Weekday = "周一" | "周二" | "周三" | "周四" | "周五" | "周六" | "周日";
type SettingsState = {
  approval: boolean;
  local: boolean;
  notifications: boolean;
};
type WorkspaceBackup = {
  version: 1;
  product: "Unzoo One";
  exportedAt: string;
  tasks: TaskItem[];
  settings: SettingsState;
  approvalIds: string[];
  activity: ActivityItem[];
};
type ApprovalRisk = "低风险" | "中风险" | "高风险";
type ActivityKind = "任务" | "审批" | "系统";
type ActivityFilter = "全部" | ActivityKind;
type ActivityTone = "blue" | "violet" | "green" | "amber" | "red" | "neutral";
type ActivityIconKey =
  | "activity"
  | "brain"
  | "clock"
  | "copy"
  | "globe"
  | "settings"
  | "shield"
  | "sparkles"
  | "trash";
type SearchResultKind = "task" | "view" | "action";

type ActivityItem = {
  id: string;
  time: string;
  createdAt: string;
  title: string;
  detail: string;
  icon: ActivityIconKey;
  tone: ActivityTone;
  kind: ActivityKind;
  taskId?: string;
};

type TaskItem = {
  id: string;
  title: string;
  description: string;
  target: string;
  status: TaskStatus;
  progress: number;
  updated: string;
  schedule?: TaskSchedule;
  scheduleTime?: string;
  scheduleDay?: Weekday;
  requiresApproval?: boolean;
  pinned?: boolean;
};

type ApprovalItem = {
  id: string;
  taskId: string;
  title: string;
  reason: string;
  impact: string;
  action: string;
  target: string;
  scope: string;
  risk: ApprovalRisk;
  requestedAt: string;
  expiresAt: string;
  policy: string;
  icon: typeof Send;
};

type SearchResult = {
  key: string;
  kind: SearchResultKind;
  id: string;
  title: string;
  description: string;
  meta: string;
  icon: typeof Search;
};

const weekdays: Weekday[] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const defaultSettings: SettingsState = {
  approval: true,
  local: true,
  notifications: true,
};

function isTaskItem(value: unknown): value is TaskItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TaskItem>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.description === "string" &&
    typeof item.target === "string" &&
    ["运行中", "待确认", "已完成", "已暂停"].includes(item.status ?? "") &&
    typeof item.progress === "number" &&
    Number.isFinite(item.progress) &&
    typeof item.updated === "string" &&
    (item.schedule === undefined ||
      ["仅运行一次", "每天", "每周"].includes(item.schedule)) &&
    (item.scheduleTime === undefined || typeof item.scheduleTime === "string") &&
    (item.scheduleDay === undefined || weekdays.includes(item.scheduleDay)) &&
    (item.requiresApproval === undefined ||
      typeof item.requiresApproval === "boolean") &&
    (item.pinned === undefined || typeof item.pinned === "boolean")
  );
}

function isActivityItem(value: unknown): value is ActivityItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ActivityItem>;
  return (
    typeof item.id === "string" &&
    typeof item.time === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.title === "string" &&
    typeof item.detail === "string" &&
    [
      "activity",
      "brain",
      "clock",
      "copy",
      "globe",
      "settings",
      "shield",
      "sparkles",
      "trash",
    ].includes(item.icon ?? "") &&
    ["blue", "violet", "green", "amber", "red", "neutral"].includes(
      item.tone ?? "",
    ) &&
    ["任务", "审批", "系统"].includes(item.kind ?? "") &&
    (item.taskId === undefined || typeof item.taskId === "string")
  );
}

function parseWorkspaceBackup(value: unknown): WorkspaceBackup {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid workspace backup");
  }
  const backup = value as Partial<WorkspaceBackup>;
  if (
    backup.version !== 1 ||
    backup.product !== "Unzoo One" ||
    typeof backup.exportedAt !== "string" ||
    !Array.isArray(backup.tasks) ||
    backup.tasks.length === 0 ||
    !backup.tasks.every(isTaskItem) ||
    !backup.settings ||
    typeof backup.settings.approval !== "boolean" ||
    typeof backup.settings.local !== "boolean" ||
    typeof backup.settings.notifications !== "boolean" ||
    !Array.isArray(backup.approvalIds) ||
    !backup.approvalIds.every((id) => typeof id === "string") ||
    !Array.isArray(backup.activity) ||
    !backup.activity.every(isActivityItem)
  ) {
    throw new Error("Invalid workspace backup");
  }
  return backup as WorkspaceBackup;
}

function formatSchedule(
  schedule: TaskSchedule = "仅运行一次",
  time = "09:00",
  day: Weekday = "周一",
) {
  if (schedule === "每天") return `每天 ${time}`;
  if (schedule === "每周") return `每${day} ${time}`;
  return "立即运行一次";
}

function formatTaskSchedule(task: TaskItem) {
  return formatSchedule(
    task.schedule ?? "仅运行一次",
    task.scheduleTime ?? "09:00",
    task.scheduleDay ?? "周一",
  );
}

function getNextRunLabel(task: TaskItem) {
  if (task.status === "已暂停") return "恢复任务后重新计算";
  if (task.schedule === "每天") return `明天 ${task.scheduleTime ?? "09:00"}`;
  if (task.schedule === "每周") {
    return `下一个${task.scheduleDay ?? "周一"} ${task.scheduleTime ?? "09:00"}`;
  }
  return task.status === "已完成" ? "已完成" : "创建后立即运行";
}

const navItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: "home", label: "首页", icon: Home },
  { id: "tasks", label: "任务", icon: ListChecks },
  { id: "approvals", label: "待确认", icon: ShieldCheck },
  { id: "activity", label: "运行记录", icon: History },
  { id: "settings", label: "设置", icon: Settings2 },
];

const taskFilters: TaskFilter[] = ["全部", "运行中", "待确认", "已暂停", "已完成"];
const activityFilters: ActivityFilter[] = ["全部", "任务", "审批", "系统"];

const viewTitles: Record<ViewId, { eyebrow: string; title: string; description: string }> = {
  home: {
    eyebrow: "今天 · 7 月 29 日",
    title: "下午好，今天有 1 件事需要你处理",
    description: "任务正在后台运行，只有需要你决定时才会停下来。",
  },
  tasks: {
    eyebrow: "任务",
    title: "所有任务",
    description: "查看正在运行、等待确认和已经完成的任务。",
  },
  approvals: {
    eyebrow: "待确认",
    title: "需要你决定的操作",
    description: "Unzoo One 不会在你确认前执行外部发送或敏感访问。",
  },
  activity: {
    eyebrow: "运行记录",
    title: "系统刚刚做了什么",
    description: "每一步都有时间、结果和证据，可以随时回看。",
  },
  settings: {
    eyebrow: "设置",
    title: "工作方式",
    description: "决定任务如何运行，以及哪些操作必须经过你确认。",
  },
};

const initialTasks: TaskItem[] = [
  {
    id: "competitor",
    title: "跟踪竞品发布动态",
    description: "每天检查 3 个竞品页面，有变化时生成一份摘要。",
    target: "https://example.com/competitors",
    status: "运行中",
    progress: 68,
    updated: "刚刚更新",
    schedule: "每天",
    scheduleTime: "09:00",
    requiresApproval: true,
    pinned: true,
  },
  {
    id: "weekly-report",
    title: "整理本周项目进展",
    description: "汇总项目文件和工作记录，生成周报草稿。",
    target: "本地项目工作区",
    status: "待确认",
    progress: 92,
    updated: "8 分钟前",
    schedule: "每周",
    scheduleTime: "17:30",
    scheduleDay: "周五",
    requiresApproval: true,
  },
  {
    id: "meeting",
    title: "准备产品评审材料",
    description: "整理评审议题、相关文件和待解决问题。",
    target: "产品评审资料库",
    status: "已完成",
    progress: 100,
    updated: "今天 10:32",
    schedule: "仅运行一次",
    requiresApproval: true,
  },
  {
    id: "research",
    title: "收集 AI 浏览器产品资料",
    description: "保存产品页面并提取功能、定价和团队信息。",
    target: "https://example.com/research",
    status: "已完成",
    progress: 100,
    updated: "昨天 18:06",
    schedule: "仅运行一次",
    requiresApproval: false,
  },
];

const initialApprovals: ApprovalItem[] = [
  {
    id: "send-summary",
    taskId: "competitor",
    title: "把竞品摘要发送到领导沟通群",
    reason: "摘要已经生成，下一步会通过邮件连接器发送到群组。",
    impact: "发送后，群内 3 位成员可以看到这份摘要。",
    action: "发送摘要",
    target: "领导沟通群 · 3 人",
    scope: "仅发送本次摘要",
    risk: "中风险",
    requestedAt: "8 分钟前",
    expiresAt: "今天 18:00",
    policy: "外部发送保护",
    icon: Send,
  },
  {
    id: "browser-access",
    taskId: "competitor",
    title: "读取工作浏览器的登录状态",
    reason: "目标页面需要登录，系统想使用当前浏览器的会话继续访问。",
    impact: "只用于本次任务，任务结束后自动失效。",
    action: "允许本次访问",
    target: "当前工作浏览器",
    scope: "只读会话 · 单次任务",
    risk: "高风险",
    requestedAt: "12 分钟前",
    expiresAt: "30 分钟后",
    policy: "凭证访问保护",
    icon: Globe2,
  },
  {
    id: "write-report",
    taskId: "weekly-report",
    title: "把报告保存到项目目录",
    reason: "系统准备把生成的报告写入当前项目。",
    impact: "将新增文件 competitor-report.md，不会修改其他文件。",
    action: "允许保存",
    target: "项目目录 / competitor-report.md",
    scope: "仅新增 1 个 Markdown 文件",
    risk: "低风险",
    requestedAt: "16 分钟前",
    expiresAt: "今天 20:00",
    policy: "本机文件写入保护",
    icon: FileText,
  },
];

const activityIconMap: Record<ActivityIconKey, typeof Activity> = {
  activity: Activity,
  brain: Brain,
  clock: Clock3,
  copy: Copy,
  globe: Globe2,
  settings: Settings2,
  shield: ShieldCheck,
  sparkles: Sparkles,
  trash: Trash2,
};

const initialActivityItems: ActivityItem[] = [
  {
    id: "activity-summary-ready",
    time: "14:28",
    createdAt: "2026-07-29T14:28:00+08:00",
    title: "摘要已生成",
    detail: "整理出 4 项产品变化和 2 项值得关注的信号。",
    icon: "sparkles",
    tone: "blue",
    kind: "任务",
    taskId: "competitor",
  },
  {
    id: "activity-analysis-complete",
    time: "14:26",
    createdAt: "2026-07-29T14:26:00+08:00",
    title: "页面变化整理完成",
    detail: "对比了今天与昨天的页面内容，过滤了无意义变化。",
    icon: "brain",
    tone: "violet",
    kind: "任务",
    taskId: "competitor",
  },
  {
    id: "activity-evidence-saved",
    time: "14:23",
    createdAt: "2026-07-29T14:23:00+08:00",
    title: "完成 12 张页面截图",
    detail: "3 个目标页面均已读取，截图和页面结构已保存。",
    icon: "globe",
    tone: "green",
    kind: "任务",
    taskId: "competitor",
  },
  {
    id: "activity-schedule-started",
    time: "09:00",
    createdAt: "2026-07-29T09:00:00+08:00",
    title: "任务按计划开始",
    detail: "由每日 09:00 的计划自动启动。",
    icon: "clock",
    tone: "neutral",
    kind: "系统",
    taskId: "competitor",
  },
];

const runSteps = [
  {
    id: "collect",
    title: "检查网页",
    description: "3 个页面已读取，保存了 12 张截图",
    status: "完成",
    icon: Globe2,
  },
  {
    id: "analyze",
    title: "整理变化",
    description: "正在把页面变化整理成简短结论",
    status: "进行中",
    icon: Sparkles,
  },
  {
    id: "send",
    title: "发送摘要",
    description: "发送前会先等你确认",
    status: "等待",
    icon: Mail,
  },
];

const signalBars = [30, 44, 34, 58, 48, 72, 42, 64, 82, 52, 68, 46, 76, 60, 88, 62, 78, 96];
const signalPoints = signalBars
  .map((height, index) => {
    const x = 2 + (index / (signalBars.length - 1)) * 96;
    const y = 48 - (height / 100) * 42;
    return `${x},${y}`;
  })
  .join(" ");

const taskTemplates: Array<{
  id: string;
  label: string;
  title: string;
  description: string;
  target: string;
  schedule: TaskSchedule;
  scheduleTime: string;
  scheduleDay: Weekday;
  icon: typeof Globe2;
}> = [
  {
    id: "monitor",
    label: "网页监控",
    title: "跟踪产品页面变化",
    description: "检查页面内容变化，只保留有意义的更新并生成摘要。",
    target: "https://example.com/product",
    schedule: "每天",
    scheduleTime: "09:00",
    scheduleDay: "周一",
    icon: Globe2,
  },
  {
    id: "research",
    label: "深度研究",
    title: "研究一个新主题",
    description: "从可信来源收集信息，交叉验证后整理成结构化结论。",
    target: "输入主题或资料来源",
    schedule: "仅运行一次",
    scheduleTime: "09:00",
    scheduleDay: "周一",
    icon: Brain,
  },
  {
    id: "report",
    label: "自动周报",
    title: "生成团队每周进展",
    description: "汇总本周项目文件和工作记录，生成可直接发送的周报草稿。",
    target: "本地项目工作区",
    schedule: "每周",
    scheduleTime: "17:30",
    scheduleDay: "周五",
    icon: FileText,
  },
];

export default function HomePage() {
  const [activeView, setActiveView] = useState<ViewId>("home");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [selectedStep, setSelectedStep] = useState("analyze");
  const [approvals, setApprovals] = useState(initialApprovals);
  const [selectedApprovalId, setSelectedApprovalId] = useState(initialApprovals[0].id);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>(initialActivityItems);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("全部");
  const [activityTaskId, setActivityTaskId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [rejectApprovalId, setRejectApprovalId] = useState<string | null>(null);
  const [workspaceResetOpen, setWorkspaceResetOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [tasksReady, setTasksReady] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("全部");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [taskName, setTaskName] = useState("跟踪一个新网页");
  const [taskTarget, setTaskTarget] = useState("https://example.com");
  const [taskDescription, setTaskDescription] = useState(
    "检查页面内容变化，只保留有意义的更新并生成摘要。",
  );
  const [taskSchedule, setTaskSchedule] = useState<TaskSchedule>("每天");
  const [taskScheduleTime, setTaskScheduleTime] = useState("09:00");
  const [taskScheduleDay, setTaskScheduleDay] = useState<Weekday>("周一");
  const [taskApproval, setTaskApproval] = useState(true);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const pageTitle = viewTitles[activeView];
  const selectedApproval =
    approvals.find((item) => item.id === selectedApprovalId) ?? approvals[0];
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const deletingTask = tasks.find((task) => task.id === deleteTaskId) ?? null;
  const rejectedApproval =
    approvals.find((item) => item.id === rejectApprovalId) ?? null;
  const primaryTask = tasks.find((task) => task.id === "competitor") ?? initialTasks[0];
  const activityTask = tasks.find((task) => task.id === activityTaskId) ?? null;
  const activitySummaryTask = activityTask ?? primaryTask;
  const selectedTaskActivity = selectedTask
    ? activityLog.filter((item) => item.taskId === selectedTask.id).slice(0, 3)
    : [];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("unzoo-one-tasks");
        const savedSettings = window.localStorage.getItem("unzoo-one-settings");
        const savedApprovalIds = window.localStorage.getItem(
          "unzoo-one-pending-approvals",
        );
        const savedActivity = window.localStorage.getItem("unzoo-one-activity");
        const schemaVersion = Number(
          window.localStorage.getItem("unzoo-one-schema-version") ?? "1",
        );
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const normalizedTasks = (parsed as TaskItem[]).map((task) => {
              const schedule: TaskSchedule =
                schemaVersion < 2 &&
                task.id === "competitor" &&
                task.schedule === "仅运行一次"
                  ? "每天"
                  : task.schedule ??
                    (task.id === "competitor"
                      ? "每天"
                      : task.id === "weekly-report"
                        ? "每周"
                        : "仅运行一次");
              return {
                ...task,
                schedule,
                scheduleTime:
                  task.scheduleTime ?? (schedule === "仅运行一次" ? undefined : "09:00"),
                scheduleDay:
                  task.scheduleDay ?? (schedule === "每周" ? "周一" : undefined),
                requiresApproval: task.requiresApproval ?? true,
                pinned: task.pinned ?? task.id === "competitor",
              };
            });
            setTasks(normalizedTasks);
            const primaryTask = normalizedTasks.find(
              (task) => task.id === "competitor",
            );
            setIsRunning(primaryTask?.status !== "已暂停");
          }
        }
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings) as Partial<SettingsState>;
          setSettings((current) => ({
            approval:
              typeof parsedSettings.approval === "boolean"
                ? parsedSettings.approval
                : current.approval,
            local:
              typeof parsedSettings.local === "boolean"
                ? parsedSettings.local
                : current.local,
            notifications:
              typeof parsedSettings.notifications === "boolean"
                ? parsedSettings.notifications
                : current.notifications,
          }));
        }
        if (savedApprovalIds) {
          const approvalIds = JSON.parse(savedApprovalIds);
          if (Array.isArray(approvalIds)) {
            const pendingApprovals = initialApprovals.filter((item) =>
              approvalIds.includes(item.id),
            );
            setApprovals(pendingApprovals);
            setSelectedApprovalId(pendingApprovals[0]?.id ?? "");
          }
        }
        if (savedActivity) {
          const parsedActivity = JSON.parse(savedActivity);
          if (Array.isArray(parsedActivity)) {
            setActivityLog(
              (parsedActivity as ActivityItem[])
                .filter(
                  (item) =>
                    item &&
                    typeof item.id === "string" &&
                    typeof item.title === "string" &&
                    typeof item.detail === "string",
                )
                .slice(0, 100),
            );
          }
        }
        window.localStorage.setItem("unzoo-one-schema-version", "3");
      } catch {
        window.localStorage.removeItem("unzoo-one-tasks");
        window.localStorage.removeItem("unzoo-one-settings");
        window.localStorage.removeItem("unzoo-one-pending-approvals");
        window.localStorage.removeItem("unzoo-one-activity");
      } finally {
        setTasksReady(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!tasksReady) return;
    if (settings.local) {
      window.localStorage.setItem("unzoo-one-tasks", JSON.stringify(tasks));
      window.localStorage.setItem("unzoo-one-settings", JSON.stringify(settings));
      window.localStorage.setItem(
        "unzoo-one-pending-approvals",
        JSON.stringify(approvals.map((item) => item.id)),
      );
      window.localStorage.setItem(
        "unzoo-one-activity",
        JSON.stringify(activityLog.slice(0, 100)),
      );
    } else {
      window.localStorage.removeItem("unzoo-one-tasks");
      window.localStorage.removeItem("unzoo-one-settings");
      window.localStorage.removeItem("unzoo-one-pending-approvals");
      window.localStorage.removeItem("unzoo-one-activity");
    }
  }, [activityLog, approvals, settings, tasks, tasksReady]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    }

    function handleSearchShortcut(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !composerOpen &&
        !selectedTask &&
        !deletingTask &&
        !rejectedApproval &&
        !workspaceResetOpen
      ) {
        event.preventDefault();
        setNotificationsOpen(false);
        setSearchOpen(true);
        window.requestAnimationFrame(() => searchInputRef.current?.focus());
      }

      if (event.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleSearchShortcut);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleSearchShortcut);
    };
  }, [
    composerOpen,
    deletingTask,
    rejectedApproval,
    searchOpen,
    selectedTask,
    workspaceResetOpen,
  ]);

  useEffect(() => {
    if (
      !composerOpen &&
      !selectedTask &&
      !deletingTask &&
      !rejectedApproval &&
      !workspaceResetOpen
    ) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setDeleteTaskId(null);
      setRejectApprovalId(null);
      setComposerOpen(false);
      setEditingTaskId(null);
      setSelectedTaskId(null);
      setWorkspaceResetOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    composerOpen,
    deletingTask,
    rejectedApproval,
    selectedTask,
    workspaceResetOpen,
  ]);

  const searchedTasks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return tasks;
    return tasks.filter((task) =>
      `${task.title} ${task.description} ${task.target} ${task.status}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [query, tasks]);

  const searchResults = useMemo<SearchResult[]>(() => {
    const keyword = query.trim().toLowerCase();
    const taskResults: SearchResult[] = tasks.map((task) => ({
      key: `task-${task.id}`,
      kind: "task",
      id: task.id,
      title: task.title,
      description: `${formatTaskSchedule(task)} · ${task.description}`,
      meta: task.status,
      icon: ListChecks,
    }));
    const viewResults: SearchResult[] = navItems.map((item) => ({
      key: `view-${item.id}`,
      kind: "view",
      id: item.id,
      title: item.label,
      description: viewTitles[item.id].description,
      meta: "页面",
      icon: item.icon,
    }));
    const actionResults: SearchResult[] = [
      {
        key: "action-new-task",
        kind: "action",
        id: "new-task",
        title: "新建任务",
        description: "配置目标、运行频率和发送前确认规则。",
        meta: "快捷操作",
        icon: Plus,
      },
      {
        key: "action-approvals",
        kind: "action",
        id: "approvals",
        title: "处理待确认操作",
        description: approvals.length
          ? `${approvals.length} 项敏感操作正在等待你的决定。`
          : "当前没有等待确认的敏感操作。",
        meta: approvals.length ? `${approvals.length} 项` : "已清空",
        icon: ShieldCheck,
      },
    ];

    if (!keyword) {
      return [
        ...actionResults,
        ...taskResults.slice(0, 4),
      ];
    }

    return [...taskResults, ...viewResults, ...actionResults]
      .filter((result) =>
        `${result.title} ${result.description} ${result.meta}`
          .toLowerCase()
          .includes(keyword),
      )
      .slice(0, 8);
  }, [approvals.length, query, tasks]);

  const filteredTasks = useMemo(() => {
    if (taskFilter === "全部") return searchedTasks;
    return searchedTasks.filter((task) => task.status === taskFilter);
  }, [searchedTasks, taskFilter]);

  const scopedActivityLog = useMemo(
    () =>
      activityTaskId
        ? activityLog.filter((item) => item.taskId === activityTaskId)
        : activityLog,
    [activityLog, activityTaskId],
  );

  const filteredActivityLog = useMemo(() => {
    if (activityFilter === "全部") return scopedActivityLog;
    return scopedActivityLog.filter((item) => item.kind === activityFilter);
  }, [activityFilter, scopedActivityLog]);

  const activityCounts = useMemo(
    () => ({
      全部: scopedActivityLog.length,
      任务: scopedActivityLog.filter((item) => item.kind === "任务").length,
      审批: scopedActivityLog.filter((item) => item.kind === "审批").length,
      系统: scopedActivityLog.filter((item) => item.kind === "系统").length,
    }),
    [scopedActivityLog],
  );

  const runningTaskCount = tasks.filter((task) => task.status === "运行中").length;
  const completedTaskCount = tasks.filter((task) => task.status === "已完成").length;
  const workspaceDataSize = useMemo(() => {
    const serialized = JSON.stringify({
      tasks,
      settings,
      approvalIds: approvals.map((item) => item.id),
      activity: activityLog,
    });
    return Math.max(1, Math.ceil(serialized.length / 1024));
  }, [activityLog, approvals, settings, tasks]);
  const latestActivity = activityLog[0] ?? initialActivityItems[0];
  const LatestActivityIcon = activityIconMap[latestActivity.icon] ?? Activity;

  function recordActivity(
    item: Omit<ActivityItem, "id" | "time" | "createdAt">,
  ) {
    const now = new Date();
    const time = now.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    setActivityLog((items) =>
      [
        {
          ...item,
          id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          time,
          createdAt: now.toISOString(),
        },
        ...items,
      ].slice(0, 100),
    );
  }

  function exportActivity() {
    const payload = {
      product: "Unzoo One",
      exportedAt: new Date().toISOString(),
      recordCount: activityLog.length,
      records: activityLog,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unzoo-one-audit-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    recordActivity({
      title: "审计记录已导出",
      detail: `已导出 ${activityLog.length} 条记录，文件仅保存在本机。`,
      icon: "activity",
      tone: "blue",
      kind: "系统",
    });
    setNotice(`已导出 ${activityLog.length} 条审计记录`);
  }

  function exportWorkspace() {
    const payload: WorkspaceBackup = {
      version: 1,
      product: "Unzoo One",
      exportedAt: new Date().toISOString(),
      tasks,
      settings,
      approvalIds: approvals.map((item) => item.id),
      activity: activityLog,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unzoo-one-workspace-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    recordActivity({
      title: "工作区备份已导出",
      detail: `已备份 ${tasks.length} 个任务、${activityLog.length} 条运行记录和当前设置。`,
      icon: "activity",
      tone: "blue",
      kind: "系统",
    });
    setNotice("工作区备份已保存到本机");
  }

  async function importWorkspace(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      if (file.size > 2_000_000) {
        throw new Error("Workspace backup is too large");
      }
      const backup = parseWorkspaceBackup(JSON.parse(await file.text()));
      const restoredApprovals = initialApprovals.filter((item) =>
        backup.approvalIds.includes(item.id),
      );
      const restoredPrimary =
        backup.tasks.find((task) => task.id === "competitor") ?? backup.tasks[0];

      setTasks(backup.tasks);
      setSettings(backup.settings);
      setApprovals(restoredApprovals);
      setSelectedApprovalId(restoredApprovals[0]?.id ?? "");
      setActivityLog(backup.activity.slice(0, 100));
      setIsRunning(restoredPrimary.status !== "已暂停");
      setSelectedStep("analyze");
      setTaskFilter("全部");
      setActivityFilter("全部");
      setActivityTaskId(null);
      setSelectedTaskId(null);
      setRejectApprovalId(null);
      setNotificationsOpen(false);
      recordActivity({
        title: "工作区备份已恢复",
        detail: `已从“${file.name}”恢复 ${backup.tasks.length} 个任务和 ${backup.activity.length} 条运行记录。`,
        icon: "activity",
        tone: "green",
        kind: "系统",
      });
      setNotice(`已恢复 ${backup.tasks.length} 个任务，工作区可以继续使用`);
    } catch {
      setNotice("导入失败，请选择由 Unzoo One 导出的工作区备份");
    } finally {
      input.value = "";
    }
  }

  function resetWorkspace() {
    setTasks(initialTasks.map((task) => ({ ...task })));
    setSettings({ ...defaultSettings });
    setApprovals(initialApprovals.map((item) => ({ ...item })));
    setSelectedApprovalId(initialApprovals[0].id);
    setActivityLog(initialActivityItems.map((item) => ({ ...item })));
    setIsRunning(true);
    setSelectedStep("analyze");
    setTaskFilter("全部");
    setActivityFilter("全部");
    setActivityTaskId(null);
    setSelectedTaskId(null);
    setDeleteTaskId(null);
    setRejectApprovalId(null);
    setNotificationsOpen(false);
    setWorkspaceResetOpen(false);
    recordActivity({
      title: "工作区已恢复初始状态",
      detail: "任务、待确认事项、运行记录和设置已重新初始化。",
      icon: "settings",
      tone: "amber",
      kind: "系统",
    });
    setNotice("工作区已恢复初始状态");
  }

  function openActivityItem(item: ActivityItem) {
    if (item.taskId && tasks.some((task) => task.id === item.taskId)) {
      setSelectedTaskId(item.taskId);
      return;
    }
    if (item.kind === "审批" && approvals.length > 0) {
      openView("approvals");
      return;
    }
    setNotice(item.detail);
  }

  function approveCurrent() {
    if (!selectedApproval) return;
    const approved = selectedApproval;
    const relatedTask = tasks.find((task) => task.id === approved.taskId);
    const shouldResume = relatedTask?.status === "待确认";
    setApprovals((items) => items.filter((item) => item.id !== selectedApproval.id));
    setSelectedApprovalId(
      approvals.find((item) => item.id !== selectedApproval.id)?.id ?? "",
    );
    setTasks((items) =>
      items.map((task) =>
        task.id === approved.taskId
          ? {
              ...task,
              status: shouldResume ? "运行中" : task.status,
              progress: shouldResume ? Math.min(99, task.progress + 4) : task.progress,
              updated: shouldResume ? "刚刚获得确认" : "刚刚批准操作",
            }
          : task,
      ),
    );
    if (approved.taskId === "competitor" && shouldResume) {
      setIsRunning(true);
    }
    recordActivity({
      title: `已批准：${approved.title}`,
      detail: `${approved.impact} 授权范围：${approved.scope}。`,
      icon: "shield",
      tone: "green",
      kind: "审批",
      taskId: approved.taskId,
    });
    setNotice(
      shouldResume
        ? `已允许操作，任务“${relatedTask?.title}”继续运行`
        : `已允许：${approved.title}`,
    );
  }

  function holdCurrent() {
    if (!selectedApproval) return;
    const held = selectedApproval;
    const currentIndex = approvals.findIndex((item) => item.id === held.id);
    const nextApproval =
      approvals.length > 1
        ? approvals[(currentIndex + 1) % approvals.length]
        : undefined;
    setApprovals((items) => [
      ...items.filter((item) => item.id !== held.id),
      held,
    ]);
    setSelectedApprovalId(nextApproval?.id ?? held.id);
    recordActivity({
      title: `稍后处理：${held.title}`,
      detail: "操作仍保留在待确认列表中，没有执行任何外部动作。",
      icon: "clock",
      tone: "amber",
      kind: "审批",
      taskId: held.taskId,
    });
    setNotice(
      nextApproval
        ? "已移到队尾，正在查看下一项待确认操作"
        : "这项操作会继续留在待确认列表中",
    );
  }

  function requestRejectApproval() {
    if (!selectedApproval) return;
    setRejectApprovalId(selectedApproval.id);
  }

  function confirmRejectApproval() {
    if (!rejectedApproval) return;
    const rejected = rejectedApproval;
    const relatedTask = tasks.find((task) => task.id === rejected.taskId);
    setApprovals((items) => items.filter((item) => item.id !== rejected.id));
    setSelectedApprovalId(
      approvals.find((item) => item.id !== rejected.id)?.id ?? "",
    );
    setTasks((items) =>
      items.map((task) =>
        task.id === rejected.taskId
          ? {
              ...task,
              status: "已暂停",
              updated: "因审批拒绝暂停",
            }
          : task,
      ),
    );
    if (rejected.taskId === "competitor") {
      setIsRunning(false);
    }
    setRejectApprovalId(null);
    recordActivity({
      title: `已拒绝：${rejected.title}`,
      detail: `未执行任何外部操作，关联任务“${relatedTask?.title ?? rejected.taskId}”已暂停。`,
      icon: "shield",
      tone: "red",
      kind: "审批",
      taskId: rejected.taskId,
    });
    setNotice(`已拒绝操作，任务“${relatedTask?.title ?? rejected.taskId}”已暂停`);
  }

  function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskName.trim() || !taskDescription.trim() || !taskTarget.trim()) return;

    if (editingTaskId) {
      const task = tasks.find((item) => item.id === editingTaskId);
      if (!task) return;
      setTasks((items) =>
        items.map((item) =>
          item.id === editingTaskId
            ? {
                ...item,
                title: taskName.trim(),
                description: taskDescription.trim(),
                target: taskTarget.trim(),
                schedule: taskSchedule,
                scheduleTime:
                  taskSchedule === "仅运行一次" ? undefined : taskScheduleTime,
                scheduleDay: taskSchedule === "每周" ? taskScheduleDay : undefined,
                requiresApproval: taskApproval,
                updated: "刚刚修改",
              }
            : item,
        ),
      );
      setComposerOpen(false);
      setEditingTaskId(null);
      setSelectedTaskId(task.id);
      recordActivity({
        title: `任务配置已更新：${taskName.trim()}`,
        detail: `${formatSchedule(
          taskSchedule,
          taskScheduleTime,
          taskScheduleDay,
        )} · ${
          taskApproval ? "敏感操作需要确认" : "按任务范围自动执行"
        }`,
        icon: "settings",
        tone: "blue",
        kind: "任务",
        taskId: task.id,
      });
      setNotice(`任务“${taskName.trim()}”已更新`);
      return;
    }

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: taskName.trim(),
      description: taskDescription.trim(),
      target: taskTarget.trim(),
      status: "运行中",
      progress: 3,
      updated: "刚刚创建",
      schedule: taskSchedule,
      scheduleTime: taskSchedule === "仅运行一次" ? undefined : taskScheduleTime,
      scheduleDay: taskSchedule === "每周" ? taskScheduleDay : undefined,
      requiresApproval: taskApproval,
    };
    setTasks((items) => [newTask, ...items]);
    setTaskFilter("全部");
    setActiveView("tasks");
    setSelectedTaskId(newTask.id);
    setComposerOpen(false);
    setTaskName("");
    setTaskTarget("");
    setTaskDescription("");
    setTaskSchedule("仅运行一次");
    setTaskScheduleTime("09:00");
    setTaskScheduleDay("周一");
    setTaskApproval(true);
    recordActivity({
      title: `任务已创建：${newTask.title}`,
      detail: `${formatTaskSchedule(newTask)} · 目标：${newTask.target}`,
      icon: "sparkles",
      tone: "blue",
      kind: "任务",
      taskId: newTask.id,
    });
    setNotice(`任务“${newTask.title}”已开始运行`);
  }

  function beginCreateTask() {
    setEditingTaskId(null);
    setTaskName("跟踪一个新网页");
    setTaskTarget("https://example.com");
    setTaskDescription("检查页面内容变化，只保留有意义的更新并生成摘要。");
    setTaskSchedule("每天");
    setTaskScheduleTime("09:00");
    setTaskScheduleDay("周一");
    setTaskApproval(settings.approval);
    setComposerOpen(true);
  }

  function beginEditTask(task: TaskItem) {
    setTaskName(task.title);
    setTaskTarget(task.target);
    setTaskDescription(task.description);
    setTaskSchedule(task.schedule ?? "仅运行一次");
    setTaskScheduleTime(task.scheduleTime ?? "09:00");
    setTaskScheduleDay(task.scheduleDay ?? "周一");
    setTaskApproval(task.requiresApproval ?? true);
    setEditingTaskId(task.id);
    setSelectedTaskId(null);
    setComposerOpen(true);
  }

  function closeComposer() {
    setComposerOpen(false);
    setEditingTaskId(null);
  }

  function applyTaskTemplate(template: (typeof taskTemplates)[number]) {
    setTaskName(template.title);
    setTaskDescription(template.description);
    setTaskTarget(template.target);
    setTaskSchedule(template.schedule);
    setTaskScheduleTime(template.scheduleTime);
    setTaskScheduleDay(template.scheduleDay);
  }

  function duplicateTask(task: TaskItem) {
    const duplicate: TaskItem = {
      ...task,
      id: `task-${Date.now()}`,
      title: `${task.title}（副本）`,
      status: "已暂停",
      progress: 0,
      updated: "刚刚复制",
      pinned: false,
    };
    setTasks((items) => [duplicate, ...items]);
    setSelectedTaskId(duplicate.id);
    recordActivity({
      title: `任务已复制：${duplicate.title}`,
      detail: "为避免误执行，复制后的任务保持暂停。",
      icon: "copy",
      tone: "violet",
      kind: "任务",
      taskId: duplicate.id,
    });
    setNotice(`已复制“${task.title}”，副本保持暂停`);
  }

  function requestDeleteTask(task: TaskItem) {
    if (task.pinned) {
      setNotice("首页主任务不能删除，你可以暂停或修改它");
      return;
    }
    setSelectedTaskId(null);
    setDeleteTaskId(task.id);
  }

  function confirmDeleteTask() {
    if (!deletingTask) return;
    setTasks((items) => items.filter((item) => item.id !== deletingTask.id));
    if (activityTaskId === deletingTask.id) {
      setActivityTaskId(null);
    }
    setDeleteTaskId(null);
    recordActivity({
      title: `任务已删除：${deletingTask.title}`,
      detail: `已移除任务配置和本机记录，原数据来源：${deletingTask.target}`,
      icon: "trash",
      tone: "red",
      kind: "任务",
    });
    setNotice(`任务“${deletingTask.title}”已删除`);
  }

  function toggleSetting(key: keyof SettingsState, label: string) {
    const nextValue = !settings[key];
    setSettings((current) => ({ ...current, [key]: nextValue }));
    recordActivity({
      title: `${label}已${nextValue ? "开启" : "关闭"}`,
      detail: "设置变更已应用到后续任务执行。",
      icon: "settings",
      tone: "neutral",
      kind: "系统",
    });
    setNotice(`${label}已${nextValue ? "开启" : "关闭"}`);
  }

  function openView(view: ViewId) {
    setActiveView(view);
    if (view === "activity") {
      setActivityTaskId(null);
    }
    setNotificationsOpen(false);
    setSelectedTaskId(null);
  }

  function openTask(taskId: string) {
    setSelectedTaskId(taskId);
    setNotificationsOpen(false);
  }

  function openTaskActivity(taskId: string) {
    setActivityTaskId(taskId);
    setActivityFilter("全部");
    setActiveView("activity");
    setSelectedTaskId(null);
    setNotificationsOpen(false);
  }

  function chooseSearchResult(result: SearchResult) {
    setSearchOpen(false);
    setQuery("");
    setActiveSearchIndex(0);

    if (result.kind === "task") {
      setActiveView("tasks");
      openTask(result.id);
    } else if (result.kind === "view") {
      openView(result.id as ViewId);
    } else if (result.id === "new-task") {
      beginCreateTask();
    } else {
      openView("approvals");
    }

    window.requestAnimationFrame(() => searchInputRef.current?.blur());
  }

  function clearSearch() {
    setQuery("");
    setActiveSearchIndex(0);
    setSearchOpen(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!searchOpen) setSearchOpen(true);
      setActiveSearchIndex((current) =>
        searchResults.length ? (current + 1) % searchResults.length : 0,
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!searchOpen) setSearchOpen(true);
      setActiveSearchIndex((current) =>
        searchResults.length
          ? (current - 1 + searchResults.length) % searchResults.length
          : 0,
      );
    }

    if (event.key === "Enter" && searchOpen && searchResults[activeSearchIndex]) {
      event.preventDefault();
      chooseSearchResult(searchResults[activeSearchIndex]);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setSearchOpen(false);
      searchInputRef.current?.blur();
    }
  }

  function updateTaskStatus(task: TaskItem) {
    if (task.status === "待确认") {
      setSelectedTaskId(null);
      openView("approvals");
      return;
    }

    const nextStatus: TaskStatus =
      task.status === "运行中" ? "已暂停" : "运行中";
    const nextProgress =
      task.status === "已完成" ? Math.max(3, Math.min(task.progress, 12)) : task.progress;

    setTasks((items) =>
      items.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: nextStatus,
              progress: nextProgress,
              updated: nextStatus === "已暂停" ? "刚刚暂停" : "刚刚继续",
            }
          : item,
      ),
    );

    if (task.id === "competitor") {
      setIsRunning(nextStatus === "运行中");
    }

    recordActivity({
      title: `${nextStatus === "已暂停" ? "任务已暂停" : "任务已继续"}：${task.title}`,
      detail:
        nextStatus === "已暂停"
          ? "任务停止执行，但保留当前进度和已保存证据。"
          : "任务从上次进度继续运行。",
      icon: nextStatus === "已暂停" ? "clock" : "activity",
      tone: nextStatus === "已暂停" ? "amber" : "green",
      kind: "任务",
      taskId: task.id,
    });
    setNotice(
      nextStatus === "已暂停"
        ? `任务“${task.title}”已暂停`
        : `任务“${task.title}”已继续运行`,
    );
  }

  function togglePrimaryTask() {
    const nextRunning = !isRunning;
    setIsRunning(nextRunning);
    setTasks((items) =>
      items.map((task) =>
        task.id === "competitor"
          ? {
              ...task,
              status: nextRunning ? "运行中" : "已暂停",
              updated: nextRunning ? "刚刚继续" : "刚刚暂停",
            }
          : task,
      ),
    );
    recordActivity({
      title: `${nextRunning ? "任务已继续" : "任务已暂停"}：${primaryTask.title}`,
      detail: nextRunning
        ? "首页主任务已恢复后台执行。"
        : "首页主任务停止执行，已保存当前进度。",
      icon: nextRunning ? "activity" : "clock",
      tone: nextRunning ? "green" : "amber",
      kind: "任务",
      taskId: primaryTask.id,
    });
  }

  return (
    <main className="clarity-shell">
      <aside className="clarity-sidebar" aria-label="主导航">
        <div className="clarity-brand">
          <span className="clarity-brand-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/unzoo-one-mark.svg" alt="Unzoo One" />
          </span>
          <div>
            <strong>
              Unzoo <span>One</span>
            </strong>
            <small>可信 AI 执行</small>
          </div>
        </div>

        <nav className="clarity-nav">
          {navItems.map((item) => (
            <button
              className={activeView === item.id ? "active" : ""}
              key={item.id}
              type="button"
              aria-label={item.label}
              title={item.label}
              onClick={() => openView(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "approvals" && approvals.length > 0 && (
                <em>{approvals.length}</em>
              )}
            </button>
          ))}
        </nav>

        <div className="clarity-sidebar-status">
          <i className={isRunning ? "online" : ""} />
          <div>
            <strong>{isRunning ? "系统运行正常" : "任务已暂停"}</strong>
            <small>数据保存在本机</small>
          </div>
        </div>
      </aside>

      <section className="clarity-main">
        <header className="clarity-header">
          <div className="clarity-page-title">
            <span>{pageTitle.eyebrow}</span>
            <h1>{pageTitle.title}</h1>
            <p>{pageTitle.description}</p>
          </div>

          <div className="clarity-header-actions">
            <div className="clarity-search-wrap" ref={searchWrapRef}>
              <div className={`clarity-search ${searchOpen ? "open" : ""}`}>
                <Search size={16} />
                <input
                  ref={searchInputRef}
                  role="combobox"
                  aria-label="全局搜索"
                  aria-autocomplete="list"
                  aria-controls="global-search-results"
                  aria-expanded={searchOpen}
                  aria-activedescendant={
                    searchOpen && searchResults[activeSearchIndex]
                      ? `search-result-${activeSearchIndex}`
                      : undefined
                  }
                  autoComplete="off"
                  placeholder="搜索任务、页面和操作"
                  value={query}
                  onFocus={() => {
                    setNotificationsOpen(false);
                    setSearchOpen(true);
                  }}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveSearchIndex(0);
                    setSearchOpen(true);
                  }}
                  onKeyDown={handleSearchKeyDown}
                />
                {query && (
                  <button
                    className="clarity-search-clear"
                    type="button"
                    aria-label="清除搜索"
                    onClick={clearSearch}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {searchOpen && (
                <div
                  className="clarity-search-panel"
                  id="global-search-results"
                  role="listbox"
                  aria-label="全局搜索结果"
                >
                  <div className="clarity-search-panel-heading">
                    <strong>{query ? "搜索结果" : "快速访问"}</strong>
                    <span>{searchResults.length} 项</span>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="clarity-search-results">
                      {searchResults.map((result, index) => (
                        <button
                          id={`search-result-${index}`}
                          className={index === activeSearchIndex ? "active" : ""}
                          key={result.key}
                          type="button"
                          role="option"
                          aria-selected={index === activeSearchIndex}
                          onMouseEnter={() => setActiveSearchIndex(index)}
                          onClick={() => chooseSearchResult(result)}
                        >
                          <span
                            className="clarity-search-result-icon"
                            data-kind={result.kind}
                          >
                            <result.icon size={17} />
                          </span>
                          <span className="clarity-search-result-copy">
                            <strong>{result.title}</strong>
                            <small>{result.description}</small>
                          </span>
                          <span className="clarity-search-result-meta">
                            {result.meta}
                            <ChevronRight size={14} />
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="clarity-search-empty">
                      <Search size={18} />
                      <strong>没有找到匹配内容</strong>
                      <span>换一个任务名称、页面或操作试试。</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="clarity-notification-wrap">
              <button
                className="clarity-icon-button"
                type="button"
                aria-label="通知"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={18} />
                {approvals.length > 0 && <i />}
              </button>
              {notificationsOpen && (
                <div className="clarity-notifications" role="dialog" aria-label="通知">
                  <div>
                    <strong>通知</strong>
                    <button
                      type="button"
                      aria-label="关闭通知"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <button type="button" onClick={() => openView("approvals")}>
                    <ShieldCheck size={17} />
                    <span>
                      <strong>
                        {approvals.length
                          ? `${approvals.length} 项操作等你确认`
                          : "暂无待确认操作"}
                      </strong>
                      <small>
                        {approvals.length
                          ? "外部发送前任务已经暂停"
                          : "所有敏感操作都已处理"}
                      </small>
                    </span>
                  </button>
                  <button type="button" onClick={() => openView("activity")}>
                    <LatestActivityIcon size={17} />
                    <span>
                      <strong>{latestActivity.title}</strong>
                      <small>{latestActivity.detail}</small>
                    </span>
                  </button>
                </div>
              )}
            </div>

            <button
              className="clarity-primary-button"
              type="button"
              onClick={beginCreateTask}
            >
              <Plus size={17} />
              新建任务
            </button>
          </div>
        </header>

        {activeView === "home" && (
          <section className="home-view">
            <div className="home-summary" aria-label="今日概览">
              <span className="summary-running">
                <i><Play size={14} /></i>
                <span>
                  <small>正在运行</small>
                  <strong>{runningTaskCount}</strong>
                </span>
              </span>
              <span className="summary-waiting">
                <i><ShieldCheck size={14} /></i>
                <span>
                  <small>等待确认</small>
                  <strong>{approvals.length}</strong>
                </span>
              </span>
              <span className="summary-done">
                <i><CheckCircle2 size={14} /></i>
                <span>
                  <small>今天已完成</small>
                  <strong>{completedTaskCount}</strong>
                </span>
              </span>
            </div>

            <div className="home-focus-grid">
              <section className="active-task-panel" aria-label="正在运行的任务">
                <div className="task-ai-hero">
                  <div className="task-ai-copy">
                    <div className="focus-panel-heading">
                      <div>
                        <span>
                          {formatTaskSchedule(primaryTask)} ·{" "}
                          {isRunning ? "正在运行" : "已暂停"}
                        </span>
                        <strong>{primaryTask.title}</strong>
                      </div>
                      <span className={`live-state ${isRunning ? "" : "paused"}`}>
                        <i />
                        {isRunning ? "运行中" : "已暂停"}
                      </span>
                    </div>

                    <p className="task-purpose">
                      {primaryTask.description}
                    </p>

                    <div className="task-ai-context" aria-label="AI 当前状态">
                      <span><Brain size={15} /> Codex 推理</span>
                      <i />
                      <span><ShieldCheck size={15} /> 可审计执行</span>
                    </div>
                  </div>

                  <div className="task-ai-visual" aria-label="AI 正在整合网页证据">
                    {/* The source WebP is already optimized; vinext has no Next image proxy. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/ai-core-premium.webp" alt="" aria-hidden="true" />
                    <span className="task-ai-visual-status">
                      <Sparkles size={15} />
                      <span>
                        <small>AI 引擎实况</small>
                        <strong>正在整合 12 份页面证据</strong>
                      </span>
                    </span>
                  </div>
                </div>

                <div className="task-signal-band" aria-label="今日任务信号">
                  <div className="signal-metric">
                    <span>今天发现</span>
                    <strong>4</strong>
                    <small>处页面变化</small>
                  </div>
                  <div className="signal-chart" aria-hidden="true">
                    <svg viewBox="0 0 100 50" preserveAspectRatio="none">
                      <path d="M2 13 H98 M2 25 H98 M2 37 H98" />
                      <polyline points={signalPoints} />
                      <circle cx="98" cy="7.68" r="1.8" />
                    </svg>
                    <span>
                      <small>09:00</small>
                      <small>现在</small>
                    </span>
                  </div>
                  <div className="signal-metric">
                    <span>保存证据</span>
                    <strong>12</strong>
                    <small>张页面截图</small>
                  </div>
                </div>

                <div className="simple-progress">
                  <div>
                    <span>已完成 2 / 3 步</span>
                    <strong>{isRunning ? `${primaryTask.progress}%` : "暂停"}</strong>
                  </div>
                  <span>
                    <i
                      className={isRunning ? "moving" : ""}
                      style={{ width: `${primaryTask.progress}%` }}
                    />
                  </span>
                </div>

                <div className="plain-steps">
                  {runSteps.map((step, index) => (
                    <button
                      className={`${selectedStep === step.id ? "selected" : ""} step-${step.id}`}
                      key={step.id}
                      type="button"
                      onClick={() => setSelectedStep(step.id)}
                    >
                      <span className="plain-step-marker">
                        {index === 0 ? <Check size={15} /> : <step.icon size={16} />}
                      </span>
                      <span>
                        <strong>{step.title}</strong>
                        <small>{step.description}</small>
                      </span>
                      <em>{step.id === "analyze" && !isRunning ? "已暂停" : step.status}</em>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>

                <div className="current-work">
                  <div className="current-work-icon">
                    {selectedStep === "collect" && <Globe2 size={19} />}
                    {selectedStep === "analyze" && <Sparkles size={19} />}
                    {selectedStep === "send" && <Mail size={19} />}
                  </div>
                  <div>
                    <span>当前查看</span>
                    <strong>
                      {runSteps.find((step) => step.id === selectedStep)?.title}
                    </strong>
                    <small>
                      {selectedStep === "collect" && "网页已经检查完成，截图和页面内容均已保存。"}
                      {selectedStep === "analyze" && "正在提取真正有意义的变化，预计还需要 2 分钟。"}
                      {selectedStep === "send" && "摘要已经准备好，确认收件人后才能发送。"}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={togglePrimaryTask}
                  >
                    {isRunning ? <Pause size={15} /> : <Play size={15} />}
                    {isRunning ? "暂停" : "继续"}
                  </button>
                </div>

                <footer className="task-tools">
                  <span>本次使用</span>
                  <span><Globe2 size={14} /> 浏览器</span>
                  <span><Brain size={14} /> Codex</span>
                  <span><Mail size={14} /> 邮件</span>
                  <button type="button" onClick={() => openView("activity")}>
                    查看完整记录
                    <ChevronRight size={14} />
                  </button>
                </footer>
              </section>

              <aside className="needs-action-panel" aria-label="需要你确认">
                <div className="attention-heading">
                  <span>需要你处理</span>
                  <strong>{approvals.length}</strong>
                </div>

                {selectedApproval ? (
                  <>
                    <div className="attention-icon">
                      <selectedApproval.icon size={20} />
                    </div>
                    <h2>{selectedApproval.title}</h2>
                    <p>{selectedApproval.reason}</p>

                    {selectedApproval.id === "send-summary" && (
                      <div className="recipient-preview">
                        <div>
                          <span>刘</span>
                          <span>王</span>
                          <span>陈</span>
                        </div>
                        <p>
                          <strong>领导沟通群</strong>
                          <small>3 位成员将看到这份摘要</small>
                        </p>
                      </div>
                    )}

                    <div className="plain-impact">
                      <ShieldCheck size={17} />
                      <span>
                        <strong>确认后会发生什么</strong>
                        <small>{selectedApproval.impact}</small>
                      </span>
                    </div>

                    <div className="decision-boundary" aria-label="本次操作边界">
                      <span>
                        <small>执行对象</small>
                        <strong>{selectedApproval.target}</strong>
                      </span>
                      <span>
                        <small>影响范围</small>
                        <strong>{selectedApproval.scope}</strong>
                      </span>
                      <span>
                        <small>风险等级</small>
                        <strong className={`approval-risk risk-${selectedApproval.risk}`}>
                          {selectedApproval.risk}
                        </strong>
                      </span>
                    </div>

                    <div className="attention-actions">
                      <button
                        className="confirm"
                        type="button"
                        onClick={() => openView("approvals")}
                      >
                        <ShieldCheck size={16} />
                        查看并确认
                      </button>
                      <button type="button" onClick={holdCurrent}>稍后处理</button>
                    </div>

                    <button
                      className="all-approvals-link"
                      type="button"
                      onClick={() => openView("approvals")}
                    >
                      查看全部待确认操作
                      <ChevronRight size={15} />
                    </button>
                  </>
                ) : (
                  <div className="nothing-pending">
                    <CheckCircle2 size={28} />
                    <strong>暂时没有需要处理的事</strong>
                    <p>任务会继续在后台运行。</p>
                  </div>
                )}
              </aside>
            </div>

            <section className="recent-section">
              <div className="section-title-row">
                <div>
                  <span>最近任务</span>
                  <h2>你交给 Unzoo One 的工作</h2>
                </div>
                <button type="button" onClick={() => openView("tasks")}>
                  查看全部
                  <ChevronRight size={15} />
                </button>
              </div>
              <div className="recent-task-list">
                {searchedTasks.slice(0, 3).map((task) => (
                  <button
                    className="recent-task-row"
                    key={task.id}
                    type="button"
                    onClick={() => openTask(task.id)}
                  >
                    <span className={`recent-task-icon status-${task.status}`}>
                      {task.status === "运行中" && <Activity size={17} />}
                      {task.status === "待确认" && <ShieldCheck size={17} />}
                      {task.status === "已完成" && <CheckCircle2 size={17} />}
                    </span>
                    <span className="recent-task-copy">
                      <span className="recent-task-topline">
                        <em className={`status-label status-${task.status}`}>{task.status}</em>
                        <small>{task.updated}</small>
                      </span>
                      <strong>{task.title}</strong>
                      <small>{task.description}</small>
                    </span>
                    <span className="recent-task-progress">
                      <span>
                        <i style={{ width: `${task.progress}%` }} />
                      </span>
                      <small>{task.progress}%</small>
                      <ChevronRight size={16} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </section>
        )}

        {activeView === "tasks" && (
          <section className="tasks-view">
            <div className="view-toolbar">
              <div className="view-filter-tabs" role="tablist" aria-label="任务筛选">
                {taskFilters.map((filter) => (
                  <button
                    className={taskFilter === filter ? "active" : ""}
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={taskFilter === filter}
                    onClick={() => setTaskFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <button
                className="clarity-secondary-button"
                type="button"
                onClick={beginCreateTask}
              >
                <Plus size={16} />
                新建任务
              </button>
            </div>

            <div className="task-table">
              <div className="task-table-head">
                <span>任务</span>
                <span>状态</span>
                <span>进度</span>
                <span>最后更新</span>
                <span />
              </div>
              {filteredTasks.map((task) => (
                <button
                  className="task-table-row"
                  key={task.id}
                  type="button"
                  onClick={() => openTask(task.id)}
                >
                  <span>
                    <strong>{task.title}</strong>
                    <small>{task.description}</small>
                  </span>
                  <em className={`status-label status-${task.status}`}>{task.status}</em>
                  <span className="table-progress">
                    <i><b style={{ width: `${task.progress}%` }} /></i>
                    <small>{task.progress}%</small>
                  </span>
                  <span className="task-updated">{task.updated}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {filteredTasks.length === 0 && (
                <div className="task-empty-state">
                  <Search size={22} />
                  <strong>没有符合条件的任务</strong>
                  <p>换一个筛选条件或清除搜索内容。</p>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskFilter("全部");
                      setQuery("");
                    }}
                  >
                    清除筛选
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {activeView === "approvals" && (
          <section className="approvals-view">
            {approvals.length ? (
              <>
                <div className="approval-queue">
                  <div className="approval-queue-heading">
                    <span>审批队列</span>
                    <strong>{approvals.length} 项</strong>
                  </div>
                  {approvals.map((item) => (
                    <button
                      className={selectedApproval?.id === item.id ? "selected" : ""}
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedApprovalId(item.id)}
                    >
                      <item.icon size={17} />
                      <span className="approval-queue-copy">
                        <span className="approval-queue-topline">
                          <strong>{item.title}</strong>
                          <em className={`approval-risk risk-${item.risk}`}>
                            {item.risk}
                          </em>
                        </span>
                        <small>{item.target} · {item.requestedAt}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>

                {selectedApproval && (
                  <div className="approval-detail">
                    <div className="approval-review-heading">
                      <div>
                        <span className="approval-kicker">
                          <ShieldCheck size={15} />
                          等待你的确认
                        </span>
                        <em
                          className={`approval-risk risk-${selectedApproval.risk}`}
                        >
                          {selectedApproval.risk}
                        </em>
                      </div>
                      <h2>{selectedApproval.title}</h2>
                      <p>{selectedApproval.reason}</p>
                    </div>

                    <div className="approval-context-grid">
                      <div>
                        <Link2 size={16} />
                        <span>
                          <small>关联任务</small>
                          <button
                            type="button"
                            onClick={() => openTask(selectedApproval.taskId)}
                          >
                            {tasks.find((task) => task.id === selectedApproval.taskId)
                              ?.title ?? selectedApproval.taskId}
                            <ChevronRight size={13} />
                          </button>
                        </span>
                      </div>
                      <div>
                        <selectedApproval.icon size={16} />
                        <span>
                          <small>执行对象</small>
                          <strong>{selectedApproval.target}</strong>
                        </span>
                      </div>
                      <div>
                        <ShieldCheck size={16} />
                        <span>
                          <small>授权范围</small>
                          <strong>{selectedApproval.scope}</strong>
                        </span>
                      </div>
                      <div>
                        <Timer size={16} />
                        <span>
                          <small>请求时间 · 失效时间</small>
                          <strong>
                            {selectedApproval.requestedAt} · {selectedApproval.expiresAt}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="approval-explanation">
                      <span>
                        <AlertTriangle size={17} />
                      </span>
                      <div>
                        <strong>批准后会发生什么</strong>
                        <p>{selectedApproval.impact}</p>
                      </div>
                    </div>

                    <div className="approval-policy-review">
                      <div>
                        <span>
                          <ShieldCheck size={17} />
                        </span>
                        <div>
                          <strong>策略检查已通过</strong>
                          <small>{selectedApproval.policy}</small>
                        </div>
                      </div>
                      <div className="approval-scope">
                        <span><Check size={14} /> 只允许这一次</span>
                        <span><Check size={14} /> 决策写入审计记录</span>
                        <span><Check size={14} /> 拒绝后自动暂停任务</span>
                      </div>
                    </div>

                    <div className="approval-detail-actions">
                      <button className="confirm" type="button" onClick={approveCurrent}>
                        <Check size={16} />
                        {selectedApproval.action}
                      </button>
                      <button type="button" onClick={holdCurrent}>
                        <Timer size={16} />
                        稍后处理
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={requestRejectApproval}
                      >
                        <Ban size={16} />
                        拒绝操作
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-view">
                <CheckCircle2 size={34} />
                <h2>所有操作都处理完了</h2>
                <p>任务会继续在后台运行，有新的决定需要你处理时会再次提醒。</p>
                <button type="button" onClick={() => openView("home")}>返回首页</button>
              </div>
            )}
          </section>
        )}

        {activeView === "activity" && (
          <section className="activity-view">
            <div className="activity-toolbar">
              <div>
                <span>{activityTask ? "任务审计" : "可信审计"}</span>
                <strong>{scopedActivityLog.length} 条记录</strong>
              </div>
              <div
                className="activity-filter-tabs"
                role="tablist"
                aria-label="运行记录筛选"
              >
                {activityFilters.map((filter) => (
                  <button
                    className={activityFilter === filter ? "active" : ""}
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={activityFilter === filter}
                    onClick={() => setActivityFilter(filter)}
                  >
                    {filter}
                    <span>{activityCounts[filter]}</span>
                  </button>
                ))}
              </div>
              <button
                className="activity-export"
                type="button"
                onClick={exportActivity}
              >
                <Download size={15} />
                导出记录
              </button>
            </div>

            <div className="activity-summary">
              <Activity size={18} />
              <div>
                <strong>{activitySummaryTask.title}</strong>
                <small>
                  {formatTaskSchedule(activitySummaryTask)} ·{" "}
                  {activityTask
                    ? "仅显示此任务的记录"
                    : `已记录 ${scopedActivityLog.length} 个事件`}
                </small>
              </div>
              <div className="activity-summary-actions">
                {activityTask && (
                  <button
                    className="activity-scope-clear"
                    type="button"
                    aria-label={`取消“${activityTask.title}”任务筛选`}
                    onClick={() => setActivityTaskId(null)}
                  >
                    <X size={14} />
                    查看全部
                  </button>
                )}
                <span
                  className={`live-state ${
                    activitySummaryTask.status === "运行中" ? "" : "paused"
                  }`}
                >
                  <i />
                  {activitySummaryTask.status}
                </span>
              </div>
            </div>

            <div className="activity-timeline" aria-live="polite">
              {filteredActivityLog.map((item) => {
                const ItemIcon = activityIconMap[item.icon] ?? Activity;
                const hasTask = Boolean(
                  item.taskId && tasks.some((task) => task.id === item.taskId),
                );
                return (
                  <div className="timeline-row" key={item.id}>
                    <time dateTime={item.createdAt}>{item.time}</time>
                    <span className={`timeline-icon ${item.tone}`}>
                      <ItemIcon size={17} />
                    </span>
                    <div className="timeline-content">
                      <span className={`timeline-kind kind-${item.kind}`}>{item.kind}</span>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <button type="button" onClick={() => openActivityItem(item)}>
                      {hasTask ? "打开任务" : item.kind === "审批" ? "查看审批" : "详情"}
                    </button>
                  </div>
                );
              })}
              {filteredActivityLog.length === 0 && (
                <div className="activity-empty">
                  <Search size={22} />
                  <strong>
                    {activityTask
                      ? activityFilter === "全部"
                        ? "这个任务还没有运行记录"
                        : "这个任务还没有此类记录"
                      : "这个分类还没有记录"}
                  </strong>
                  <button
                    type="button"
                    onClick={() => {
                      if (activityFilter !== "全部") {
                        setActivityFilter("全部");
                      } else {
                        setActivityTaskId(null);
                      }
                    }}
                  >
                    {activityFilter !== "全部" ? "查看此任务全部记录" : "查看全部任务"}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {activeView === "settings" && (
          <section className="settings-view">
            <div
              className={`workspace-overview ${settings.local ? "" : "is-temporary"}`}
            >
              <div className="workspace-overview-status">
                <span className="workspace-overview-icon">
                  <HardDrive size={22} />
                  <i />
                </span>
                <div>
                  <span>工作区状态</span>
                  <h2>
                    {settings.local ? "本机数据正常" : "当前为临时会话"}
                  </h2>
                  <p>
                    {settings.local
                      ? "任务、审批和运行记录会自动保存在这台设备。"
                      : "关闭页面后，本次任务和运行记录不会保留。"}
                  </p>
                </div>
              </div>
              <div className="workspace-overview-metrics">
                <span>
                  <small>任务</small>
                  <strong>{tasks.length}</strong>
                </span>
                <span>
                  <small>运行记录</small>
                  <strong>{activityLog.length}</strong>
                </span>
                <span>
                  <small>待确认</small>
                  <strong>{approvals.length}</strong>
                </span>
                <span>
                  <small>数据量</small>
                  <strong>{workspaceDataSize} KB</strong>
                </span>
              </div>
            </div>

            <div className="settings-group settings-preferences-group">
              <div>
                <span>运行偏好</span>
                <h2>安全、保存与通知</h2>
              </div>
              <label className="setting-row">
                <span>
                  <strong>外部操作前必须确认</strong>
                  <small>发送邮件、发布内容或访问敏感信息前暂停任务。</small>
                </span>
                <button
                  className={`switch-control ${settings.approval ? "on" : ""}`}
                  type="button"
                  role="switch"
                  aria-checked={settings.approval}
                  onClick={() => toggleSetting("approval", "默认审批保护")}
                >
                  <i />
                </button>
              </label>
              <label className="setting-row">
                <span>
                  <strong>数据只保存在本机</strong>
                  <small>任务记录、截图和生成文件默认不上传到外部服务。</small>
                </span>
                <button
                  className={`switch-control ${settings.local ? "on" : ""}`}
                  type="button"
                  role="switch"
                  aria-checked={settings.local}
                  onClick={() => toggleSetting("local", "本机数据保存")}
                >
                  <i />
                </button>
              </label>
              <label className="setting-row">
                <span>
                  <strong>需要确认时通知</strong>
                  <small>任务需要你做决定时，在桌面显示通知。</small>
                </span>
                <button
                  className={`switch-control ${settings.notifications ? "on" : ""}`}
                  type="button"
                  role="switch"
                  aria-checked={settings.notifications}
                  onClick={() => toggleSetting("notifications", "确认通知")}
                >
                  <i />
                </button>
              </label>
            </div>

            <div className="settings-group workspace-data-group">
              <div>
                <span>数据与恢复</span>
                <h2>备份或迁移工作区</h2>
              </div>
              <div className="workspace-data-summary">
                <span>
                  <HardDrive size={18} />
                </span>
                <div>
                  <strong>约 {workspaceDataSize} KB 本机数据</strong>
                  <small>备份包含任务、审批状态、运行记录和全部设置。</small>
                </div>
              </div>
              <div className="workspace-data-actions">
                <button type="button" onClick={exportWorkspace}>
                  <span className="workspace-data-action-icon export">
                    <Download size={18} />
                  </span>
                  <span>
                    <strong>导出工作区备份</strong>
                    <small>下载一个可随时恢复的 JSON 文件</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                >
                  <span className="workspace-data-action-icon import">
                    <Upload size={18} />
                  </span>
                  <span>
                    <strong>从备份恢复</strong>
                    <small>校验文件后替换当前本机工作区</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
                <button
                  className="workspace-data-reset"
                  type="button"
                  onClick={() => setWorkspaceResetOpen(true)}
                >
                  <span className="workspace-data-action-icon reset">
                    <RotateCcw size={18} />
                  </span>
                  <span>
                    <strong>恢复初始状态</strong>
                    <small>清除当前改动并载入示例工作区</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              </div>
              <input
                ref={importInputRef}
                className="workspace-import-input"
                type="file"
                accept=".json,application/json"
                onChange={importWorkspace}
              />
            </div>
          </section>
        )}
      </section>

      {selectedTask && (
        <div
          className="task-detail-backdrop"
          onMouseDown={() => setSelectedTaskId(null)}
        >
          <aside
            className="task-detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`任务详情：${selectedTask.title}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="task-detail-heading">
              <div className="task-detail-heading-meta">
                <span>任务详情</span>
                <em className={`status-label status-${selectedTask.status}`}>
                  {selectedTask.status}
                </em>
              </div>
              <div className="task-detail-heading-actions">
                <button
                  type="button"
                  aria-label="编辑任务"
                  title="编辑任务"
                  onClick={() => beginEditTask(selectedTask)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  aria-label="复制任务"
                  title="复制任务"
                  onClick={() => duplicateTask(selectedTask)}
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  aria-label="关闭任务详情"
                  title="关闭"
                  onClick={() => setSelectedTaskId(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="task-detail-intro">
              <span className={`task-detail-icon status-${selectedTask.status}`}>
                {selectedTask.status === "运行中" && <Activity size={21} />}
                {selectedTask.status === "待确认" && <ShieldCheck size={21} />}
                {selectedTask.status === "已暂停" && <Pause size={21} />}
                {selectedTask.status === "已完成" && <CheckCircle2 size={21} />}
              </span>
              <h2>{selectedTask.title}</h2>
              <p>{selectedTask.description}</p>
            </div>

            <section className="task-detail-progress" aria-label="任务进度">
              <div>
                <span>整体进度</span>
                <strong>{selectedTask.progress}%</strong>
              </div>
              <span>
                <i style={{ width: `${selectedTask.progress}%` }} />
              </span>
              <small>{selectedTask.updated}</small>
            </section>

            <section className="task-detail-facts">
              <div>
                <Globe2 size={17} />
                <span>
                  <small>任务目标</small>
                  <strong>{selectedTask.target}</strong>
                </span>
              </div>
              <div>
                <CalendarDays size={17} />
                <span>
                  <small>运行计划</small>
                  <strong>{formatTaskSchedule(selectedTask)}</strong>
                </span>
              </div>
              <div>
                <Clock3 size={17} />
                <span>
                  <small>下次运行</small>
                  <strong>{getNextRunLabel(selectedTask)}</strong>
                </span>
              </div>
              <div>
                <ShieldCheck size={17} />
                <span>
                  <small>执行策略</small>
                  <strong>
                    {selectedTask.requiresApproval ?? true
                      ? "对外操作前必须确认"
                      : "按任务范围自动执行"}
                  </strong>
                </span>
              </div>
            </section>

            <section className="task-detail-trace">
              <div>
                <span>最近动作</span>
                <button
                  type="button"
                  onClick={() => openTaskActivity(selectedTask.id)}
                >
                  完整记录
                  <ChevronRight size={14} />
                </button>
              </div>
              {selectedTaskActivity.length > 0 ? (
                <ol className="task-activity-list">
                  {selectedTaskActivity.map((item) => {
                    const TraceIcon = activityIconMap[item.icon] ?? Activity;
                    return (
                      <li className={`trace-${item.tone}`} key={item.id}>
                        <i>
                          <TraceIcon size={13} />
                        </i>
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            <time dateTime={item.createdAt}>{item.time}</time>
                            {item.detail}
                          </small>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="task-trace-empty">
                  <History size={18} />
                  <span>
                    <strong>还没有可用记录</strong>
                    <small>新的关键动作会自动显示在这里。</small>
                  </span>
                </div>
              )}
            </section>

            <footer className="task-detail-actions">
              <button
                className="primary"
                type="button"
                onClick={() => updateTaskStatus(selectedTask)}
              >
                {selectedTask.status === "运行中" && <Pause size={16} />}
                {selectedTask.status === "待确认" && <ShieldCheck size={16} />}
                {(selectedTask.status === "已暂停" || selectedTask.status === "已完成") && (
                  <Play size={16} />
                )}
                {selectedTask.status === "运行中" && "暂停任务"}
                {selectedTask.status === "待确认" && "处理确认"}
                {selectedTask.status === "已暂停" && "继续任务"}
                {selectedTask.status === "已完成" && "再次运行"}
              </button>
              {selectedTask.pinned ? (
                <button type="button" onClick={() => setSelectedTaskId(null)}>
                  关闭
                </button>
              ) : (
                <button
                  className="danger"
                  type="button"
                  onClick={() => requestDeleteTask(selectedTask)}
                >
                  <Trash2 size={15} />
                  删除
                </button>
              )}
            </footer>
          </aside>
        </div>
      )}

      {composerOpen && (
        <div className="clarity-dialog-backdrop" onMouseDown={closeComposer}>
          <form
            className="clarity-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={editingTaskId ? "编辑任务" : "新建任务"}
            aria-labelledby="task-composer-title"
            onSubmit={createTask}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="clarity-dialog-heading">
              <div>
                <span>{editingTaskId ? "编辑配置" : "任务配置"}</span>
                <h2 id="task-composer-title">
                  {editingTaskId ? "更新任务设置" : "交给 Unzoo One 一项工作"}
                </h2>
                <p>
                  {editingTaskId
                    ? "修改会立即保存，正在运行的任务会使用新配置。"
                    : "描述结果，选择节奏，然后让 AI 持续执行。"}
                </p>
              </div>
              <button type="button" aria-label="关闭" onClick={closeComposer}>
                <X size={17} />
              </button>
            </div>

            <section className="task-template-picker" aria-label="快速模板">
              <span>快速开始</span>
              <div>
                {taskTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTaskTemplate(template)}
                  >
                    <template.icon size={16} />
                    {template.label}
                  </button>
                ))}
              </div>
            </section>

            <div className="composer-field-grid">
              <label>
                <span>任务名称</span>
                <input
                  autoFocus
                  required
                  value={taskName}
                  placeholder="例如：每天跟踪竞品更新"
                  onChange={(event) => setTaskName(event.target.value)}
                />
              </label>

              <label>
                <span>数据来源或网址</span>
                <input
                  required
                  value={taskTarget}
                  placeholder="网页、文件夹或资料库"
                  onChange={(event) => setTaskTarget(event.target.value)}
                />
              </label>
            </div>

            <label className="composer-instruction">
              <span>希望得到什么结果</span>
              <textarea
                required
                value={taskDescription}
                placeholder="说清楚要做什么、保留哪些证据，以及最终交付什么结果。"
                onChange={(event) => setTaskDescription(event.target.value)}
              />
            </label>

            <section className="composer-schedule" aria-label="运行频率">
              <span>运行频率</span>
              <div role="radiogroup" aria-label="选择运行频率">
                {(["仅运行一次", "每天", "每周"] as TaskSchedule[]).map((schedule) => (
                  <button
                    className={taskSchedule === schedule ? "active" : ""}
                    key={schedule}
                    type="button"
                    role="radio"
                    aria-checked={taskSchedule === schedule}
                    onClick={() => setTaskSchedule(schedule)}
                  >
                    {schedule}
                  </button>
                ))}
              </div>
            </section>

            <div className="composer-schedule-detail">
              {taskSchedule === "仅运行一次" ? (
                <div className="schedule-once-note">
                  <Play size={16} />
                  <span>
                    <strong>创建后立即开始</strong>
                    <small>只运行一次，完成后保留结果和审计记录。</small>
                  </span>
                </div>
              ) : (
                <>
                  {taskSchedule === "每周" && (
                    <label>
                      <span>星期</span>
                      <select
                        aria-label="选择每周运行日期"
                        value={taskScheduleDay}
                        onChange={(event) =>
                          setTaskScheduleDay(event.target.value as Weekday)
                        }
                      >
                        {weekdays.map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    <span>运行时间</span>
                    <input
                      aria-label="选择运行时间"
                      type="time"
                      required
                      value={taskScheduleTime}
                      onInput={(event) =>
                        setTaskScheduleTime((event.target as HTMLInputElement).value)
                      }
                    />
                  </label>
                  <span className="schedule-timezone">
                    <Clock3 size={15} />
                    北京时间
                  </span>
                </>
              )}
            </div>

            <div className="composer-policy">
              <span className="composer-policy-icon">
                <ShieldCheck size={18} />
              </span>
              <span>
                <strong>敏感操作需要确认</strong>
                <small>对外发送、登录访问和写入文件前先询问你。</small>
              </span>
              <button
                className={`switch-control ${taskApproval ? "on" : ""}`}
                type="button"
                role="switch"
                aria-checked={taskApproval}
                aria-label="敏感操作需要确认"
                onClick={() => setTaskApproval((value) => !value)}
              >
                <i />
              </button>
            </div>

            <div className="clarity-dialog-note">
              <CalendarDays size={17} />
              <p>
                <strong>
                  {formatSchedule(taskSchedule, taskScheduleTime, taskScheduleDay)}
                </strong>
                {taskSchedule === "仅运行一次"
                  ? "，创建后立即开始。"
                  : "自动启动，你可以随时暂停或修改计划。"}
              </p>
            </div>

            <div className="clarity-dialog-actions">
              <button type="button" onClick={closeComposer}>取消</button>
              <button className="confirm" type="submit">
                {editingTaskId ? <Pencil size={16} /> : <Sparkles size={16} />}
                {editingTaskId ? "保存修改" : "创建并运行"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingTask && (
        <div
          className="clarity-dialog-backdrop"
          onMouseDown={() => setDeleteTaskId(null)}
        >
          <section
            className="confirm-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-task-title"
            aria-describedby="delete-task-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="confirm-delete-close"
              type="button"
              aria-label="关闭删除确认"
              onClick={() => setDeleteTaskId(null)}
            >
              <X size={17} />
            </button>
            <span className="confirm-delete-icon">
              <Trash2 size={21} />
            </span>
            <span className="confirm-delete-eyebrow">删除任务</span>
            <h2 id="delete-task-title">确定删除“{deletingTask.title}”吗？</h2>
            <p id="delete-task-description">
              任务配置和本机运行记录将被移除。这项操作无法撤销。
            </p>
            <div className="confirm-delete-facts">
              <span>
                <small>运行频率</small>
                <strong>{formatTaskSchedule(deletingTask)}</strong>
              </span>
              <span>
                <small>数据来源</small>
                <strong>{deletingTask.target}</strong>
              </span>
            </div>
            <div className="confirm-delete-actions">
              <button type="button" onClick={() => setDeleteTaskId(null)}>
                保留任务
              </button>
              <button className="danger" type="button" onClick={confirmDeleteTask}>
                <Trash2 size={15} />
                确认删除
              </button>
            </div>
          </section>
        </div>
      )}

      {rejectedApproval && (
        <div
          className="clarity-dialog-backdrop"
          onMouseDown={() => setRejectApprovalId(null)}
        >
          <section
            className="approval-reject-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="approval-reject-title"
            aria-describedby="approval-reject-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="approval-reject-close"
              type="button"
              aria-label="关闭拒绝确认"
              onClick={() => setRejectApprovalId(null)}
            >
              <X size={17} />
            </button>
            <span className="approval-reject-icon">
              <Ban size={21} />
            </span>
            <span className="approval-reject-eyebrow">拒绝操作</span>
            <h2 id="approval-reject-title">确认不允许这次操作？</h2>
            <p id="approval-reject-description">
              系统不会执行“{rejectedApproval.title}”，并会暂停关联任务，等待你修改任务或重新启动。
            </p>
            <div className="approval-reject-facts">
              <span>
                <small>执行对象</small>
                <strong>{rejectedApproval.target}</strong>
              </span>
              <span>
                <small>授权范围</small>
                <strong>{rejectedApproval.scope}</strong>
              </span>
              <span>
                <small>关联任务</small>
                <strong>
                  {tasks.find((task) => task.id === rejectedApproval.taskId)?.title ??
                    rejectedApproval.taskId}
                </strong>
              </span>
            </div>
            <div className="approval-reject-note">
              <ShieldCheck size={16} />
              <span>拒绝决定会写入审计记录，不会发生任何外部操作。</span>
            </div>
            <div className="approval-reject-actions">
              <button type="button" onClick={() => setRejectApprovalId(null)}>
                返回审核
              </button>
              <button
                className="danger"
                type="button"
                onClick={confirmRejectApproval}
              >
                <Ban size={15} />
                确认拒绝
              </button>
            </div>
          </section>
        </div>
      )}

      {workspaceResetOpen && (
        <div
          className="clarity-dialog-backdrop"
          onMouseDown={() => setWorkspaceResetOpen(false)}
        >
          <section
            className="workspace-reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="workspace-reset-title"
            aria-describedby="workspace-reset-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="workspace-reset-close"
              type="button"
              aria-label="关闭重置确认"
              onClick={() => setWorkspaceResetOpen(false)}
            >
              <X size={17} />
            </button>
            <span className="workspace-reset-icon">
              <RotateCcw size={21} />
            </span>
            <span className="workspace-reset-eyebrow">恢复初始状态</span>
            <h2 id="workspace-reset-title">重置当前本机工作区？</h2>
            <p id="workspace-reset-description">
              当前任务、审批状态、运行记录和设置会被示例工作区替换。建议先导出备份。
            </p>
            <div className="workspace-reset-facts">
              <span>
                <small>当前任务</small>
                <strong>{tasks.length} 个</strong>
              </span>
              <span>
                <small>运行记录</small>
                <strong>{activityLog.length} 条</strong>
              </span>
              <span>
                <small>待确认</small>
                <strong>{approvals.length} 件</strong>
              </span>
            </div>
            <button
              className="workspace-reset-backup"
              type="button"
              onClick={exportWorkspace}
            >
              <Download size={16} />
              先导出备份
            </button>
            <div className="workspace-reset-actions">
              <button type="button" onClick={() => setWorkspaceResetOpen(false)}>
                保留当前数据
              </button>
              <button className="danger" type="button" onClick={resetWorkspace}>
                <RotateCcw size={15} />
                确认重置
              </button>
            </div>
          </section>
        </div>
      )}

      {notice && (
        <div className="clarity-toast" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button type="button" aria-label="关闭提示" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
