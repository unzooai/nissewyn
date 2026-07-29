"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  Ban,
  Bell,
  Building2,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FileJson,
  FileText,
  Files,
  Globe2,
  HardDrive,
  History,
  Home,
  ListChecks,
  Link2,
  LoaderCircle,
  Mail,
  Pause,
  Pencil,
  Pin,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Table2,
  Timer,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type ViewId =
  | "home"
  | "tasks"
  | "approvals"
  | "artifacts"
  | "activity"
  | "settings";
type WorkspaceRoute = {
  view: ViewId;
  taskId: string | null;
  runId: string | null;
};
type WorkspaceHistoryState = {
  unzooOne: true;
  route: WorkspaceRoute;
  canPop: boolean;
};
type TaskStatus = "运行中" | "待确认" | "失败" | "已完成" | "已暂停";
type TaskFilter = "全部" | TaskStatus;
type TaskSort = "状态优先" | "进度最高" | "名称";
type TaskSchedule = "仅运行一次" | "每天" | "每周";
type Weekday = "周一" | "周二" | "周三" | "周四" | "周五" | "周六" | "周日";
type TaskRunStatus = "运行中" | "成功" | "失败" | "已取消";
type ArtifactType = "报告" | "数据" | "证据" | "草稿";
type ArtifactFilter = "全部" | ArtifactType | "重点";
type ArtifactSort = "最近更新" | "重点优先" | "文件名";
type ArtifactStatus = "已完成" | "草稿" | "已修订";
type SettingsState = {
  approval: boolean;
  local: boolean;
  notifications: boolean;
};
type DesktopNotificationPermission =
  | "checking"
  | "unsupported"
  | "default"
  | "granted"
  | "denied";
type BudgetAlertThreshold = 50 | 75 | 90;
type UsageSettings = {
  monthlyBudget: number;
  alertThreshold: BudgetAlertThreshold;
  pauseAtLimit: boolean;
};
type ConnectorId = "browser" | "workspace" | "mail" | "calendar";
type ConnectorState = Record<ConnectorId, boolean>;
type ConnectorDefinition = {
  id: ConnectorId;
  name: string;
  description: string;
  scope: string;
  lastUsed: string;
  permissions: string[];
  icon: typeof Globe2;
  tone: "blue" | "green" | "amber" | "violet";
};
type TeamRole = "所有者" | "管理员" | "审批者" | "成员";
type TeamMemberStatus = "在线" | "离线" | "已邀请";
type SettingsDraftTarget = "budget" | "invite" | "member";
const settingsDraftDiscardCopy: Record<
  SettingsDraftTarget,
  { eyebrow: string; title: string; description: string; discardLabel: string }
> = {
  budget: {
    eyebrow: "预算尚未保存",
    title: "放弃这次预算调整？",
    description: "月度额度、提醒阈值和到限保护会恢复为当前已保存的设置。",
    discardLabel: "放弃调整",
  },
  invite: {
    eyebrow: "邀请尚未发送",
    title: "放弃这份成员邀请？",
    description: "已经填写的姓名、工作邮箱和成员角色不会被保留。",
    discardLabel: "放弃邀请",
  },
  member: {
    eyebrow: "角色尚未保存",
    title: "放弃这次角色修改？",
    description: "成员会继续使用当前角色，新选择的权限不会生效。",
    discardLabel: "放弃修改",
  },
};
type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: TeamMemberStatus;
  avatar: string;
  tone: "blue" | "green" | "amber" | "violet";
  lastActive: string;
};
type TeamInviteFormErrors = Partial<Record<"name" | "email", string>>;
type TaskDeleteSnapshot = {
  tasks: TaskItem[];
  artifacts: ArtifactItem[];
  activity: ActivityItem[];
  approvals: ApprovalItem[];
  selectedTaskIds: string[];
  selectedApprovalId: string;
  selectedApprovalIds: string[];
  activityTaskId: string | null;
  artifactTaskId: string | null;
  restoreTaskId: string | null;
  isRunning: boolean;
  deletedCount: number;
};
type ArtifactDeleteSnapshot = {
  artifact: ArtifactItem;
  index: number;
};
type ApprovalRejectSnapshot = {
  tasks: TaskItem[];
  approvals: ApprovalItem[];
  selectedApprovalId: string;
  selectedApprovalIds: string[];
  rejectedCount: number;
  isRunning: boolean;
};
type WorkspaceBackup = {
  version: 1;
  product: "Unzoo One";
  exportedAt: string;
  tasks: TaskItem[];
  settings: SettingsState;
  usage?: UsageSettings;
  connectors?: ConnectorState;
  members?: TeamMember[];
  approvalIds: string[];
  activity: ActivityItem[];
  artifacts?: ArtifactItem[];
};
type PendingWorkspaceImport = {
  backup: WorkspaceBackup;
  fileName: string;
  fileSize: number;
};
type ApprovalRisk = "低风险" | "中风险" | "高风险";
type ApprovalRiskFilter = "全部" | ApprovalRisk;
type BulkApprovalDecision = "approve" | "reject";
type ActivityKind = "任务" | "审批" | "系统";
type ActivityFilter = "全部" | ActivityKind;
type ActivitySort = "最新优先" | "最早优先";
type ActivityTone = "blue" | "violet" | "green" | "amber" | "red" | "neutral";
type ActivityIconKey =
  | "activity"
  | "brain"
  | "clock"
  | "copy"
  | "file"
  | "globe"
  | "settings"
  | "shield"
  | "sparkles"
  | "trash";
type SearchResultKind = "task" | "artifact" | "view" | "action";
type SearchResultSection = {
  id: string;
  label: string;
  results: SearchResult[];
  canClear?: boolean;
};
type NotificationFilter = "全部" | "未读";
type NotificationTarget = "approvals" | "activity" | "artifact" | "task";
type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  target: NotificationTarget;
  targetId?: string;
  icon: typeof Bell;
  tone: "amber" | "blue" | "green" | "red";
};
type TaskFormErrors = Partial<
  Record<"name" | "target" | "description" | "scheduleTime", string>
>;
type TaskDraftSnapshot = {
  name: string;
  target: string;
  description: string;
  schedule: TaskSchedule;
  scheduleTime: string;
  scheduleDay: Weekday;
  approval: boolean;
};
type TaskDraftRecovery = {
  version: 1;
  savedAt: string;
  editingTaskId: string | null;
  draft: TaskDraftSnapshot;
  baseline: TaskDraftSnapshot;
};
type ArtifactDraftSnapshot = {
  title: string;
  filename: string;
  content: string;
};
type ArtifactDraftRecovery = {
  version: 1;
  savedAt: string;
  artifactId: string;
  baseVersion: number;
  draft: ArtifactDraftSnapshot;
};
type ArtifactFormErrors = Partial<
  Record<"title" | "filename" | "content", string>
>;

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

type TaskRun = {
  id: string;
  status: TaskRunStatus;
  startedAt: string;
  durationSeconds?: number;
  summary: string;
  errorCode?: string;
  errorMessage?: string;
};

type TaskRunStageStatus = "成功" | "失败" | "运行中" | "已取消" | "已跳过";
type TaskRunStage = {
  id: string;
  title: string;
  detail: string;
  status: TaskRunStageStatus;
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
  runs?: TaskRun[];
  lastError?: string;
  errorCode?: string;
  retryCount?: number;
};

type ArtifactTable = {
  columns: string[];
  rows: string[][];
};

type ArtifactRevision = {
  version: number;
  title: string;
  filename: string;
  content: string;
  createdAt: string;
  editor: string;
};

type ArtifactItem = {
  id: string;
  taskId: string;
  title: string;
  filename: string;
  description: string;
  type: ArtifactType;
  status: ArtifactStatus;
  format: string;
  sizeKb: number;
  updated: string;
  createdAt: string;
  content: string;
  highlights: string[];
  table?: ArtifactTable;
  evidenceCount?: number;
  starred?: boolean;
  version?: number;
  editedAt?: string;
  editedBy?: string;
  revisions?: ArtifactRevision[];
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
const taskSchedules: TaskSchedule[] = ["仅运行一次", "每天", "每周"];
const taskDraftRecoveryKey = "unzoo-one-task-draft-recovery";
const artifactDraftRecoveryKey = "unzoo-one-artifact-draft-recovery";
const taskDraftRecoveryMaxAge = 7 * 24 * 60 * 60 * 1000;
const defaultSettings: SettingsState = {
  approval: true,
  local: true,
  notifications: false,
};
const defaultUsageSettings: UsageSettings = {
  monthlyBudget: 1000,
  alertThreshold: 75,
  pauseAtLimit: true,
};
const defaultConnectorStates: ConnectorState = {
  browser: true,
  workspace: true,
  mail: true,
  calendar: false,
};
const connectorErrorCodes: Record<ConnectorId, string[]> = {
  browser: ["BROWSER_AUTH_EXPIRED"],
  workspace: ["WORKSPACE_PERMISSION_REVOKED"],
  mail: ["MAIL_AUTH_EXPIRED"],
  calendar: ["CALENDAR_AUTH_EXPIRED"],
};
const connectorCatalog: ConnectorDefinition[] = [
  {
    id: "browser",
    name: "Unzoo Browser",
    description: "读取网页、保存截图与提取页面结构",
    scope: "仅限任务指定页面",
    lastUsed: "刚刚 · 跟踪竞品发布动态",
    permissions: ["读取指定网页", "保存页面截图", "使用已授权会话"],
    icon: Globe2,
    tone: "blue",
  },
  {
    id: "workspace",
    name: "本机工作区",
    description: "读取项目文件并写入已批准的成果",
    scope: "仅限当前项目目录",
    lastUsed: "8 分钟前 · 整理本周项目进展",
    permissions: ["读取项目文件", "创建任务成果", "保留版本记录"],
    icon: HardDrive,
    tone: "green",
  },
  {
    id: "mail",
    name: "邮件连接器",
    description: "发送已批准的摘要、提醒与报告",
    scope: "发送前必须确认",
    lastUsed: "等待确认 · 竞品摘要",
    permissions: ["创建邮件草稿", "读取发送状态", "批准后发送邮件"],
    icon: Mail,
    tone: "amber",
  },
  {
    id: "calendar",
    name: "日历连接器",
    description: "读取空闲时间并安排自动任务",
    scope: "仅限空闲与任务日程",
    lastUsed: "尚未使用",
    permissions: ["读取空闲时间", "创建日程提醒", "更新任务时间"],
    icon: CalendarDays,
    tone: "violet",
  },
];
const teamRoleDetails: Record<
  TeamRole,
  { summary: string; permissions: string[] }
> = {
  所有者: {
    summary: "管理工作区、成员、任务与全部审批",
    permissions: ["管理成员与角色", "创建和编辑任务", "审批外部操作"],
  },
  管理员: {
    summary: "管理任务、连接器与团队日常设置",
    permissions: ["邀请新成员", "创建和编辑任务", "审批外部操作"],
  },
  审批者: {
    summary: "查看任务成果并处理待确认操作",
    permissions: ["查看全部任务", "查看和下载成果", "审批外部操作"],
  },
  成员: {
    summary: "查看任务与成果，不可修改安全设置",
    permissions: ["查看全部任务", "查看和下载成果", "添加任务备注"],
  },
};
const initialTeamMembers: TeamMember[] = [
  {
    id: "member-owner",
    name: "刘一帆",
    email: "yifan@unzoo.local",
    role: "所有者",
    status: "在线",
    avatar: "刘",
    tone: "blue",
    lastActive: "正在使用",
  },
  {
    id: "member-admin",
    name: "王安",
    email: "wangan@unzoo.local",
    role: "管理员",
    status: "在线",
    avatar: "王",
    tone: "green",
    lastActive: "12 分钟前",
  },
  {
    id: "member-approver",
    name: "陈默",
    email: "chenmo@unzoo.local",
    role: "审批者",
    status: "离线",
    avatar: "陈",
    tone: "amber",
    lastActive: "昨天 18:42",
  },
];

function isConnectorState(value: unknown): value is ConnectorState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<ConnectorState>;
  return (
    typeof state.browser === "boolean" &&
    typeof state.workspace === "boolean" &&
    typeof state.mail === "boolean" &&
    typeof state.calendar === "boolean"
  );
}

function isTaskDraftSnapshot(value: unknown): value is TaskDraftSnapshot {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<TaskDraftSnapshot>;
  return (
    typeof draft.name === "string" &&
    draft.name.length <= 80 &&
    typeof draft.target === "string" &&
    draft.target.length <= 240 &&
    typeof draft.description === "string" &&
    draft.description.length <= 500 &&
    typeof draft.schedule === "string" &&
    taskSchedules.includes(draft.schedule as TaskSchedule) &&
    typeof draft.scheduleTime === "string" &&
    (draft.scheduleTime === "" ||
      /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.scheduleTime)) &&
    typeof draft.scheduleDay === "string" &&
    weekdays.includes(draft.scheduleDay as Weekday) &&
    typeof draft.approval === "boolean"
  );
}

function parseTaskDraftRecovery(value: unknown): TaskDraftRecovery | null {
  if (!value || typeof value !== "object") return null;
  const recovery = value as Partial<TaskDraftRecovery>;
  const savedAt = recovery.savedAt ? Date.parse(recovery.savedAt) : Number.NaN;
  const age = Date.now() - savedAt;
  if (
    recovery.version !== 1 ||
    Number.isNaN(savedAt) ||
    age < -5 * 60 * 1000 ||
    age > taskDraftRecoveryMaxAge ||
    (recovery.editingTaskId !== null &&
      (typeof recovery.editingTaskId !== "string" ||
        recovery.editingTaskId.length > 160)) ||
    !isTaskDraftSnapshot(recovery.draft) ||
    !isTaskDraftSnapshot(recovery.baseline)
  ) {
    return null;
  }
  return recovery as TaskDraftRecovery;
}

function isArtifactDraftSnapshot(value: unknown): value is ArtifactDraftSnapshot {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<ArtifactDraftSnapshot>;
  return (
    typeof draft.title === "string" &&
    draft.title.length <= 100 &&
    typeof draft.filename === "string" &&
    draft.filename.length <= 120 &&
    typeof draft.content === "string" &&
    draft.content.length <= 100000
  );
}

function parseArtifactDraftRecovery(
  value: unknown,
): ArtifactDraftRecovery | null {
  if (!value || typeof value !== "object") return null;
  const recovery = value as Partial<ArtifactDraftRecovery>;
  const savedAt = recovery.savedAt ? Date.parse(recovery.savedAt) : Number.NaN;
  const age = Date.now() - savedAt;
  if (
    recovery.version !== 1 ||
    Number.isNaN(savedAt) ||
    age < -5 * 60 * 1000 ||
    age > taskDraftRecoveryMaxAge ||
    typeof recovery.artifactId !== "string" ||
    recovery.artifactId.length > 160 ||
    typeof recovery.baseVersion !== "number" ||
    !Number.isInteger(recovery.baseVersion) ||
    recovery.baseVersion < 1 ||
    !isArtifactDraftSnapshot(recovery.draft)
  ) {
    return null;
  }
  return recovery as ArtifactDraftRecovery;
}

function formatDraftSavedAt(savedAt: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(savedAt));
}

function getWorkspaceToday() {
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const month = dateParts.find((part) => part.type === "month")?.value ?? "";
  const day = dateParts.find((part) => part.type === "day")?.value ?? "";
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const greeting =
    hour < 6 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  return {
    eyebrow: `今天 · ${month} 月 ${day} 日`,
    greeting,
  };
}

function clearDraftRecoveryStorage(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Browsers may disable session storage; the active form remains usable.
  }
}

function DraftRecoveryNotice({
  id,
  icon: Icon,
  title,
  description,
  continueLabel,
  onContinue,
  onDiscard,
}: {
  id: string;
  icon: typeof Save;
  title: string;
  description: string;
  continueLabel: string;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  return (
    <section
      className="draft-recovery"
      role="status"
      aria-labelledby={`${id}-title`}
    >
      <span className="draft-recovery-icon">
        <Icon size={19} />
      </span>
      <span className="draft-recovery-copy">
        <strong id={`${id}-title`}>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="draft-recovery-actions">
        <button className="continue" type="button" onClick={onContinue}>
          <RotateCcw size={15} />
          {continueLabel}
        </button>
        <button type="button" onClick={onDiscard}>
          放弃草稿
        </button>
      </span>
    </section>
  );
}

function isUsageSettings(value: unknown): value is UsageSettings {
  if (!value || typeof value !== "object") return false;
  const usage = value as Partial<UsageSettings>;
  return (
    typeof usage.monthlyBudget === "number" &&
    Number.isFinite(usage.monthlyBudget) &&
    usage.monthlyBudget >= 100 &&
    usage.monthlyBudget <= 50000 &&
    [50, 75, 90].includes(usage.alertThreshold ?? 0) &&
    typeof usage.pauseAtLimit === "boolean"
  );
}

function isTeamMember(value: unknown): value is TeamMember {
  if (!value || typeof value !== "object") return false;
  const member = value as Partial<TeamMember>;
  return (
    typeof member.id === "string" &&
    typeof member.name === "string" &&
    typeof member.email === "string" &&
    ["所有者", "管理员", "审批者", "成员"].includes(member.role ?? "") &&
    ["在线", "离线", "已邀请"].includes(member.status ?? "") &&
    typeof member.avatar === "string" &&
    ["blue", "green", "amber", "violet"].includes(member.tone ?? "") &&
    typeof member.lastActive === "string"
  );
}

function isTaskRun(value: unknown): value is TaskRun {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<TaskRun>;
  return (
    typeof run.id === "string" &&
    ["运行中", "成功", "失败", "已取消"].includes(run.status ?? "") &&
    typeof run.startedAt === "string" &&
    !Number.isNaN(Date.parse(run.startedAt)) &&
    (run.durationSeconds === undefined ||
      (typeof run.durationSeconds === "number" &&
        Number.isFinite(run.durationSeconds) &&
        run.durationSeconds >= 0)) &&
    typeof run.summary === "string" &&
    (run.errorCode === undefined || typeof run.errorCode === "string") &&
    (run.errorMessage === undefined || typeof run.errorMessage === "string")
  );
}

function isTaskItem(value: unknown): value is TaskItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TaskItem>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.description === "string" &&
    typeof item.target === "string" &&
    ["运行中", "待确认", "失败", "已完成", "已暂停"].includes(
      item.status ?? "",
    ) &&
    typeof item.progress === "number" &&
    Number.isFinite(item.progress) &&
    typeof item.updated === "string" &&
    (item.schedule === undefined ||
      ["仅运行一次", "每天", "每周"].includes(item.schedule)) &&
    (item.scheduleTime === undefined || typeof item.scheduleTime === "string") &&
    (item.scheduleDay === undefined || weekdays.includes(item.scheduleDay)) &&
    (item.requiresApproval === undefined ||
      typeof item.requiresApproval === "boolean") &&
    (item.pinned === undefined || typeof item.pinned === "boolean") &&
    (item.runs === undefined ||
      (Array.isArray(item.runs) && item.runs.every(isTaskRun))) &&
    (item.lastError === undefined || typeof item.lastError === "string") &&
    (item.errorCode === undefined || typeof item.errorCode === "string") &&
    (item.retryCount === undefined ||
      (typeof item.retryCount === "number" &&
        Number.isInteger(item.retryCount) &&
        item.retryCount >= 0))
  );
}

function isArtifactItem(value: unknown): value is ArtifactItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ArtifactItem>;
  const validTable =
    item.table === undefined ||
    (Array.isArray(item.table.columns) &&
      item.table.columns.every((column) => typeof column === "string") &&
      Array.isArray(item.table.rows) &&
      item.table.rows.every(
        (row) =>
          Array.isArray(row) && row.every((cell) => typeof cell === "string"),
      ));
  const validRevisions =
    item.revisions === undefined ||
    (Array.isArray(item.revisions) &&
      item.revisions.every(
        (revision) =>
          revision &&
          typeof revision === "object" &&
          typeof revision.version === "number" &&
          Number.isFinite(revision.version) &&
          typeof revision.title === "string" &&
          typeof revision.filename === "string" &&
          typeof revision.content === "string" &&
          typeof revision.createdAt === "string" &&
          typeof revision.editor === "string",
      ));
  return (
    typeof item.id === "string" &&
    typeof item.taskId === "string" &&
    typeof item.title === "string" &&
    typeof item.filename === "string" &&
    typeof item.description === "string" &&
    ["报告", "数据", "证据", "草稿"].includes(item.type ?? "") &&
    ["已完成", "草稿", "已修订"].includes(item.status ?? "") &&
    typeof item.format === "string" &&
    typeof item.sizeKb === "number" &&
    Number.isFinite(item.sizeKb) &&
    typeof item.updated === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.content === "string" &&
    Array.isArray(item.highlights) &&
    item.highlights.every((highlight) => typeof highlight === "string") &&
    validTable &&
    (item.evidenceCount === undefined ||
      (typeof item.evidenceCount === "number" &&
        Number.isFinite(item.evidenceCount))) &&
    (item.starred === undefined || typeof item.starred === "boolean") &&
    (item.version === undefined ||
      (typeof item.version === "number" &&
        Number.isFinite(item.version) &&
        item.version >= 1)) &&
    (item.editedAt === undefined || typeof item.editedAt === "string") &&
    (item.editedBy === undefined || typeof item.editedBy === "string") &&
    validRevisions
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
      "file",
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
    Number.isNaN(Date.parse(backup.exportedAt)) ||
    !Array.isArray(backup.tasks) ||
    backup.tasks.length === 0 ||
    !backup.tasks.every(isTaskItem) ||
    !backup.settings ||
    typeof backup.settings.approval !== "boolean" ||
    typeof backup.settings.local !== "boolean" ||
    typeof backup.settings.notifications !== "boolean" ||
    (backup.usage !== undefined && !isUsageSettings(backup.usage)) ||
    (backup.connectors !== undefined && !isConnectorState(backup.connectors)) ||
    (backup.members !== undefined &&
      (!Array.isArray(backup.members) ||
        backup.members.length === 0 ||
        !backup.members.every(isTeamMember))) ||
    !Array.isArray(backup.approvalIds) ||
    !backup.approvalIds.every((id) => typeof id === "string") ||
    !Array.isArray(backup.activity) ||
    !backup.activity.every(isActivityItem) ||
    (backup.artifacts !== undefined &&
      (!Array.isArray(backup.artifacts) ||
        !backup.artifacts.every(isArtifactItem)))
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

function formatTaskRunTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatTaskRunDuration(seconds?: number) {
  if (seconds === undefined) return "进行中";
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes} 分 ${remainder} 秒` : `${minutes} 分钟`;
}

function stopActiveTaskRuns(
  runs: TaskRun[] | undefined,
  summary: string,
  stoppedAt = new Date(),
) {
  let stopped = false;
  return (runs ?? []).map((run) => {
    if (stopped || run.status !== "运行中") return run;
    stopped = true;
    const startedAt = new Date(run.startedAt).getTime();
    const elapsed = Number.isNaN(startedAt)
      ? 1
      : Math.max(1, Math.round((stoppedAt.getTime() - startedAt) / 1000));
    return {
      ...run,
      status: "已取消" as const,
      durationSeconds: elapsed,
      summary,
    };
  });
}

function getTaskRunStages(run: TaskRun): TaskRunStage[] {
  const failedDuringAuthorization =
    run.status === "失败" &&
    /AUTH|PERMISSION|ACCESS/.test(
      `${run.errorCode ?? ""} ${run.errorMessage ?? ""}`,
    );
  const executionStatus: TaskRunStageStatus =
    run.status === "运行中"
      ? "运行中"
      : run.status === "成功"
        ? "成功"
        : run.status === "已取消"
          ? "已取消"
          : failedDuringAuthorization
            ? "已跳过"
            : "失败";

  return [
    {
      id: "configuration",
      title: "载入任务配置",
      detail: "已读取任务目标、运行计划和执行边界。",
      status: "成功",
    },
    {
      id: "authorization",
      title: "验证连接器与权限",
      detail: failedDuringAuthorization
        ? run.errorMessage ?? "连接器授权验证未通过。"
        : "连接器和审批边界已通过运行前检查。",
      status: failedDuringAuthorization ? "失败" : "成功",
    },
    {
      id: "execution",
      title: "执行任务步骤",
      detail:
        executionStatus === "已跳过"
          ? "为避免越过授权边界，系统没有进入外部执行。"
          : run.summary,
      status: executionStatus,
    },
    {
      id: "audit",
      title: "保存结果与审计",
      detail:
        run.status === "运行中"
          ? "运行结束后会保存结果、耗时和完整审计。"
          : "运行结果和安全边界已写入本机审计记录。",
      status: run.status === "运行中" ? "已跳过" : "成功",
    },
  ];
}

function formatAuditTimestamp(createdAt: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date(createdAt))
    .replace(/\//g, "-");
}

function getNextRunLabel(task: TaskItem) {
  if (task.status === "已暂停") return "恢复任务后重新计算";
  if (task.schedule === "每天") return `明天 ${task.scheduleTime ?? "09:00"}`;
  if (task.schedule === "每周") {
    return `下一个${task.scheduleDay ?? "周一"} ${task.scheduleTime ?? "09:00"}`;
  }
  return task.status === "已完成" ? "已完成" : "创建后立即运行";
}

const navItems: Array<{
  id: ViewId;
  label: string;
  mobileLabel: string;
  icon: typeof Home;
}> = [
  { id: "home", label: "首页", mobileLabel: "首页", icon: Home },
  { id: "tasks", label: "任务", mobileLabel: "任务", icon: ListChecks },
  { id: "approvals", label: "待确认", mobileLabel: "确认", icon: ShieldCheck },
  { id: "artifacts", label: "成果", mobileLabel: "成果", icon: Files },
  { id: "activity", label: "运行记录", mobileLabel: "记录", icon: History },
  { id: "settings", label: "设置", mobileLabel: "设置", icon: Settings2 },
];

function readWorkspaceRoute(): WorkspaceRoute {
  const url = new URL(window.location.href);
  const requestedView = url.searchParams.get("view");
  const view =
    requestedView &&
    navItems.some((item) => item.id === requestedView)
      ? (requestedView as ViewId)
      : "home";
  const taskId = url.searchParams.get("task")?.trim() || null;
  const runId = taskId
    ? url.searchParams.get("run")?.trim() || null
    : null;
  return {
    view: taskId ? "tasks" : view,
    taskId,
    runId,
  };
}

function writeWorkspaceRoute(
  route: WorkspaceRoute,
  mode: "push" | "replace",
  canPop = false,
) {
  const url = new URL(window.location.href);
  if (route.view === "home") {
    url.searchParams.delete("view");
  } else {
    url.searchParams.set("view", route.view);
  }
  if (route.taskId) {
    url.searchParams.set("task", route.taskId);
  } else {
    url.searchParams.delete("task");
  }
  if (route.taskId && route.runId) {
    url.searchParams.set("run", route.runId);
  } else {
    url.searchParams.delete("run");
  }

  const nextLocation = `${url.pathname}${url.search}${url.hash}`;
  const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const shouldPush = mode === "push" && nextLocation !== currentLocation;
  const currentState = window.history.state as
    | WorkspaceHistoryState
    | null;
  const nextState: WorkspaceHistoryState = {
    unzooOne: true,
    route,
    canPop: shouldPush
      ? true
      : mode === "replace"
        ? canPop
        : (currentState?.canPop ?? false),
  };
  window.history[shouldPush ? "pushState" : "replaceState"](
    nextState,
    "",
    nextLocation,
  );
}

function canReturnToWorkspaceParent() {
  const state = window.history.state as WorkspaceHistoryState | null;
  return Boolean(state?.unzooOne && state.canPop);
}

const taskFilters: TaskFilter[] = [
  "全部",
  "运行中",
  "待确认",
  "失败",
  "已暂停",
  "已完成",
];
const approvalRiskFilters: ApprovalRiskFilter[] = [
  "全部",
  "高风险",
  "中风险",
  "低风险",
];
const artifactFilters: ArtifactFilter[] = [
  "全部",
  "重点",
  "报告",
  "数据",
  "证据",
  "草稿",
];
const activityFilters: ActivityFilter[] = ["全部", "任务", "审批", "系统"];

const viewTitles: Record<ViewId, { eyebrow: string; title: string; description: string }> = {
  home: {
    eyebrow: "今天",
    title: "你好，今天有需要你处理的事项",
    description: "任务正在后台运行，只有需要你决定时才会停下来。",
  },
  tasks: {
    eyebrow: "任务",
    title: "所有任务",
    description: "查看运行、确认、失败恢复与已完成任务。",
  },
  approvals: {
    eyebrow: "待确认",
    title: "需要你决定的操作",
    description: "Unzoo One 不会在你确认前执行外部发送或敏感访问。",
  },
  artifacts: {
    eyebrow: "成果",
    title: "任务交付与证据",
    description: "查看 AI 生成的报告、数据和证据包，并追溯到对应任务。",
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
    id: "sales-digest",
    title: "同步销售线索周报",
    description: "汇总新增线索和跟进状态，生成摘要后发送给销售负责人。",
    target: "销售工作区 / 邮件连接器",
    status: "失败",
    progress: 42,
    updated: "6 分钟前失败",
    schedule: "每周",
    scheduleTime: "10:00",
    scheduleDay: "周一",
    requiresApproval: true,
    lastError: "邮件连接器授权已过期，任务在发送前安全停止。",
    errorCode: "MAIL_AUTH_EXPIRED",
    retryCount: 1,
    runs: [
      {
        id: "run-sales-20260729",
        status: "失败",
        startedAt: "2026-07-29T15:18:00+08:00",
        durationSeconds: 94,
        summary: "已生成销售摘要，但没有执行外部发送。",
        errorCode: "MAIL_AUTH_EXPIRED",
        errorMessage: "邮件连接器授权已过期。",
      },
      {
        id: "run-sales-20260722",
        status: "成功",
        startedAt: "2026-07-22T10:00:00+08:00",
        durationSeconds: 128,
        summary: "周报已生成并在确认后发送给销售负责人。",
      },
      {
        id: "run-sales-20260715",
        status: "成功",
        startedAt: "2026-07-15T10:00:00+08:00",
        durationSeconds: 121,
        summary: "完成 18 条销售线索汇总并保存证据。",
      },
    ],
  },
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
    runs: [
      {
        id: "run-competitor-current",
        status: "运行中",
        startedAt: "2026-07-29T15:24:00+08:00",
        summary: "正在比对 3 个竞品页面的最新变化。",
      },
      {
        id: "run-competitor-previous",
        status: "成功",
        startedAt: "2026-07-28T09:00:00+08:00",
        durationSeconds: 156,
        summary: "发现 2 处有效变化并生成竞品摘要。",
      },
    ],
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
    runs: [
      {
        id: "run-weekly-current",
        status: "运行中",
        startedAt: "2026-07-29T15:12:00+08:00",
        summary: "周报草稿已完成，正在等待发送确认。",
      },
      {
        id: "run-weekly-previous",
        status: "成功",
        startedAt: "2026-07-25T17:30:00+08:00",
        durationSeconds: 202,
        summary: "已汇总 5 个项目文件并保存周报草稿。",
      },
    ],
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
    runs: [
      {
        id: "run-meeting-complete",
        status: "成功",
        startedAt: "2026-07-29T10:28:00+08:00",
        durationSeconds: 244,
        summary: "评审材料、议题和待解决问题已整理完成。",
      },
    ],
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
    runs: [
      {
        id: "run-research-complete",
        status: "成功",
        startedAt: "2026-07-28T17:58:00+08:00",
        durationSeconds: 486,
        summary: "已保存 8 个产品页面并提取结构化信息。",
      },
    ],
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

const initialArtifacts: ArtifactItem[] = [
  {
    id: "artifact-competitor-report",
    taskId: "competitor",
    title: "竞品发布动态摘要",
    filename: "competitor-report.md",
    description: "汇总 3 个竞品页面的 4 项变化，并给出值得跟进的产品信号。",
    type: "报告",
    status: "已完成",
    format: "Markdown",
    sizeKb: 18.4,
    updated: "2 分钟前",
    createdAt: "2026-07-29T14:28:00+08:00",
    content: `# 竞品发布动态摘要

## 今日变化
- Unzoo Browser 更新了团队工作区说明。
- 两个竞品新增企业权限控制页面。
- 一个竞品调整了自动化套餐价格。
- 三个页面共识别出 4 项有效变化。

## 建议
优先跟进企业权限与审计能力，并确认定价变化是否影响当前产品定位。`,
    highlights: ["4 项有效变化", "3 个竞品页面", "2 项高价值信号"],
    starred: true,
  },
  {
    id: "artifact-evidence-package",
    taskId: "competitor",
    title: "页面变化证据包",
    filename: "competitor-evidence.json",
    description: "包含页面地址、采集时间、内容哈希和 12 张页面截图的证据清单。",
    type: "证据",
    status: "已完成",
    format: "JSON",
    sizeKb: 46.8,
    updated: "7 分钟前",
    createdAt: "2026-07-29T14:23:00+08:00",
    content: `{
  "task": "跟踪竞品发布动态",
  "capturedAt": "2026-07-29T14:23:00+08:00",
  "pages": 3,
  "screenshots": 12,
  "integrity": "verified"
}`,
    highlights: ["12 张页面截图", "3 个来源", "完整性已验证"],
    evidenceCount: 12,
  },
  {
    id: "artifact-change-data",
    taskId: "competitor",
    title: "竞品变化结构化数据",
    filename: "competitor-changes.csv",
    description: "适合继续分析或导入表格的结构化变化明细。",
    type: "数据",
    status: "已完成",
    format: "CSV",
    sizeKb: 8.2,
    updated: "8 分钟前",
    createdAt: "2026-07-29T14:22:00+08:00",
    content: `竞品,变化类型,优先级,采集时间
Unzoo Browser,企业权限,高,14:21
Browserbase,套餐定价,中,14:20
MultiOn,产品文案,低,14:18`,
    highlights: ["3 条结构化记录", "1 项高优先级", "可直接导入表格"],
    table: {
      columns: ["竞品", "变化类型", "优先级", "采集时间"],
      rows: [
        ["Unzoo Browser", "企业权限", "高", "14:21"],
        ["Browserbase", "套餐定价", "中", "14:20"],
        ["MultiOn", "产品文案", "低", "14:18"],
      ],
    },
  },
  {
    id: "artifact-weekly-draft",
    taskId: "weekly-report",
    title: "本周项目进展草稿",
    filename: "weekly-progress-draft.md",
    description: "已汇总项目文件和运行记录，等待审批后写入项目目录。",
    type: "草稿",
    status: "草稿",
    format: "Markdown",
    sizeKb: 12.6,
    updated: "11 分钟前",
    createdAt: "2026-07-29T14:19:00+08:00",
    content: `# 本周项目进展

## 已完成
- 完成 AI 任务控制台首页与任务管理。
- 补齐审批、审计和本机数据恢复流程。

## 下周计划
- 接入真实任务运行数据。
- 完善团队协作和交付物管理。`,
    highlights: ["2 项已完成", "2 项下周计划", "等待写入审批"],
  },
  {
    id: "artifact-review-brief",
    taskId: "meeting",
    title: "产品评审议题简报",
    filename: "product-review-brief.md",
    description: "整理本次产品评审的核心议题、相关背景和待决策问题。",
    type: "报告",
    status: "已完成",
    format: "Markdown",
    sizeKb: 15.1,
    updated: "今天 10:32",
    createdAt: "2026-07-29T10:32:00+08:00",
    content: `# 产品评审议题简报

## 核心议题
1. 审批流程是否覆盖高风险外部操作。
2. 任务成果是否能够完整追溯。
3. 团队工作区的数据保留策略。`,
    highlights: ["3 个核心议题", "5 份关联资料", "评审材料已就绪"],
  },
  {
    id: "artifact-research-data",
    taskId: "research",
    title: "AI 浏览器产品研究表",
    filename: "ai-browser-research.csv",
    description: "包含 6 个产品的功能、团队、定价和企业能力对比。",
    type: "数据",
    status: "已完成",
    format: "CSV",
    sizeKb: 22.9,
    updated: "昨天 18:06",
    createdAt: "2026-07-28T18:06:00+08:00",
    content: `产品,自动化,团队协作,企业权限
Unzoo Browser,支持,支持,支持
Browserbase,支持,支持,支持
MultiOn,支持,有限,有限`,
    highlights: ["6 个产品", "4 个对比维度", "研究已完成"],
    table: {
      columns: ["产品", "自动化", "团队协作", "企业权限"],
      rows: [
        ["Unzoo Browser", "支持", "支持", "支持"],
        ["Browserbase", "支持", "支持", "支持"],
        ["MultiOn", "支持", "有限", "有限"],
      ],
    },
  },
];

const activityIconMap: Record<ActivityIconKey, typeof Activity> = {
  activity: Activity,
  brain: Brain,
  clock: Clock3,
  copy: Copy,
  file: Files,
  globe: Globe2,
  settings: Settings2,
  shield: ShieldCheck,
  sparkles: Sparkles,
  trash: Trash2,
};

const artifactIconMap: Record<ArtifactType, typeof Files> = {
  报告: FileText,
  数据: Table2,
  证据: FileJson,
  草稿: Pencil,
};

const initialActivityItems: ActivityItem[] = [
  {
    id: "activity-sales-auth-failed",
    time: "15:20",
    createdAt: "2026-07-29T15:20:00+08:00",
    title: "任务已在发送前安全停止",
    detail: "邮件连接器授权已过期，未向销售负责人发送任何内容。",
    icon: "shield",
    tone: "red",
    kind: "系统",
    taskId: "sales-digest",
  },
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

function subscribeToNetworkStatus(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getNetworkStatusSnapshot() {
  return window.navigator.onLine;
}

function getServerNetworkStatusSnapshot() {
  return true;
}

export default function HomePage() {
  const [activeView, setActiveView] = useState<ViewId>("home");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [recentSearchKeys, setRecentSearchKeys] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const isOnline = useSyncExternalStore(
    subscribeToNetworkStatus,
    getNetworkStatusSnapshot,
    getServerNetworkStatusSnapshot,
  );
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);
  const [selectedStep, setSelectedStep] = useState("analyze");
  const [approvals, setApprovals] = useState(initialApprovals);
  const [selectedApprovalId, setSelectedApprovalId] = useState(initialApprovals[0].id);
  const [approvalListQuery, setApprovalListQuery] = useState("");
  const [approvalRiskFilter, setApprovalRiskFilter] =
    useState<ApprovalRiskFilter>("全部");
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<string[]>([]);
  const [bulkApprovalDecision, setBulkApprovalDecision] =
    useState<BulkApprovalDecision | null>(null);
  const [approvalRejectReason, setApprovalRejectReason] = useState("");
  const [approvalRejectSnapshot, setApprovalRejectSnapshot] =
    useState<ApprovalRejectSnapshot | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>(initialActivityItems);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("全部");
  const [activityTaskId, setActivityTaskId] = useState<string | null>(null);
  const [activityListQuery, setActivityListQuery] = useState("");
  const [activitySort, setActivitySort] = useState<ActivitySort>("最新优先");
  const [selectedActivityId, setSelectedActivityId] = useState(
    initialActivityItems[0].id,
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] =
    useState<NotificationFilter>("全部");
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraftBaseline, setTaskDraftBaseline] =
    useState<TaskDraftSnapshot | null>(null);
  const [pendingTaskDraftRecovery, setPendingTaskDraftRecovery] =
    useState<TaskDraftRecovery | null>(null);
  const [taskDraftAutoSavedAt, setTaskDraftAutoSavedAt] = useState<
    string | null
  >(null);
  const [taskDraftAutoSavedSignature, setTaskDraftAutoSavedSignature] =
    useState("");
  const [taskDraftSaveFailedSignature, setTaskDraftSaveFailedSignature] =
    useState("");
  const [taskDiscardOpen, setTaskDiscardOpen] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [rejectApprovalId, setRejectApprovalId] = useState<string | null>(null);
  const [temporaryModeOpen, setTemporaryModeOpen] = useState(false);
  const [workspaceResetOpen, setWorkspaceResetOpen] = useState(false);
  const [pendingWorkspaceImport, setPendingWorkspaceImport] =
    useState<PendingWorkspaceImport | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>(initialArtifacts);
  const [artifactFilter, setArtifactFilter] = useState<ArtifactFilter>("全部");
  const [artifactTaskId, setArtifactTaskId] = useState<string | null>(null);
  const [artifactListQuery, setArtifactListQuery] = useState("");
  const [artifactSort, setArtifactSort] = useState<ArtifactSort>("最近更新");
  const [selectedArtifactId, setSelectedArtifactId] = useState(
    initialArtifacts[0].id,
  );
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(
    null,
  );
  const [artifactTitleDraft, setArtifactTitleDraft] = useState("");
  const [artifactFilenameDraft, setArtifactFilenameDraft] = useState("");
  const [artifactContentDraft, setArtifactContentDraft] = useState("");
  const [pendingArtifactDraftRecovery, setPendingArtifactDraftRecovery] =
    useState<ArtifactDraftRecovery | null>(null);
  const [artifactDraftAutoSavedAt, setArtifactDraftAutoSavedAt] = useState<
    string | null
  >(null);
  const [artifactDraftAutoSavedSignature, setArtifactDraftAutoSavedSignature] =
    useState("");
  const [artifactDraftSaveFailedSignature, setArtifactDraftSaveFailedSignature] =
    useState("");
  const [artifactEditSubmitted, setArtifactEditSubmitted] = useState(false);
  const [artifactDiscardOpen, setArtifactDiscardOpen] = useState(false);
  const [artifactDeleteId, setArtifactDeleteId] = useState<string | null>(null);
  const [artifactDeleteSnapshot, setArtifactDeleteSnapshot] =
    useState<ArtifactDeleteSnapshot | null>(null);
  const [isSavingArtifact, setIsSavingArtifact] = useState(false);
  const [tasksReady, setTasksReady] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("全部");
  const [taskListQuery, setTaskListQuery] = useState("");
  const [taskSort, setTaskSort] = useState<TaskSort>("状态优先");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [taskDeleteSnapshot, setTaskDeleteSnapshot] =
    useState<TaskDeleteSnapshot | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [inspectedRunTaskId, setInspectedRunTaskId] =
    useState<string | null>(null);
  const [inspectedRunId, setInspectedRunId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [workspaceLoadWarning, setWorkspaceLoadWarning] = useState("");
  const [taskName, setTaskName] = useState("跟踪一个新网页");
  const [taskTarget, setTaskTarget] = useState("https://example.com");
  const [taskDescription, setTaskDescription] = useState(
    "检查页面内容变化，只保留有意义的更新并生成摘要。",
  );
  const [taskSchedule, setTaskSchedule] = useState<TaskSchedule>("每天");
  const [taskScheduleTime, setTaskScheduleTime] = useState("09:00");
  const [taskScheduleDay, setTaskScheduleDay] = useState<Weekday>("周一");
  const [taskApproval, setTaskApproval] = useState(true);
  const [taskFormSubmitted, setTaskFormSubmitted] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [desktopNotificationPermission, setDesktopNotificationPermission] =
    useState<DesktopNotificationPermission>("checking");
  const [
    isRequestingNotificationPermission,
    setIsRequestingNotificationPermission,
  ] = useState(false);
  const [usageSettings, setUsageSettings] =
    useState<UsageSettings>(defaultUsageSettings);
  const [usageBudgetOpen, setUsageBudgetOpen] = useState(false);
  const [usageBudgetDraft, setUsageBudgetDraft] = useState(
    String(defaultUsageSettings.monthlyBudget),
  );
  const [usageAlertDraft, setUsageAlertDraft] =
    useState<BudgetAlertThreshold>(defaultUsageSettings.alertThreshold);
  const [usagePauseDraft, setUsagePauseDraft] = useState(
    defaultUsageSettings.pauseAtLimit,
  );
  const [settingsDiscardTarget, setSettingsDiscardTarget] =
    useState<SettingsDraftTarget | null>(null);
  const [connectorStates, setConnectorStates] = useState<ConnectorState>(
    defaultConnectorStates,
  );
  const [selectedConnectorId, setSelectedConnectorId] =
    useState<ConnectorId | null>(null);
  const [connectorTestingId, setConnectorTestingId] =
    useState<ConnectorId | null>(null);
  const [connectorDisconnectConfirm, setConnectorDisconnectConfirm] =
    useState(false);
  const [teamMembers, setTeamMembers] =
    useState<TeamMember[]>(initialTeamMembers);
  const [teamInviteOpen, setTeamInviteOpen] = useState(false);
  const [selectedTeamMemberId, setSelectedTeamMemberId] =
    useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("成员");
  const [inviteFormSubmitted, setInviteFormSubmitted] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [memberRoleDraft, setMemberRoleDraft] = useState<TeamRole>("成员");
  const [memberRemoveConfirm, setMemberRemoveConfirm] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationWrapRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const desktopNotificationIdsRef = useRef<Set<string>>(new Set());
  const desktopNotificationTrackingReadyRef = useRef(false);
  const workspaceMenuWrapRef = useRef<HTMLDivElement>(null);
  const workspaceMenuButtonRef = useRef<HTMLButtonElement>(null);
  const workspaceMenuPanelRef = useRef<HTMLDivElement>(null);
  const overlayTriggerRef = useRef<HTMLElement | null>(null);
  const routeReadyRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const approvalDetailRef = useRef<HTMLDivElement>(null);
  const activityInspectorRef = useRef<HTMLElement>(null);
  const artifactTitleRef = useRef<HTMLInputElement>(null);
  const artifactFilenameRef = useRef<HTMLInputElement>(null);
  const artifactContentRef = useRef<HTMLTextAreaElement>(null);
  const artifactSavingRef = useRef(false);
  const artifactDraftRecoveryOwnedRef = useRef(false);
  const taskNameRef = useRef<HTMLInputElement>(null);
  const taskTargetRef = useRef<HTMLInputElement>(null);
  const taskDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const taskScheduleTimeRef = useRef<HTMLInputElement>(null);
  const taskSavingRef = useRef(false);
  const taskDraftRecoveryOwnedRef = useRef(false);
  const inviteSavingRef = useRef(false);

  const failedTaskCount = tasks.filter((task) => task.status === "失败").length;
  const attentionCount = approvals.length + failedTaskCount;
  const workspaceToday = getWorkspaceToday();
  const systemStatusTone = !isOnline
    ? "offline"
    : isRunning
      ? "online"
      : "paused";
  const systemStatusLabel = !isOnline
    ? "设备当前离线"
    : isRunning
      ? "系统运行正常"
      : "自动运行已暂停";
  const systemStatusDetail = !isOnline
    ? "本机数据可用 · 在线能力暂停"
    : settings.local
      ? "数据保存在本机"
      : "临时会话 · 关闭后清空";
  const pageTitle =
    activeView === "home"
      ? {
          ...viewTitles.home,
          eyebrow: workspaceToday.eyebrow,
          title: `${workspaceToday.greeting}，今天有 ${attentionCount} 件事需要你处理`,
          description:
            failedTaskCount > 0
              ? `${failedTaskCount} 个任务需要恢复，${approvals.length} 项操作等待确认。`
              : viewTitles.home.description,
        }
      : viewTitles[activeView];
  const selectedApproval =
    approvals.find((item) => item.id === selectedApprovalId) ?? approvals[0];
  const normalizedApprovalQuery = approvalListQuery.trim().toLowerCase();
  const filteredApprovals = useMemo(
    () =>
      approvals.filter((approval) => {
        const relatedTaskTitle =
          tasks.find((task) => task.id === approval.taskId)?.title ?? "";
        const matchesRisk =
          approvalRiskFilter === "全部" ||
          approval.risk === approvalRiskFilter;
        const matchesQuery =
          !normalizedApprovalQuery ||
          [
            approval.title,
            approval.reason,
            approval.target,
            approval.scope,
            approval.policy,
            relatedTaskTitle,
          ].some((value) =>
            value.toLowerCase().includes(normalizedApprovalQuery),
          );
        return matchesRisk && matchesQuery;
      }),
    [approvalRiskFilter, approvals, normalizedApprovalQuery, tasks],
  );
  const selectedApprovals = approvals.filter((approval) =>
    selectedApprovalIds.includes(approval.id),
  );
  const selectedVisibleApprovalCount = filteredApprovals.filter((approval) =>
    selectedApprovalIds.includes(approval.id),
  ).length;
  const allVisibleApprovalsSelected =
    filteredApprovals.length > 0 &&
    selectedVisibleApprovalCount === filteredApprovals.length;
  const bulkApprovableApprovals = selectedApprovals.filter(
    (approval) => approval.risk !== "高风险",
  );
  const selectedHighRiskApprovalCount =
    selectedApprovals.length - bulkApprovableApprovals.length;
  const selectedApprovalTaskCount = new Set(
    selectedApprovals.map((approval) => approval.taskId),
  ).size;
  const approvalRiskCounts: Record<ApprovalRiskFilter, number> = {
    全部: approvals.length,
    高风险: approvals.filter((approval) => approval.risk === "高风险").length,
    中风险: approvals.filter((approval) => approval.risk === "中风险").length,
    低风险: approvals.filter((approval) => approval.risk === "低风险").length,
  };
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedTaskRuns = selectedTask?.runs ?? [];
  const selectedTaskRecoveryReady =
    selectedTask?.errorCode === "RECOVERY_READY";
  const selectedTaskFinishedRuns = selectedTaskRuns.filter((run) =>
    ["成功", "失败"].includes(run.status),
  );
  const selectedTaskSuccessfulRuns = selectedTaskFinishedRuns.filter(
    (run) => run.status === "成功",
  );
  const selectedTaskSuccessRate = selectedTaskFinishedRuns.length
    ? Math.round(
        (selectedTaskSuccessfulRuns.length / selectedTaskFinishedRuns.length) *
          100,
      )
    : null;
  const selectedTaskRunDurations = selectedTaskFinishedRuns
    .map((run) => run.durationSeconds)
    .filter((duration): duration is number => duration !== undefined);
  const selectedTaskAverageDuration = selectedTaskRunDurations.length
    ? Math.round(
        selectedTaskRunDurations.reduce((total, duration) => total + duration, 0) /
          selectedTaskRunDurations.length,
      )
    : undefined;
  const inspectedRunTask =
    tasks.find((task) => task.id === inspectedRunTaskId) ?? null;
  const inspectedRun =
    inspectedRunTask?.runs?.find((run) => run.id === inspectedRunId) ?? null;
  const inspectedRunStages = inspectedRun ? getTaskRunStages(inspectedRun) : [];
  const inspectedRunArtifacts = inspectedRunTask
    ? artifacts.filter((artifact) => artifact.taskId === inspectedRunTask.id)
    : [];
  const inspectedRunActivity = inspectedRunTask
    ? activityLog.filter((item) => item.taskId === inspectedRunTask.id).slice(0, 5)
    : [];
  const inspectedRunAuthorizationBlocked = Boolean(
    inspectedRun?.status === "失败" &&
      /AUTH|PERMISSION|ACCESS/.test(
        `${inspectedRun.errorCode ?? ""} ${inspectedRun.errorMessage ?? ""}`,
      ),
  );
  const inspectedRunLaunchType = inspectedRun?.summary.includes("重试")
    ? "人工重试"
    : inspectedRun?.summary.includes("继续")
      ? "断点继续"
      : inspectedRunTask?.schedule === "仅运行一次"
        ? "手动启动"
        : "计划触发";
  const connectorIssueTasks: Record<ConnectorId, TaskItem[]> = {
    browser: tasks.filter((task) =>
      connectorErrorCodes.browser.includes(task.errorCode ?? ""),
    ),
    workspace: tasks.filter((task) =>
      connectorErrorCodes.workspace.includes(task.errorCode ?? ""),
    ),
    mail: tasks.filter((task) =>
      connectorErrorCodes.mail.includes(task.errorCode ?? ""),
    ),
    calendar: tasks.filter((task) =>
      connectorErrorCodes.calendar.includes(task.errorCode ?? ""),
    ),
  };
  const selectedConnector =
    connectorCatalog.find((connector) => connector.id === selectedConnectorId) ??
    null;
  const selectedConnectorIssueTasks = selectedConnector
    ? connectorIssueTasks[selectedConnector.id]
    : [];
  const selectedConnectorHasIssue = selectedConnectorIssueTasks.length > 0;
  const selectedTeamMember =
    teamMembers.find((member) => member.id === selectedTeamMemberId) ?? null;
  const approverMemberCount = teamMembers.filter((member) =>
    ["所有者", "管理员", "审批者"].includes(member.role),
  ).length;
  const onlineMemberCount = teamMembers.filter(
    (member) => member.status === "在线",
  ).length;
  const SelectedConnectorIcon = selectedConnector?.icon ?? Link2;
  const connectedConnectorCount = connectorCatalog.filter(
    (connector) => connectorStates[connector.id],
  ).length;
  const healthyConnectorCount = connectorCatalog.filter(
    (connector) =>
      connectorStates[connector.id] &&
      connectorIssueTasks[connector.id].length === 0,
  ).length;
  const connectorIssueCount = connectorCatalog.filter(
    (connector) => connectorIssueTasks[connector.id].length > 0,
  ).length;
  const connectorUsageCounts: Record<ConnectorId, number> = {
    browser: tasks.filter((task) => /^https?:\/\//i.test(task.target)).length,
    workspace: tasks.filter((task) => !/^https?:\/\//i.test(task.target)).length,
    mail: approvals.filter((item) =>
      `${item.title} ${item.reason} ${item.action}`.includes("发送"),
    ).length,
    calendar: tasks.filter((task) => task.schedule !== "仅运行一次").length,
  };
  const reasoningCredits =
    120 +
    Math.ceil(
      tasks.reduce((total, task) => total + task.progress, 0) * 0.72,
    ) +
    activityLog.filter((item) => item.icon === "brain").length * 5;
  const browserCredits =
    Math.ceil(
      tasks
        .filter((task) => /^https?:\/\//i.test(task.target))
        .reduce((total, task) => total + task.progress, 0) * 0.58,
    ) +
    artifacts
      .filter((artifact) => artifact.type === "证据")
      .reduce(
        (total, artifact) => total + Math.ceil(artifact.sizeKb * 0.4),
        0,
      );
  const connectorCredits =
    connectedConnectorCount * 18 +
    approvals.length * 6 +
    activityLog.filter((item) => item.kind === "审批").length * 4;
  const storageCredits = Math.ceil(
    artifacts.reduce((total, artifact) => total + artifact.sizeKb, 0) * 0.75,
  );
  const usageBreakdown = [
    {
      id: "reasoning",
      label: "AI 分析与推理",
      detail: "页面理解、摘要与报告生成",
      credits: reasoningCredits,
      icon: Brain,
      tone: "blue",
    },
    {
      id: "browser",
      label: "浏览器执行",
      detail: "页面读取、截图与结构提取",
      credits: browserCredits,
      icon: Globe2,
      tone: "green",
    },
    {
      id: "connectors",
      label: "连接器调用",
      detail: "邮件、工作区与审批动作",
      credits: connectorCredits,
      icon: Link2,
      tone: "amber",
    },
    {
      id: "storage",
      label: "成果与证据保存",
      detail: "报告、数据与审计证据",
      credits: storageCredits,
      icon: HardDrive,
      tone: "violet",
    },
  ] as const;
  const usedCredits = usageBreakdown.reduce(
    (total, item) => total + item.credits,
    0,
  );
  const forecastCredits =
    usedCredits +
    tasks.filter((task) => task.status === "运行中").length * 65 +
    tasks.filter((task) => task.schedule !== "仅运行一次").length * 22;
  const usagePercent = Math.min(
    100,
    Math.round((usedCredits / usageSettings.monthlyBudget) * 100),
  );
  const budgetExceeded = usedCredits >= usageSettings.monthlyBudget;
  const budgetAlertReached =
    usagePercent >= usageSettings.alertThreshold || budgetExceeded;
  const usageBudgetDraftValue = Number(usageBudgetDraft);
  const usageBudgetDraftInvalid =
    !Number.isFinite(usageBudgetDraftValue) ||
    usageBudgetDraftValue < 100 ||
    usageBudgetDraftValue > 50000;
  const usageBudgetDirty =
    usageBudgetOpen &&
    (usageBudgetDraft !== String(usageSettings.monthlyBudget) ||
      usageAlertDraft !== usageSettings.alertThreshold ||
      usagePauseDraft !== usageSettings.pauseAtLimit);
  const teamInviteDirty =
    teamInviteOpen &&
    (inviteName.length > 0 || inviteEmail.length > 0 || inviteRole !== "成员");
  const teamMemberRoleDirty = Boolean(
    selectedTeamMember && memberRoleDraft !== selectedTeamMember.role,
  );
  const settingsDraftDirty =
    usageBudgetDirty || teamInviteDirty || teamMemberRoleDirty;
  const activeSettingsDiscardCopy = settingsDiscardTarget
    ? settingsDraftDiscardCopy[settingsDiscardTarget]
    : null;
  const editingArtifact =
    artifacts.find((artifact) => artifact.id === editingArtifactId) ?? null;
  const deletingArtifact =
    artifacts.find((artifact) => artifact.id === artifactDeleteId) ?? null;
  const DeletingArtifactIcon = deletingArtifact
    ? artifactIconMap[deletingArtifact.type]
    : Files;
  const deletingArtifactTask = deletingArtifact
    ? tasks.find((task) => task.id === deletingArtifact.taskId) ?? null
    : null;
  const editingArtifactVersion = editingArtifact?.version ?? 1;
  const artifactRevisionHistory = editingArtifact
    ? [...(editingArtifact.revisions ?? [])].sort(
        (first, second) => second.version - first.version,
      )
    : [];
  const artifactEditorDirty = Boolean(
    editingArtifact &&
      (artifactTitleDraft !== editingArtifact.title ||
        artifactFilenameDraft !== editingArtifact.filename ||
        artifactContentDraft !== editingArtifact.content),
  );
  const artifactDraftSignature = JSON.stringify([
    editingArtifactId,
    artifactTitleDraft,
    artifactFilenameDraft,
    artifactContentDraft,
  ]);
  const artifactDraftIsAutoSaved = Boolean(
    artifactDraftAutoSavedAt &&
      artifactDraftAutoSavedSignature === artifactDraftSignature,
  );
  const artifactDraftSaveFailed =
    artifactDraftSaveFailedSignature === artifactDraftSignature;
  const artifactFormErrors = useMemo<ArtifactFormErrors>(() => {
    const errors: ArtifactFormErrors = {};
    const normalizedTitle = artifactTitleDraft.trim();
    const normalizedFilename = artifactFilenameDraft.trim();
    const normalizedContent = artifactContentDraft.trim();

    if (!normalizedTitle) {
      errors.title = "请输入成果名称";
    } else if (normalizedTitle.length > 100) {
      errors.title = "成果名称不能超过 100 个字";
    }

    if (!normalizedFilename) {
      errors.filename = "请输入文件名";
    } else if (normalizedFilename.length > 120) {
      errors.filename = "文件名不能超过 120 个字符";
    } else if (/[/\\:*?"<>|]/.test(normalizedFilename)) {
      errors.filename = "文件名不能包含 / \\ : * ? \" < > |";
    } else if (!/\.[a-z0-9]{1,10}$/i.test(normalizedFilename)) {
      errors.filename = "请保留文件扩展名，例如 .md";
    }

    if (!normalizedContent) {
      errors.content = "成果内容不能为空";
    } else if (normalizedContent.length < 20) {
      errors.content = "成果内容至少需要 20 个字";
    } else if (artifactContentDraft.length > 100000) {
      errors.content = "成果内容不能超过 100,000 个字符";
    }

    return errors;
  }, [artifactContentDraft, artifactFilenameDraft, artifactTitleDraft]);
  const artifactFormHasErrors = Object.keys(artifactFormErrors).length > 0;
  const deletingTask = tasks.find((task) => task.id === deleteTaskId) ?? null;
  const rejectedApproval =
    approvals.find((item) => item.id === rejectApprovalId) ?? null;
  const activeOverlayKind = settingsDiscardTarget
    ? "settings-discard"
    : taskDiscardOpen
    ? "task-discard"
    : artifactDiscardOpen
      ? "artifact-discard"
    : editingArtifact
      ? "artifact-editor"
      : deletingArtifact
        ? "artifact-delete"
      : usageBudgetOpen
        ? "usage-budget"
    : pendingWorkspaceImport
      ? "import"
    : bulkApprovalDecision
      ? "bulk-approval"
      : bulkDeleteOpen
        ? "bulk-delete"
    : deletingTask
    ? "delete"
    : rejectedApproval
      ? "reject"
      : temporaryModeOpen
        ? "temporary"
        : workspaceResetOpen
          ? "reset"
          : composerOpen
            ? "composer"
            : teamInviteOpen
              ? "team-invite"
              : selectedTeamMember
                ? "team-member"
            : selectedConnector
              ? "connector"
              : inspectedRun
                ? "run"
                : selectedTask
                  ? "task"
                  : null;
  const overlayOpen = activeOverlayKind !== null;
  const primaryTask = tasks.find((task) => task.id === "competitor") ?? initialTasks[0];
  const activityTask = tasks.find((task) => task.id === activityTaskId) ?? null;
  const selectedTaskActivity = selectedTask
    ? activityLog.filter((item) => item.taskId === selectedTask.id).slice(0, 3)
    : [];
  const selectedTaskArtifacts = selectedTask
    ? artifacts.filter((artifact) => artifact.taskId === selectedTask.id).slice(0, 2)
    : [];
  const taskFormErrors = useMemo<TaskFormErrors>(() => {
    const errors: TaskFormErrors = {};
    const normalizedName = taskName.trim();
    const normalizedTarget = taskTarget.trim();
    const normalizedDescription = taskDescription.trim();

    if (!normalizedName) {
      errors.name = "请给任务起一个容易识别的名称";
    } else if (normalizedName.length > 80) {
      errors.name = "任务名称不能超过 80 个字";
    }

    if (!normalizedTarget) {
      errors.target = "请填写网页、文件夹或资料库";
    } else if (normalizedTarget.length < 3) {
      errors.target = "请把数据来源写得更具体一些";
    } else if (normalizedTarget.length > 240) {
      errors.target = "数据来源不能超过 240 个字";
    } else if (/^https?:\/\//i.test(normalizedTarget)) {
      try {
        const parsedTarget = new URL(normalizedTarget);
        if (!parsedTarget.hostname) {
          errors.target = "请填写完整的网址，例如 https://example.com";
        }
      } catch {
        errors.target = "请填写完整的网址，例如 https://example.com";
      }
    }

    if (!normalizedDescription) {
      errors.description = "请描述 AI 最终需要交付什么";
    } else if (normalizedDescription.length < 8) {
      errors.description = "再补充一点结果要求，至少写 8 个字";
    } else if (normalizedDescription.length > 500) {
      errors.description = "结果要求不能超过 500 个字";
    }

    if (taskSchedule !== "仅运行一次" && !taskScheduleTime) {
      errors.scheduleTime = "请选择自动运行时间";
    }

    return errors;
  }, [taskDescription, taskName, taskSchedule, taskScheduleTime, taskTarget]);
  const taskFormHasErrors = Object.keys(taskFormErrors).length > 0;
  const taskComposerDirty = Boolean(
    composerOpen &&
      taskDraftBaseline &&
      (taskName !== taskDraftBaseline.name ||
        taskTarget !== taskDraftBaseline.target ||
        taskDescription !== taskDraftBaseline.description ||
        taskSchedule !== taskDraftBaseline.schedule ||
        taskScheduleTime !== taskDraftBaseline.scheduleTime ||
        taskScheduleDay !== taskDraftBaseline.scheduleDay ||
        taskApproval !== taskDraftBaseline.approval),
  );
  const taskDraftSignature = JSON.stringify([
    editingTaskId,
    taskName,
    taskTarget,
    taskDescription,
    taskSchedule,
    taskScheduleTime,
    taskScheduleDay,
    taskApproval,
  ]);
  const taskDraftIsAutoSaved = Boolean(
    taskDraftAutoSavedAt &&
      taskDraftAutoSavedSignature === taskDraftSignature,
  );
  const taskDraftSaveFailed =
    taskDraftSaveFailedSignature === taskDraftSignature;
  const teamInviteFormErrors = useMemo<TeamInviteFormErrors>(() => {
    const errors: TeamInviteFormErrors = {};
    const normalizedName = inviteName.trim();
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedName) {
      errors.name = "请输入成员姓名";
    } else if (normalizedName.length > 40) {
      errors.name = "成员姓名不能超过 40 个字";
    }
    if (!normalizedEmail) {
      errors.email = "请输入工作邮箱";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      errors.email = "请输入有效的邮箱地址";
    } else if (
      teamMembers.some((member) => member.email.toLowerCase() === normalizedEmail)
    ) {
      errors.email = "这个邮箱已经在当前工作区中";
    }
    return errors;
  }, [inviteEmail, inviteName, teamMembers]);
  const teamInviteFormHasErrors =
    Object.keys(teamInviteFormErrors).length > 0;
  const noticeIsCaution =
    /失败|不能|请先|无效|损坏|已拒绝|离线|无法连接/.test(notice);
  const artifactUndoAvailable = Boolean(
    artifactDeleteSnapshot &&
      notice === `已删除成果“${artifactDeleteSnapshot.artifact.title}”`,
  );
  const taskDeleteUndoAvailable = Boolean(
    taskDeleteSnapshot && notice.startsWith("已删除 "),
  );
  const approvalRejectUndoAvailable = Boolean(
    approvalRejectSnapshot && notice.startsWith("已拒绝"),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDesktopNotificationPermission(
        "Notification" in window
          ? window.Notification.permission
          : "unsupported",
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleOffline() {
      setNotice("设备已离线，本机任务、成果和审计记录仍可查看");
    }

    function handleOnline() {
      setNotice("网络连接已恢复，在线能力可以继续使用");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedDraft = window.sessionStorage.getItem(taskDraftRecoveryKey);
        if (!savedDraft) return;
        const recovery = parseTaskDraftRecovery(JSON.parse(savedDraft));
        if (!recovery) {
          clearDraftRecoveryStorage(taskDraftRecoveryKey);
          return;
        }
        setPendingTaskDraftRecovery(recovery);
      } catch {
        clearDraftRecoveryStorage(taskDraftRecoveryKey);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedDraft = window.sessionStorage.getItem(
          artifactDraftRecoveryKey,
        );
        if (!savedDraft) return;
        const recovery = parseArtifactDraftRecovery(JSON.parse(savedDraft));
        if (!recovery) {
          clearDraftRecoveryStorage(artifactDraftRecoveryKey);
          return;
        }
        setPendingArtifactDraftRecovery(recovery);
      } catch {
        clearDraftRecoveryStorage(artifactDraftRecoveryKey);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!taskComposerDirty && !artifactEditorDirty && !settingsDraftDirty) return;

    function protectUnsavedWork(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", protectUnsavedWork);
    return () => window.removeEventListener("beforeunload", protectUnsavedWork);
  }, [artifactEditorDirty, settingsDraftDirty, taskComposerDirty]);

  useEffect(() => {
    if (!composerOpen || !taskDraftBaseline) return;

    if (!taskComposerDirty) {
      if (taskDraftRecoveryOwnedRef.current) {
        clearDraftRecoveryStorage(taskDraftRecoveryKey);
        taskDraftRecoveryOwnedRef.current = false;
        const resetTimer = window.setTimeout(() => {
          setPendingTaskDraftRecovery(null);
          setTaskDraftAutoSavedAt(null);
          setTaskDraftAutoSavedSignature("");
          setTaskDraftSaveFailedSignature("");
        }, 0);
        return () => window.clearTimeout(resetTimer);
      }
      return;
    }

    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const recovery: TaskDraftRecovery = {
        version: 1,
        savedAt,
        editingTaskId,
        draft: {
          name: taskName,
          target: taskTarget,
          description: taskDescription,
          schedule: taskSchedule,
          scheduleTime: taskScheduleTime,
          scheduleDay: taskScheduleDay,
          approval: taskApproval,
        },
        baseline: taskDraftBaseline,
      };

      try {
        window.sessionStorage.setItem(
          taskDraftRecoveryKey,
          JSON.stringify(recovery),
        );
        taskDraftRecoveryOwnedRef.current = true;
        setPendingTaskDraftRecovery(null);
        setTaskDraftAutoSavedAt(savedAt);
        setTaskDraftAutoSavedSignature(taskDraftSignature);
        setTaskDraftSaveFailedSignature("");
      } catch {
        setTaskDraftSaveFailedSignature(taskDraftSignature);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    composerOpen,
    editingTaskId,
    taskApproval,
    taskComposerDirty,
    taskDescription,
    taskDraftBaseline,
    taskName,
    taskSchedule,
    taskScheduleDay,
    taskScheduleTime,
    taskTarget,
    taskDraftSignature,
  ]);

  useEffect(() => {
    if (!editingArtifact) return;

    if (!artifactEditorDirty) {
      if (artifactDraftRecoveryOwnedRef.current) {
        clearDraftRecoveryStorage(artifactDraftRecoveryKey);
        artifactDraftRecoveryOwnedRef.current = false;
        const resetTimer = window.setTimeout(() => {
          setPendingArtifactDraftRecovery(null);
          setArtifactDraftAutoSavedAt(null);
          setArtifactDraftAutoSavedSignature("");
          setArtifactDraftSaveFailedSignature("");
        }, 0);
        return () => window.clearTimeout(resetTimer);
      }
      return;
    }

    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const recovery: ArtifactDraftRecovery = {
        version: 1,
        savedAt,
        artifactId: editingArtifact.id,
        baseVersion: editingArtifactVersion,
        draft: {
          title: artifactTitleDraft,
          filename: artifactFilenameDraft,
          content: artifactContentDraft,
        },
      };

      try {
        window.sessionStorage.setItem(
          artifactDraftRecoveryKey,
          JSON.stringify(recovery),
        );
        artifactDraftRecoveryOwnedRef.current = true;
        setPendingArtifactDraftRecovery(null);
        setArtifactDraftAutoSavedAt(savedAt);
        setArtifactDraftAutoSavedSignature(artifactDraftSignature);
        setArtifactDraftSaveFailedSignature("");
      } catch {
        setArtifactDraftSaveFailedSignature(artifactDraftSignature);
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [
    artifactContentDraft,
    artifactDraftSignature,
    artifactEditorDirty,
    artifactFilenameDraft,
    artifactTitleDraft,
    editingArtifact,
    editingArtifactVersion,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("unzoo-one-tasks");
        const savedSettings = window.localStorage.getItem("unzoo-one-settings");
        const savedUsage = window.localStorage.getItem("unzoo-one-usage");
        const savedConnectors = window.localStorage.getItem(
          "unzoo-one-connectors",
        );
        const savedTeam = window.localStorage.getItem("unzoo-one-team");
        const savedApprovalIds = window.localStorage.getItem(
          "unzoo-one-pending-approvals",
        );
        const savedActivity = window.localStorage.getItem("unzoo-one-activity");
        const savedArtifacts = window.localStorage.getItem("unzoo-one-artifacts");
        const savedRecentSearches = window.localStorage.getItem(
          "unzoo-one-recent-searches",
        );
        const savedReadNotifications = window.localStorage.getItem(
          "unzoo-one-read-notifications",
        );
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
                runs: Array.isArray(task.runs)
                  ? task.runs.filter(isTaskRun).slice(0, 12)
                  : [],
                retryCount:
                  typeof task.retryCount === "number" ? task.retryCount : 0,
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
        if (savedUsage) {
          const parsedUsage = JSON.parse(savedUsage);
          if (isUsageSettings(parsedUsage)) {
            setUsageSettings(parsedUsage);
          } else {
            window.localStorage.removeItem("unzoo-one-usage");
          }
        }
        if (savedConnectors) {
          const parsedConnectors = JSON.parse(savedConnectors);
          if (isConnectorState(parsedConnectors)) {
            setConnectorStates(parsedConnectors);
          } else {
            window.localStorage.removeItem("unzoo-one-connectors");
          }
        }
        if (savedTeam) {
          const parsedTeam = JSON.parse(savedTeam);
          if (
            Array.isArray(parsedTeam) &&
            parsedTeam.length > 0 &&
            parsedTeam.every(isTeamMember)
          ) {
            setTeamMembers(parsedTeam);
          } else {
            window.localStorage.removeItem("unzoo-one-team");
          }
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
        if (savedArtifacts) {
          const parsedArtifacts = JSON.parse(savedArtifacts);
          if (Array.isArray(parsedArtifacts)) {
            const validArtifacts = parsedArtifacts
              .filter(isArtifactItem)
              .slice(0, 100);
            setArtifacts(validArtifacts);
            setSelectedArtifactId(validArtifacts[0]?.id ?? "");
          }
        }
        if (savedRecentSearches) {
          const parsedRecentSearches = JSON.parse(savedRecentSearches);
          if (
            Array.isArray(parsedRecentSearches) &&
            parsedRecentSearches.every((key) => typeof key === "string")
          ) {
            setRecentSearchKeys(parsedRecentSearches.slice(0, 4));
          }
        }
        if (savedReadNotifications) {
          const parsedReadNotifications = JSON.parse(savedReadNotifications);
          if (
            Array.isArray(parsedReadNotifications) &&
            parsedReadNotifications.every((id) => typeof id === "string")
          ) {
            setReadNotificationIds(parsedReadNotifications.slice(0, 30));
          }
        }
        window.localStorage.setItem("unzoo-one-schema-version", "9");
      } catch {
        window.localStorage.removeItem("unzoo-one-tasks");
        window.localStorage.removeItem("unzoo-one-settings");
        window.localStorage.removeItem("unzoo-one-usage");
        window.localStorage.removeItem("unzoo-one-connectors");
        window.localStorage.removeItem("unzoo-one-team");
        window.localStorage.removeItem("unzoo-one-pending-approvals");
        window.localStorage.removeItem("unzoo-one-activity");
        window.localStorage.removeItem("unzoo-one-artifacts");
        window.localStorage.removeItem("unzoo-one-recent-searches");
        window.localStorage.removeItem("unzoo-one-read-notifications");
        setWorkspaceLoadWarning(
          "检测到损坏的本机数据，已使用安全的默认工作区启动。你可以继续使用，或从备份恢复原有内容。",
        );
      } finally {
        setTasksReady(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (
      !tasksReady ||
      desktopNotificationPermission === "checking" ||
      desktopNotificationPermission === "granted" ||
      !settings.notifications
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSettings((current) =>
        current.notifications ? { ...current, notifications: false } : current,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [desktopNotificationPermission, settings.notifications, tasksReady]);

  useEffect(() => {
    if (!tasksReady) return;

    function restoreWorkspaceRoute() {
      const requestedRoute = readWorkspaceRoute();
      const routeTask = requestedRoute.taskId
        ? tasks.find((task) => task.id === requestedRoute.taskId) ?? null
        : null;
      const routeRun =
        routeTask && requestedRoute.runId
          ? (routeTask.runs ?? []).find(
              (run) => run.id === requestedRoute.runId,
            ) ?? null
          : null;
      const resolvedRoute: WorkspaceRoute = {
        view: routeTask ? "tasks" : requestedRoute.view,
        taskId: routeTask?.id ?? null,
        runId: routeRun?.id ?? null,
      };
      const currentHistoryState = window.history.state as
        | WorkspaceHistoryState
        | null;

      setActiveView(resolvedRoute.view);
      setSelectedTaskId(
        resolvedRoute.taskId && !resolvedRoute.runId
          ? resolvedRoute.taskId
          : null,
      );
      setInspectedRunTaskId(
        resolvedRoute.runId ? resolvedRoute.taskId : null,
      );
      setInspectedRunId(resolvedRoute.runId);
      setNotificationsOpen(false);
      setSearchOpen(false);
      writeWorkspaceRoute(
        resolvedRoute,
        "replace",
        Boolean(currentHistoryState?.unzooOne && currentHistoryState.canPop),
      );
    }

    if (!routeReadyRef.current) {
      routeReadyRef.current = true;
      restoreWorkspaceRoute();
    }

    window.addEventListener("popstate", restoreWorkspaceRoute);
    return () => window.removeEventListener("popstate", restoreWorkspaceRoute);
  }, [tasks, tasksReady]);

  useEffect(() => {
    if (!tasksReady) return;
    if (settings.local) {
      window.localStorage.setItem("unzoo-one-tasks", JSON.stringify(tasks));
      window.localStorage.setItem("unzoo-one-settings", JSON.stringify(settings));
      window.localStorage.setItem(
        "unzoo-one-usage",
        JSON.stringify(usageSettings),
      );
      window.localStorage.setItem(
        "unzoo-one-connectors",
        JSON.stringify(connectorStates),
      );
      window.localStorage.setItem("unzoo-one-team", JSON.stringify(teamMembers));
      window.localStorage.setItem(
        "unzoo-one-pending-approvals",
        JSON.stringify(approvals.map((item) => item.id)),
      );
      window.localStorage.setItem(
        "unzoo-one-activity",
        JSON.stringify(activityLog.slice(0, 100)),
      );
      window.localStorage.setItem(
        "unzoo-one-artifacts",
        JSON.stringify(artifacts.slice(0, 100)),
      );
      window.localStorage.setItem(
        "unzoo-one-recent-searches",
        JSON.stringify(recentSearchKeys.slice(0, 4)),
      );
      window.localStorage.setItem(
        "unzoo-one-read-notifications",
        JSON.stringify(readNotificationIds.slice(0, 30)),
      );
    } else {
      window.localStorage.removeItem("unzoo-one-tasks");
      window.localStorage.removeItem("unzoo-one-settings");
      window.localStorage.removeItem("unzoo-one-usage");
      window.localStorage.removeItem("unzoo-one-connectors");
      window.localStorage.removeItem("unzoo-one-team");
      window.localStorage.removeItem("unzoo-one-pending-approvals");
      window.localStorage.removeItem("unzoo-one-activity");
      window.localStorage.removeItem("unzoo-one-artifacts");
      window.localStorage.removeItem("unzoo-one-recent-searches");
      window.localStorage.removeItem("unzoo-one-read-notifications");
    }
  }, [
    activityLog,
    approvals,
    artifacts,
    connectorStates,
    readNotificationIds,
    recentSearchKeys,
    settings,
    tasks,
    tasksReady,
    teamMembers,
    usageSettings,
  ]);

  useEffect(() => {
    if (!notice) return;
    const timeout =
      notice.startsWith("已删除") || notice.startsWith("已拒绝") ? 10000 : 4200;
    const timer = window.setTimeout(() => {
      setNotice("");
      setTaskDeleteSnapshot(null);
      setArtifactDeleteSnapshot(null);
      setApprovalRejectSnapshot(null);
    }, timeout);
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
      if (
        notificationWrapRef.current &&
        !notificationWrapRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
      if (
        workspaceMenuWrapRef.current &&
        !workspaceMenuWrapRef.current.contains(event.target as Node)
      ) {
        setWorkspaceMenuOpen(false);
      }
    }

    function handleSearchShortcut(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !composerOpen &&
        !usageBudgetOpen &&
        !bulkApprovalDecision &&
        !bulkDeleteOpen &&
        !teamInviteOpen &&
        !selectedTeamMember &&
        !selectedConnector &&
        !deletingArtifact &&
        !inspectedRun &&
        !selectedTask &&
        !deletingTask &&
        !rejectedApproval &&
        !temporaryModeOpen &&
        !workspaceResetOpen &&
        !pendingWorkspaceImport
      ) {
        event.preventDefault();
        setNotificationsOpen(false);
        setWorkspaceMenuOpen(false);
        setSearchOpen(true);
        window.requestAnimationFrame(() => searchInputRef.current?.focus());
      }

      if (event.key === "Escape" && searchOpen) {
        event.preventDefault();
        setSearchOpen(false);
        searchInputRef.current?.blur();
      } else if (event.key === "Escape" && notificationsOpen) {
        event.preventDefault();
        closeNotifications();
      } else if (event.key === "Escape" && workspaceMenuOpen) {
        event.preventDefault();
        closeWorkspaceMenu();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleSearchShortcut);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleSearchShortcut);
    };
  }, [
    bulkApprovalDecision,
    composerOpen,
    bulkDeleteOpen,
    deletingArtifact,
    deletingTask,
    rejectedApproval,
    notificationsOpen,
    pendingWorkspaceImport,
    searchOpen,
    inspectedRun,
    selectedConnector,
    selectedTeamMember,
    selectedTask,
    teamInviteOpen,
    temporaryModeOpen,
    usageBudgetOpen,
    workspaceMenuOpen,
    workspaceResetOpen,
  ]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const panel = notificationPanelRef.current;
    if (!panel) return;

    const isMobileSheet = window.matchMedia("(max-width: 680px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (isMobileSheet) {
      document.body.style.overflow = "hidden";
    }

    function keepFocusInNotificationPanel(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    panel.addEventListener("keydown", keepFocusInNotificationPanel);
    return () => {
      panel.removeEventListener("keydown", keepFocusInNotificationPanel);
      if (isMobileSheet) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!workspaceMenuOpen) return;

    const panel = workspaceMenuPanelRef.current;
    if (!panel) return;

    const isMobileSheet = window.matchMedia("(max-width: 680px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (isMobileSheet) {
      document.body.style.overflow = "hidden";
    }

    function keepFocusInWorkspaceMenu(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    panel.addEventListener("keydown", keepFocusInWorkspaceMenu);
    return () => {
      panel.removeEventListener("keydown", keepFocusInWorkspaceMenu);
      if (isMobileSheet) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [workspaceMenuOpen]);

  useEffect(() => {
    if (!overlayOpen) return;

    if (
      !overlayTriggerRef.current &&
      document.activeElement instanceof HTMLElement
    ) {
      overlayTriggerRef.current = document.activeElement;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      const trigger = overlayTriggerRef.current;
      overlayTriggerRef.current = null;
      if (trigger?.isConnected) {
        window.requestAnimationFrame(() => trigger.focus());
      }
    };
  }, [overlayOpen]);

  useEffect(() => {
    if (!activeOverlayKind) return;

    const selectorByKind = {
      "settings-discard": ".settings-discard-dialog",
      "task-discard": ".task-discard-dialog",
      "artifact-discard": ".artifact-discard-dialog",
      "artifact-editor": ".artifact-editor-dialog",
      "artifact-delete": ".artifact-delete-dialog",
      "usage-budget": ".usage-budget-dialog",
      import: ".workspace-import-dialog",
      "bulk-approval": ".bulk-approval-dialog",
      "bulk-delete": ".bulk-delete-dialog",
      delete: ".confirm-delete-dialog",
      reject: ".approval-reject-dialog",
      temporary: ".temporary-session-dialog",
      reset: ".workspace-reset-dialog",
      composer: ".clarity-dialog",
      "team-invite": ".team-invite-dialog",
      "team-member": ".team-member-dialog",
      connector: ".connector-detail-dialog",
      run: ".run-detail-dialog",
      task: ".task-detail-drawer",
    } as const;
    const overlay = document.querySelector<HTMLElement>(
      selectorByKind[activeOverlayKind],
    );
    if (!overlay) return;

    const focusFrame = window.requestAnimationFrame(() => {
      const initialFocus =
        overlay.querySelector<HTMLElement>("[data-overlay-initial-focus]") ??
        overlay.querySelector<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
        );
      if (!overlay.contains(document.activeElement)) {
        initialFocus?.focus();
      }
    });

    function closeTopOverlay() {
      if (activeOverlayKind === "settings-discard") {
        setSettingsDiscardTarget(null);
      } else if (activeOverlayKind === "task-discard") {
        setTaskDiscardOpen(false);
      } else if (activeOverlayKind === "artifact-discard") {
        setArtifactDiscardOpen(false);
      } else if (activeOverlayKind === "artifact-editor") {
        if (artifactSavingRef.current || isSavingArtifact) return;
        if (artifactEditorDirty) {
          setArtifactDiscardOpen(true);
        } else {
          if (artifactDraftRecoveryOwnedRef.current) {
            clearDraftRecoveryStorage(artifactDraftRecoveryKey);
            artifactDraftRecoveryOwnedRef.current = false;
            setPendingArtifactDraftRecovery(null);
            setArtifactDraftAutoSavedAt(null);
            setArtifactDraftAutoSavedSignature("");
            setArtifactDraftSaveFailedSignature("");
          }
          setEditingArtifactId(null);
          setArtifactTitleDraft("");
          setArtifactFilenameDraft("");
          setArtifactContentDraft("");
          setArtifactEditSubmitted(false);
        }
      } else if (activeOverlayKind === "artifact-delete") {
        setArtifactDeleteId(null);
      } else if (activeOverlayKind === "usage-budget") {
        if (usageBudgetDirty) {
          setSettingsDiscardTarget("budget");
        } else {
          setUsageBudgetOpen(false);
        }
      } else if (activeOverlayKind === "import") {
        setPendingWorkspaceImport(null);
      } else if (activeOverlayKind === "bulk-approval") {
        setBulkApprovalDecision(null);
        setApprovalRejectReason("");
      } else if (activeOverlayKind === "bulk-delete") {
        setBulkDeleteOpen(false);
      } else if (activeOverlayKind === "delete") {
        setDeleteTaskId(null);
      } else if (activeOverlayKind === "reject") {
        setRejectApprovalId(null);
        setApprovalRejectReason("");
      } else if (activeOverlayKind === "temporary") {
        setTemporaryModeOpen(false);
      } else if (activeOverlayKind === "reset") {
        setWorkspaceResetOpen(false);
      } else if (activeOverlayKind === "composer") {
        if (taskSavingRef.current || isSavingTask) return;
        if (taskComposerDirty) {
          setTaskDiscardOpen(true);
        } else {
          if (taskDraftRecoveryOwnedRef.current) {
            clearDraftRecoveryStorage(taskDraftRecoveryKey);
            taskDraftRecoveryOwnedRef.current = false;
            setPendingTaskDraftRecovery(null);
            setTaskDraftAutoSavedAt(null);
            setTaskDraftAutoSavedSignature("");
            setTaskDraftSaveFailedSignature("");
          }
          setComposerOpen(false);
          setEditingTaskId(null);
          setTaskDraftBaseline(null);
          setTaskFormSubmitted(false);
        }
      } else if (activeOverlayKind === "team-invite") {
        if (inviteSavingRef.current) return;
        if (teamInviteDirty) {
          setSettingsDiscardTarget("invite");
        } else {
          setTeamInviteOpen(false);
          setInviteFormSubmitted(false);
        }
      } else if (activeOverlayKind === "team-member") {
        if (teamMemberRoleDirty) {
          setSettingsDiscardTarget("member");
        } else {
          setSelectedTeamMemberId(null);
          setMemberRemoveConfirm(false);
        }
      } else if (activeOverlayKind === "connector") {
        setSelectedConnectorId(null);
        setConnectorDisconnectConfirm(false);
      } else if (activeOverlayKind === "run") {
        if (canReturnToWorkspaceParent()) {
          window.history.back();
        } else {
          setInspectedRunTaskId(null);
          setInspectedRunId(null);
          if (inspectedRunTaskId) {
            setActiveView("tasks");
            setSelectedTaskId(inspectedRunTaskId);
            writeWorkspaceRoute(
              {
                view: "tasks",
                taskId: inspectedRunTaskId,
                runId: null,
              },
              "replace",
            );
          }
        }
      } else {
        if (canReturnToWorkspaceParent()) {
          window.history.back();
        } else {
          setSelectedTaskId(null);
          writeWorkspaceRoute(
            { view: activeView, taskId: null, runId: null },
            "replace",
          );
        }
      }
    }

    function handleOverlayKeyDown(event: KeyboardEvent) {
      if (
        activeOverlayKind === "artifact-editor" &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        event.stopPropagation();
        overlay
          .querySelector<HTMLButtonElement>('button[type="submit"]')
          ?.click();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeTopOverlay();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        overlay.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          element.offsetWidth > 0 ||
          element.offsetHeight > 0 ||
          element === document.activeElement,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (
        event.shiftKey &&
        (activeElement === first || !overlay.contains(activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === last || !overlay.contains(activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleOverlayKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleOverlayKeyDown, true);
    };
  }, [
    activeOverlayKind,
    activeView,
    artifactEditorDirty,
    inspectedRunTaskId,
    isSavingArtifact,
    isSavingTask,
    taskComposerDirty,
    teamInviteDirty,
    teamMemberRoleDirty,
    usageBudgetDirty,
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

  const artifactScopeTask =
    tasks.find((task) => task.id === artifactTaskId) ?? null;
  const scopedArtifacts = useMemo(
    () =>
      artifactTaskId
        ? artifacts.filter((artifact) => artifact.taskId === artifactTaskId)
        : artifacts,
    [artifactTaskId, artifacts],
  );
  const filteredArtifacts = useMemo(() => {
    const keyword = artifactListQuery.trim().toLowerCase();
    const filteredByType =
      artifactFilter === "全部"
        ? scopedArtifacts
        : artifactFilter === "重点"
          ? scopedArtifacts.filter((artifact) => artifact.starred)
          : scopedArtifacts.filter((artifact) => artifact.type === artifactFilter);
    const searched = keyword
      ? filteredByType.filter((artifact) => {
          const taskTitle =
            tasks.find((task) => task.id === artifact.taskId)?.title ?? "";
          return `${artifact.title} ${artifact.filename} ${artifact.description} ${artifact.format} ${artifact.type} ${taskTitle}`
            .toLowerCase()
            .includes(keyword);
        })
      : filteredByType;

    return [...searched].sort((first, second) => {
      const recent =
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      if (artifactSort === "重点优先") {
        return Number(second.starred) - Number(first.starred) || recent;
      }
      if (artifactSort === "文件名") {
        return (
          first.filename.localeCompare(second.filename, "zh-CN", {
            numeric: true,
            sensitivity: "base",
          }) || recent
        );
      }
      return recent;
    });
  }, [artifactFilter, artifactListQuery, artifactSort, scopedArtifacts, tasks]);
  const selectedArtifact =
    filteredArtifacts.find((artifact) => artifact.id === selectedArtifactId) ??
    filteredArtifacts[0] ??
    null;
  const SelectedArtifactIcon = selectedArtifact
    ? artifactIconMap[selectedArtifact.type]
    : Files;
  const artifactStats = useMemo(
    () => ({
      total: scopedArtifacts.length,
      reports: scopedArtifacts.filter((artifact) => artifact.type === "报告").length,
      evidence: scopedArtifacts.reduce(
        (sum, artifact) => sum + (artifact.evidenceCount ?? 0),
        0,
      ),
      size: scopedArtifacts.reduce((sum, artifact) => sum + artifact.sizeKb, 0),
    }),
    [scopedArtifacts],
  );

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
    const artifactResults: SearchResult[] = artifacts.map((artifact) => ({
      key: `artifact-${artifact.id}`,
      kind: "artifact",
      id: artifact.id,
      title: artifact.title,
      description: `${artifact.filename} · ${artifact.description}`,
      meta: artifact.type,
      icon: artifactIconMap[artifact.type],
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
      {
        key: "action-artifacts",
        kind: "action",
        id: "artifacts",
        title: "查看最新成果",
        description: `${artifacts.length} 个报告、数据或证据包可以查看。`,
        meta: `${artifacts.length} 项`,
        icon: Files,
      },
    ];
    const searchCatalog = [
      ...taskResults,
      ...artifactResults,
      ...viewResults,
      ...actionResults,
    ];

    if (!keyword) {
      const recentResults = recentSearchKeys
        .map((key) => searchCatalog.find((result) => result.key === key))
        .filter((result): result is SearchResult => Boolean(result));
      const recentResultKeys = new Set(
        recentResults.map((result) => result.key),
      );
      return [
        ...recentResults,
        ...actionResults.filter((result) => !recentResultKeys.has(result.key)),
        ...taskResults
          .filter((result) => !recentResultKeys.has(result.key))
          .slice(0, 2),
        ...artifactResults
          .filter((result) => !recentResultKeys.has(result.key))
          .slice(0, 1),
      ].slice(0, 9);
    }

    return searchCatalog
      .filter((result) =>
        `${result.title} ${result.description} ${result.meta}`
          .toLowerCase()
          .includes(keyword),
      )
      .slice(0, 8);
  }, [approvals.length, artifacts, query, recentSearchKeys, tasks]);

  const searchResultSections = useMemo<SearchResultSection[]>(() => {
    if (!query.trim()) {
      const recentKeySet = new Set(recentSearchKeys);
      const recentResults = searchResults.filter((result) =>
        recentKeySet.has(result.key),
      );
      const otherResults = searchResults.filter(
        (result) => !recentKeySet.has(result.key),
      );
      return [
        {
          id: "recent",
          label: "最近访问",
          results: recentResults,
          canClear: true,
        },
        {
          id: "actions",
          label: "快捷操作",
          results: otherResults.filter((result) => result.kind === "action"),
        },
        {
          id: "suggested",
          label: "继续工作",
          results: otherResults.filter((result) => result.kind !== "action"),
        },
      ].filter((section) => section.results.length > 0);
    }

    const sectionLabels: Record<SearchResultKind, string> = {
      task: "任务",
      artifact: "成果",
      view: "页面",
      action: "操作",
    };
    return (["task", "artifact", "view", "action"] as SearchResultKind[])
      .map((kind) => ({
        id: kind,
        label: sectionLabels[kind],
        results: searchResults.filter((result) => result.kind === kind),
      }))
      .filter((section) => section.results.length > 0);
  }, [query, recentSearchKeys, searchResults]);

  const taskFilterCounts = useMemo<Record<TaskFilter, number>>(
    () => ({
      全部: tasks.length,
      运行中: tasks.filter((task) => task.status === "运行中").length,
      待确认: tasks.filter((task) => task.status === "待确认").length,
      失败: tasks.filter((task) => task.status === "失败").length,
      已完成: tasks.filter((task) => task.status === "已完成").length,
      已暂停: tasks.filter((task) => task.status === "已暂停").length,
    }),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    const keyword = taskListQuery.trim().toLowerCase();
    const statusPriority: Record<TaskStatus, number> = {
      失败: 0,
      待确认: 1,
      运行中: 2,
      已暂停: 3,
      已完成: 4,
    };
    const matchingTasks = tasks.filter((task) => {
      if (taskFilter !== "全部" && task.status !== taskFilter) return false;
      if (!keyword) return true;
      return `${task.title} ${task.description} ${task.target} ${task.status} ${formatTaskSchedule(task)}`
        .toLowerCase()
        .includes(keyword);
    });

    return [...matchingTasks].sort((first, second) => {
      if (taskSort === "进度最高") return second.progress - first.progress;
      if (taskSort === "名称") {
        return first.title.localeCompare(second.title, "zh-CN");
      }
      return statusPriority[first.status] - statusPriority[second.status];
    });
  }, [taskFilter, taskListQuery, taskSort, tasks]);
  const selectedTasks = tasks.filter((task) =>
    selectedTaskIds.includes(task.id),
  );
  const selectedVisibleTaskCount = filteredTasks.filter((task) =>
    selectedTaskIds.includes(task.id),
  ).length;
  const allVisibleTasksSelected =
    filteredTasks.length > 0 &&
    selectedVisibleTaskCount === filteredTasks.length;
  const deletableSelectedTasks = selectedTasks.filter((task) => !task.pinned);
  const protectedSelectedTaskCount =
    selectedTasks.length - deletableSelectedTasks.length;
  const pausableSelectedTaskCount = selectedTasks.filter(
    (task) => task.status === "运行中" || task.status === "待确认",
  ).length;
  const resumableSelectedTaskCount = selectedTasks.filter(
    (task) =>
      task.status === "已暂停" ||
      task.status === "已完成" ||
      task.status === "失败",
  ).length;
  const unprotectedSelectedTaskCount = selectedTasks.filter(
    (task) => !(task.requiresApproval ?? true),
  ).length;

  const scopedActivityLog = useMemo(
    () =>
      activityTaskId
        ? activityLog.filter((item) => item.taskId === activityTaskId)
        : activityLog,
    [activityLog, activityTaskId],
  );

  const filteredActivityLog = useMemo(() => {
    const keyword = activityListQuery.trim().toLowerCase();
    const matchingItems = scopedActivityLog.filter((item) => {
      if (activityFilter !== "全部" && item.kind !== activityFilter) return false;
      if (!keyword) return true;
      const taskTitle =
        tasks.find((task) => task.id === item.taskId)?.title ?? "";
      return `${item.title} ${item.detail} ${item.kind} ${item.id} ${taskTitle}`
        .toLowerCase()
        .includes(keyword);
    });

    return [...matchingItems].sort((first, second) => {
      const delta =
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      return activitySort === "最新优先" ? delta : -delta;
    });
  }, [
    activityFilter,
    activityListQuery,
    activitySort,
    scopedActivityLog,
    tasks,
  ]);

  const selectedActivity =
    filteredActivityLog.find((item) => item.id === selectedActivityId) ??
    filteredActivityLog[0] ??
    null;
  const SelectedActivityIcon = selectedActivity
    ? activityIconMap[selectedActivity.icon] ?? Activity
    : Activity;
  const selectedActivityTask = selectedActivity?.taskId
    ? tasks.find((task) => task.id === selectedActivity.taskId) ?? null
    : null;

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
  const protectedTaskCount = tasks.filter(
    (task) => task.requiresApproval !== false,
  ).length;
  const settingsAuditItems = activityLog
    .filter((item) => item.kind === "审批" || item.kind === "系统")
    .slice(0, 3);
  const workspaceDataSize = useMemo(() => {
    const serialized = JSON.stringify({
      tasks,
      settings,
      usage: usageSettings,
      approvalIds: approvals.map((item) => item.id),
      activity: activityLog,
      artifacts,
    });
    return Math.max(1, Math.ceil(serialized.length / 1024));
  }, [activityLog, approvals, artifacts, settings, tasks, usageSettings]);
  const latestActivity = activityLog[0] ?? initialActivityItems[0];
  const latestArtifact = artifacts[0] ?? null;
  const notificationItems = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    const failedTasks = tasks.filter((task) => task.status === "失败");
    failedTasks.slice(0, 2).forEach((task) => {
      items.push({
        id: `task-failed-${task.id}-${task.retryCount ?? 0}`,
        title: `任务需要恢复：${task.title}`,
        detail: task.lastError ?? "任务已安全停止，等待检查后重新运行。",
        meta: task.updated,
        target: "task",
        targetId: task.id,
        icon: AlertTriangle,
        tone: "red",
      });
    });
    if (approvals.length > 0) {
      items.push({
        id: `approvals-${approvals.map((item) => item.id).join("-")}`,
        title: `${approvals.length} 项操作等你确认`,
        detail: "涉及外部访问或发送，任务已在执行前暂停。",
        meta: "需要处理",
        target: "approvals",
        icon: ShieldCheck,
        tone: "amber",
      });
    }
    items.push({
      id: `activity-${latestActivity.id}`,
      title: latestActivity.title,
      detail: latestActivity.detail,
      meta: latestActivity.time,
      target: "activity",
      targetId: latestActivity.id,
      icon: activityIconMap[latestActivity.icon] ?? Activity,
      tone: "blue",
    });
    if (latestArtifact) {
      items.push({
        id: `artifact-${latestArtifact.id}`,
        title: `成果已保存：${latestArtifact.title}`,
        detail: `${latestArtifact.filename} · ${latestArtifact.sizeKb.toFixed(1)} KB`,
        meta: latestArtifact.updated,
        target: "artifact",
        targetId: latestArtifact.id,
        icon: artifactIconMap[latestArtifact.type],
        tone: "green",
      });
    }
    return items;
  }, [approvals, latestActivity, latestArtifact, tasks]);
  const unreadNotificationCount = notificationItems.filter(
    (item) => !readNotificationIds.includes(item.id),
  ).length;
  const visibleNotificationItems =
    notificationFilter === "未读"
      ? notificationItems.filter(
          (item) => !readNotificationIds.includes(item.id),
        )
      : notificationItems;
  const desktopNotificationPreferenceDetail =
    desktopNotificationPermission === "checking"
      ? "正在检查浏览器通知权限。"
      : desktopNotificationPermission === "unsupported"
        ? "当前浏览器不支持桌面通知，页面内通知仍会保留。"
        : desktopNotificationPermission === "denied"
          ? "浏览器已阻止桌面通知，页面内通知仍会保留。"
          : settings.notifications
            ? "浏览器授权已通过，需要确认时会发送桌面提醒。"
            : desktopNotificationPermission === "granted"
              ? "浏览器权限可用，当前未开启主动提醒。"
              : "开启后浏览器会请求一次桌面通知权限。";
  const desktopNotificationSummary =
    desktopNotificationPermission === "checking"
      ? "正在检查浏览器通知权限"
      : desktopNotificationPermission === "unsupported"
        ? "当前浏览器不支持桌面提醒"
        : desktopNotificationPermission === "denied"
          ? "浏览器已阻止桌面提醒"
          : settings.notifications
            ? "任务暂停时发送桌面提醒"
            : "当前不会主动发送桌面提醒";
  const desktopNotificationStateLabel =
    desktopNotificationPermission === "checking"
      ? "检查中"
      : desktopNotificationPermission === "unsupported"
        ? "不支持"
        : desktopNotificationPermission === "denied"
          ? "需授权"
          : settings.notifications
            ? "已开启"
            : "已关闭";
  const desktopNotificationStateClass = settings.notifications
    ? "is-safe"
    : desktopNotificationPermission === "denied"
      ? "is-caution"
      : "is-neutral";
  const desktopNotificationActionLabel = settings.notifications
    ? "关闭提醒"
    : desktopNotificationPermission === "denied"
      ? "检查权限"
      : desktopNotificationPermission === "unsupported"
        ? "查看状态"
        : "开启提醒";

  useEffect(() => {
    const actionableItems = notificationItems.filter(
      (item) => item.target === "task" || item.target === "approvals",
    );
    const currentIds = new Set(actionableItems.map((item) => item.id));

    if (!desktopNotificationTrackingReadyRef.current) {
      desktopNotificationTrackingReadyRef.current = true;
      desktopNotificationIdsRef.current = currentIds;
      return;
    }

    const newItem = actionableItems.find(
      (item) => !desktopNotificationIdsRef.current.has(item.id),
    );
    desktopNotificationIdsRef.current = currentIds;
    if (
      !newItem ||
      !tasksReady ||
      !settings.notifications ||
      desktopNotificationPermission !== "granted" ||
      !("Notification" in window)
    ) {
      return;
    }

    try {
      const desktopNotification = new window.Notification(newItem.title, {
        body: newItem.detail,
        icon: "/unzoo-one-mark.svg",
        tag: `unzoo-one-${newItem.id}`,
      });
      desktopNotification.onclick = () => {
        window.focus();
        desktopNotification.close();
      };
    } catch {
      window.setTimeout(
        () =>
          setDesktopNotificationPermission(window.Notification.permission),
        0,
      );
    }
  }, [
    desktopNotificationPermission,
    notificationItems,
    settings.notifications,
    tasksReady,
  ]);

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

  function exportActivityItem(item: ActivityItem) {
    const payload = {
      product: "Unzoo One",
      exportedAt: new Date().toISOString(),
      record: item,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unzoo-event-${item.id}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    setNotice(`已导出事件“${item.title}”`);
  }

  async function copyActivityId(item: ActivityItem) {
    try {
      await window.navigator.clipboard.writeText(item.id);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = item.id;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setNotice(`已复制事件 ID：${item.id}`);
  }

  function exportWorkspace() {
    const payload: WorkspaceBackup = {
      version: 1,
      product: "Unzoo One",
      exportedAt: new Date().toISOString(),
      tasks,
      settings,
      usage: usageSettings,
      connectors: connectorStates,
      members: teamMembers,
      approvalIds: approvals.map((item) => item.id),
      activity: activityLog,
      artifacts,
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
      detail: `已备份 ${tasks.length} 个任务、${artifacts.length} 个成果、${teamMembers.length} 位成员和 ${activityLog.length} 条运行记录。`,
      icon: "activity",
      tone: "blue",
      kind: "系统",
    });
    setNotice("工作区备份已保存到本机");
  }

  function downloadArtifact(artifact: ArtifactItem) {
    const mimeType =
      artifact.format === "JSON"
        ? "application/json"
        : artifact.format === "CSV"
          ? "text/csv"
          : "text/markdown";
    const blob = new Blob([artifact.content], {
      type: `${mimeType};charset=utf-8`,
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = artifact.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    recordActivity({
      title: `成果已下载：${artifact.title}`,
      detail: `${artifact.filename} · ${artifact.sizeKb.toFixed(1)} KB`,
      icon: "file",
      tone: "blue",
      kind: "系统",
      taskId: artifact.taskId,
    });
    setNotice(`已下载“${artifact.filename}”`);
  }

  async function copyArtifactContent(artifact: ArtifactItem) {
    try {
      await window.navigator.clipboard.writeText(artifact.content);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = artifact.content;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    recordActivity({
      title: `成果内容已复制：${artifact.title}`,
      detail: `已复制 ${artifact.filename} 的可读内容。`,
      icon: "copy",
      tone: "violet",
      kind: "系统",
      taskId: artifact.taskId,
    });
    setNotice(`已复制“${artifact.title}”的内容`);
  }

  function toggleArtifactStar(artifact: ArtifactItem) {
    const nextStarred = !artifact.starred;
    setArtifacts((items) =>
      items.map((item) =>
        item.id === artifact.id ? { ...item, starred: nextStarred } : item,
      ),
    );
    setNotice(nextStarred ? "已加入重点成果" : "已取消重点标记");
  }

  function requestDeleteArtifact(artifact: ArtifactItem) {
    setArtifactDeleteId(artifact.id);
  }

  function confirmDeleteArtifact() {
    if (!deletingArtifact) return;
    const artifact = deletingArtifact;
    const artifactIndex = artifacts.findIndex((item) => item.id === artifact.id);
    const nextVisibleArtifact = filteredArtifacts.find(
      (item) => item.id !== artifact.id,
    );
    const nextWorkspaceArtifact = artifacts.find(
      (item) => item.id !== artifact.id,
    );

    setTaskDeleteSnapshot(null);
    setArtifactDeleteSnapshot({
      artifact,
      index: Math.max(0, artifactIndex),
    });
    setArtifacts((items) => items.filter((item) => item.id !== artifact.id));
    setSelectedArtifactId(
      nextVisibleArtifact?.id ?? nextWorkspaceArtifact?.id ?? "",
    );
    setArtifactDeleteId(null);
    recordActivity({
      title: `成果已删除：${artifact.title}`,
      detail: `${artifact.filename} 及其 ${
        (artifact.revisions?.length ?? 0) + 1
      } 个版本已从工作区移除；关联任务和原审计记录保持不变。`,
      icon: "trash",
      tone: "red",
      kind: "系统",
      taskId: artifact.taskId,
    });
    setNotice(`已删除成果“${artifact.title}”`);
  }

  function undoArtifactDelete() {
    if (!artifactDeleteSnapshot) return;
    const { artifact, index } = artifactDeleteSnapshot;
    setArtifacts((items) => {
      if (items.some((item) => item.id === artifact.id)) return items;
      const restored = [...items];
      restored.splice(Math.min(index, restored.length), 0, artifact);
      return restored;
    });
    setSelectedArtifactId(artifact.id);
    setArtifactDeleteSnapshot(null);
    recordActivity({
      title: `已撤销成果删除：${artifact.title}`,
      detail: `${artifact.filename} 和全部修订版本已恢复到原位置。`,
      icon: "activity",
      tone: "green",
      kind: "系统",
      taskId: artifact.taskId,
    });
    setNotice(`已恢复成果“${artifact.title}”`);
  }

  function artifactCanBeEdited(artifact: ArtifactItem) {
    return artifact.type === "报告" || artifact.type === "草稿";
  }

  function openArtifactEditor(artifact: ArtifactItem) {
    if (!artifactCanBeEdited(artifact)) {
      setNotice("数据和证据保持只读，避免破坏原始交付记录");
      return;
    }
    setEditingArtifactId(artifact.id);
    setArtifactTitleDraft(artifact.title);
    setArtifactFilenameDraft(artifact.filename);
    setArtifactContentDraft(artifact.content);
    artifactDraftRecoveryOwnedRef.current = false;
    setArtifactDraftAutoSavedAt(null);
    setArtifactDraftAutoSavedSignature("");
    setArtifactDraftSaveFailedSignature("");
    setArtifactEditSubmitted(false);
    setArtifactDiscardOpen(false);
    setIsSavingArtifact(false);
  }

  function clearArtifactDraftRecovery() {
    clearDraftRecoveryStorage(artifactDraftRecoveryKey);
    artifactDraftRecoveryOwnedRef.current = false;
    setPendingArtifactDraftRecovery(null);
    setArtifactDraftAutoSavedAt(null);
    setArtifactDraftAutoSavedSignature("");
    setArtifactDraftSaveFailedSignature("");
  }

  function closeArtifactEditor(options: { clearRecovery?: boolean } = {}) {
    if (options.clearRecovery || artifactDraftRecoveryOwnedRef.current) {
      clearArtifactDraftRecovery();
    }
    artifactSavingRef.current = false;
    setEditingArtifactId(null);
    setArtifactTitleDraft("");
    setArtifactFilenameDraft("");
    setArtifactContentDraft("");
    setArtifactEditSubmitted(false);
    setArtifactDiscardOpen(false);
    setIsSavingArtifact(false);
  }

  function requestCloseArtifactEditor() {
    if (artifactSavingRef.current || isSavingArtifact) return;
    if (artifactEditorDirty) {
      setArtifactDiscardOpen(true);
      return;
    }
    closeArtifactEditor();
  }

  function confirmDiscardArtifactDraft() {
    closeArtifactEditor();
    setNotice("未保存的成果修订已放弃");
  }

  function restoreRecoveredArtifactDraft() {
    if (!pendingArtifactDraftRecovery || !tasksReady) return;
    const recovery = pendingArtifactDraftRecovery;
    const artifact =
      artifacts.find((item) => item.id === recovery.artifactId) ?? null;
    if (!artifact || !artifactCanBeEdited(artifact)) {
      clearArtifactDraftRecovery();
      setNotice("原成果已不存在或不可编辑，恢复草稿已安全移除");
      return;
    }

    const recoveredSignature = JSON.stringify([
      artifact.id,
      recovery.draft.title,
      recovery.draft.filename,
      recovery.draft.content,
    ]);
    setActiveView("artifacts");
    setSelectedArtifactId(artifact.id);
    writeWorkspaceRoute(
      { view: "artifacts", taskId: null, runId: null },
      "push",
    );
    setEditingArtifactId(artifact.id);
    setArtifactTitleDraft(recovery.draft.title);
    setArtifactFilenameDraft(recovery.draft.filename);
    setArtifactContentDraft(recovery.draft.content);
    setArtifactEditSubmitted(false);
    setArtifactDiscardOpen(false);
    setIsSavingArtifact(false);
    artifactDraftRecoveryOwnedRef.current = true;
    setPendingArtifactDraftRecovery(null);
    setArtifactDraftAutoSavedAt(recovery.savedAt);
    setArtifactDraftAutoSavedSignature(recoveredSignature);
    setArtifactDraftSaveFailedSignature("");

    if (recovery.baseVersion !== (artifact.version ?? 1)) {
      setNotice(
        `草稿基于 v${recovery.baseVersion}，当前为 v${artifact.version ?? 1}；保存时会保留两个版本`,
      );
    }
  }

  function discardRecoveredArtifactDraft() {
    clearArtifactDraftRecovery();
    setNotice("未完成的成果修订草稿已放弃");
  }

  function loadArtifactRevision(revision: ArtifactRevision) {
    setArtifactTitleDraft(revision.title);
    setArtifactFilenameDraft(revision.filename);
    setArtifactContentDraft(revision.content);
    setArtifactEditSubmitted(false);
    setNotice(`已将 v${revision.version} 载入编辑器，保存后会生成新版本`);
    window.requestAnimationFrame(() => artifactTitleRef.current?.focus());
  }

  async function saveArtifactEdit() {
    if (
      !editingArtifact ||
      artifactSavingRef.current ||
      isSavingArtifact
    ) {
      return;
    }
    setArtifactEditSubmitted(true);
    if (artifactFormHasErrors) {
      if (artifactFormErrors.title) {
        artifactTitleRef.current?.focus();
      } else if (artifactFormErrors.filename) {
        artifactFilenameRef.current?.focus();
      } else {
        artifactContentRef.current?.focus();
      }
      return;
    }
    if (!artifactEditorDirty) {
      setNotice("当前版本没有需要保存的修改");
      return;
    }

    artifactSavingRef.current = true;
    setIsSavingArtifact(true);
    await new Promise((resolve) => window.setTimeout(resolve, 420));

    const now = new Date();
    const nextVersion = editingArtifactVersion + 1;
    const normalizedTitle = artifactTitleDraft.trim();
    const normalizedFilename = artifactFilenameDraft.trim();
    const normalizedContent = artifactContentDraft.trim();
    const previousRevision: ArtifactRevision = {
      version: editingArtifactVersion,
      title: editingArtifact.title,
      filename: editingArtifact.filename,
      content: editingArtifact.content,
      createdAt: editingArtifact.editedAt ?? editingArtifact.createdAt,
      editor: editingArtifact.editedBy ?? "Unzoo One AI",
    };
    const nextRevisions = [
      ...(editingArtifact.revisions ?? []),
      previousRevision,
    ].slice(-12);
    const nextSizeKb = Math.max(
      0.1,
      new TextEncoder().encode(normalizedContent).byteLength / 1024,
    );

    setArtifacts((items) =>
      items.map((artifact) =>
        artifact.id === editingArtifact.id
          ? {
              ...artifact,
              title: normalizedTitle,
              filename: normalizedFilename,
              content: normalizedContent,
              sizeKb: nextSizeKb,
              status: artifact.type === "报告" ? "已修订" : artifact.status,
              updated: "刚刚",
              editedAt: now.toISOString(),
              editedBy: "刘一帆",
              version: nextVersion,
              revisions: nextRevisions,
            }
          : artifact,
      ),
    );
    recordActivity({
      title: `成果已保存为 v${nextVersion}：${normalizedTitle}`,
      detail: `${normalizedFilename} 已由刘一帆修订；v${editingArtifactVersion} 仍保留在版本记录中。`,
      icon: "file",
      tone: "green",
      kind: "系统",
      taskId: editingArtifact.taskId,
    });
    artifactSavingRef.current = false;
    setIsSavingArtifact(false);
    setNotice(`已保存 v${nextVersion}，上一版本可随时恢复`);
    closeArtifactEditor({ clearRecovery: true });
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
      setPendingWorkspaceImport({
        backup,
        fileName: file.name,
        fileSize: file.size,
      });
    } catch {
      setNotice("导入失败，请选择由 Unzoo One 导出的工作区备份");
    } finally {
      input.value = "";
    }
  }

  function confirmWorkspaceImport() {
    if (!pendingWorkspaceImport) return;
    const { backup, fileName } = pendingWorkspaceImport;
    const restoredApprovals = initialApprovals.filter((item) =>
      backup.approvalIds.includes(item.id),
    );
    const restoredPrimary =
      backup.tasks.find((task) => task.id === "competitor") ?? backup.tasks[0];
    const restoredArtifacts = backup.artifacts ?? initialArtifacts;

    setTasks(backup.tasks);
    setArtifacts(restoredArtifacts);
    closeArtifactEditor({ clearRecovery: true });
    closeComposer({ clearRecovery: true });
    setArtifactTaskId(null);
    setArtifactFilter("全部");
    setArtifactListQuery("");
    setArtifactSort("最近更新");
    setSelectedArtifactId(restoredArtifacts[0]?.id ?? "");
    setArtifactDeleteId(null);
    setArtifactDeleteSnapshot(null);
    setSettings(backup.settings);
    setUsageSettings(backup.usage ?? { ...defaultUsageSettings });
    setUsageBudgetOpen(false);
    setSettingsDiscardTarget(null);
    setConnectorStates(backup.connectors ?? { ...defaultConnectorStates });
    setSelectedConnectorId(null);
    setConnectorDisconnectConfirm(false);
    setTeamMembers(
      backup.members ?? initialTeamMembers.map((member) => ({ ...member })),
    );
    setTeamInviteOpen(false);
    setSelectedTeamMemberId(null);
    setMemberRemoveConfirm(false);
    setApprovals(restoredApprovals);
    setSelectedApprovalId(restoredApprovals[0]?.id ?? "");
    setApprovalListQuery("");
    setApprovalRiskFilter("全部");
    setSelectedApprovalIds([]);
    setBulkApprovalDecision(null);
    setApprovalRejectReason("");
    setApprovalRejectSnapshot(null);
    setActivityLog(backup.activity.slice(0, 100));
    setIsRunning(restoredPrimary.status !== "已暂停");
    setSelectedStep("analyze");
    setTaskFilter("全部");
    setSelectedTaskIds([]);
    setBulkDeleteOpen(false);
    setTaskDeleteSnapshot(null);
    setActivityFilter("全部");
    setActivityTaskId(null);
    setActivityListQuery("");
    setActivitySort("最新优先");
    setSelectedActivityId(backup.activity[0]?.id ?? "");
    setSelectedTaskId(null);
    setInspectedRunTaskId(null);
    setInspectedRunId(null);
    setRejectApprovalId(null);
    setTemporaryModeOpen(false);
    setNotificationsOpen(false);
    setWorkspaceLoadWarning("");
    setPendingWorkspaceImport(null);
    setActiveView("settings");
    writeWorkspaceRoute(
      { view: "settings", taskId: null, runId: null },
      "push",
    );
    recordActivity({
      title: "工作区备份已恢复",
      detail: `已从“${fileName}”恢复 ${backup.tasks.length} 个任务、${restoredArtifacts.length} 个成果、${(backup.members ?? initialTeamMembers).length} 位成员和 ${backup.activity.length} 条运行记录。`,
      icon: "activity",
      tone: "green",
      kind: "系统",
    });
    setNotice(`已恢复 ${backup.tasks.length} 个任务，工作区可以继续使用`);
    scrollWorkspaceTop();
  }

  function resetWorkspace() {
    setTasks(initialTasks.map((task) => ({ ...task })));
    setArtifacts(initialArtifacts.map((artifact) => ({ ...artifact })));
    closeArtifactEditor({ clearRecovery: true });
    closeComposer({ clearRecovery: true });
    setArtifactTaskId(null);
    setArtifactFilter("全部");
    setArtifactListQuery("");
    setArtifactSort("最近更新");
    setSelectedArtifactId(initialArtifacts[0].id);
    setArtifactDeleteId(null);
    setArtifactDeleteSnapshot(null);
    setSettings({ ...defaultSettings });
    setUsageSettings({ ...defaultUsageSettings });
    setUsageBudgetOpen(false);
    setUsageBudgetDraft(String(defaultUsageSettings.monthlyBudget));
    setUsageAlertDraft(defaultUsageSettings.alertThreshold);
    setUsagePauseDraft(defaultUsageSettings.pauseAtLimit);
    setSettingsDiscardTarget(null);
    setConnectorStates({ ...defaultConnectorStates });
    setSelectedConnectorId(null);
    setConnectorDisconnectConfirm(false);
    setConnectorTestingId(null);
    setTeamMembers(initialTeamMembers.map((member) => ({ ...member })));
    setTeamInviteOpen(false);
    setSelectedTeamMemberId(null);
    setMemberRemoveConfirm(false);
    setInviteFormSubmitted(false);
    setApprovals(initialApprovals.map((item) => ({ ...item })));
    setSelectedApprovalId(initialApprovals[0].id);
    setApprovalListQuery("");
    setApprovalRiskFilter("全部");
    setSelectedApprovalIds([]);
    setBulkApprovalDecision(null);
    setApprovalRejectReason("");
    setApprovalRejectSnapshot(null);
    setActivityLog(initialActivityItems.map((item) => ({ ...item })));
    setIsRunning(true);
    setSelectedStep("analyze");
    setTaskFilter("全部");
    setSelectedTaskIds([]);
    setBulkDeleteOpen(false);
    setTaskDeleteSnapshot(null);
    setActivityFilter("全部");
    setActivityTaskId(null);
    setActivityListQuery("");
    setActivitySort("最新优先");
    setSelectedActivityId(initialActivityItems[0].id);
    setRecentSearchKeys([]);
    setReadNotificationIds([]);
    setNotificationFilter("全部");
    setSelectedTaskId(null);
    setInspectedRunTaskId(null);
    setInspectedRunId(null);
    setDeleteTaskId(null);
    setRejectApprovalId(null);
    setTemporaryModeOpen(false);
    setNotificationsOpen(false);
    setWorkspaceResetOpen(false);
    setWorkspaceLoadWarning("");
    recordActivity({
      title: "工作区已恢复初始状态",
      detail: "任务、成果、团队成员、待确认事项、运行记录和设置已重新初始化。",
      icon: "settings",
      tone: "amber",
      kind: "系统",
    });
    setNotice("工作区已恢复初始状态");
  }

  function openActivityItem(item: ActivityItem) {
    if (item.taskId && tasks.some((task) => task.id === item.taskId)) {
      openTask(item.taskId);
      return;
    }
    if (item.kind === "审批" && approvals.length > 0) {
      openView("approvals");
      return;
    }
    if (item.kind === "系统") {
      openView("settings");
      return;
    }
    setNotice(item.detail);
  }

  function selectActivityItem(item: ActivityItem) {
    setSelectedActivityId(item.id);
    window.requestAnimationFrame(() => {
      if (!window.matchMedia("(max-width: 980px)").matches) return;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      activityInspectorRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function scrollApprovalIntoView() {
    window.requestAnimationFrame(() => {
      if (!window.matchMedia("(max-width: 1080px)").matches) return;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      approvalDetailRef.current?.scrollIntoView({
        block: "start",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
  }

  function chooseApproval(approvalId: string) {
    setSelectedApprovalId(approvalId);
    scrollApprovalIntoView();
  }

  function approvalMatchesFilters(approval: ApprovalItem) {
    const relatedTaskTitle =
      tasks.find((task) => task.id === approval.taskId)?.title ?? "";
    return (
      (approvalRiskFilter === "全部" ||
        approval.risk === approvalRiskFilter) &&
      (!normalizedApprovalQuery ||
        [
          approval.title,
          approval.reason,
          approval.target,
          approval.scope,
          approval.policy,
          relatedTaskTitle,
        ].some((value) =>
          value.toLowerCase().includes(normalizedApprovalQuery),
        ))
    );
  }

  function getNextApprovalAfterRemoving(removedIds: Set<string>) {
    const remaining = approvals.filter(
      (approval) => !removedIds.has(approval.id),
    );
    return (
      remaining.find((approval) => approvalMatchesFilters(approval)) ??
      remaining[0]
    );
  }

  function toggleApprovalSelection(approvalId: string) {
    setSelectedApprovalIds((selectedIds) =>
      selectedIds.includes(approvalId)
        ? selectedIds.filter((id) => id !== approvalId)
        : [...selectedIds, approvalId],
    );
  }

  function toggleAllVisibleApprovals() {
    const visibleIds = filteredApprovals.map((approval) => approval.id);
    setSelectedApprovalIds((selectedIds) => {
      if (allVisibleApprovalsSelected) {
        return selectedIds.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...selectedIds, ...visibleIds]));
    });
  }

  function requestBulkApprovalDecision(decision: BulkApprovalDecision) {
    if (selectedApprovals.length === 0) return;
    if (decision === "approve" && bulkApprovableApprovals.length === 0) {
      setNotice("高风险操作必须逐项审核，不能批量批准");
      return;
    }
    setApprovalRejectReason("");
    setBulkApprovalDecision(decision);
  }

  function confirmBulkApprove() {
    if (bulkApprovableApprovals.length === 0) return;
    if (
      !requireOnline(
        "设备离线，未执行批量批准；所选操作仍保留在待确认列表中",
      )
    ) {
      setBulkApprovalDecision(null);
      return;
    }
    const approvedIds = new Set(
      bulkApprovableApprovals.map((approval) => approval.id),
    );
    const affectedTaskIds = new Set(
      bulkApprovableApprovals.map((approval) => approval.taskId),
    );
    const nextApproval = getNextApprovalAfterRemoving(approvedIds);
    const highRiskIds = selectedApprovals
      .filter((approval) => approval.risk === "高风险")
      .map((approval) => approval.id);
    const competitorShouldResume =
      affectedTaskIds.has("competitor") &&
      tasks.find((task) => task.id === "competitor")?.status === "待确认";

    setApprovals((items) =>
      items.filter((approval) => !approvedIds.has(approval.id)),
    );
    setSelectedApprovalId(nextApproval?.id ?? "");
    setSelectedApprovalIds(highRiskIds);
    setTasks((items) =>
      items.map((task) => {
        if (!affectedTaskIds.has(task.id)) return task;
        const shouldResume = task.status === "待确认";
        return {
          ...task,
          status: shouldResume ? "运行中" : task.status,
          progress: shouldResume
            ? Math.min(99, task.progress + 4)
            : task.progress,
          updated: shouldResume ? "刚刚批量批准" : "刚刚批准操作",
        };
      }),
    );
    if (competitorShouldResume) {
      setIsRunning(true);
    }
    bulkApprovableApprovals.forEach((approval) => {
      recordActivity({
        title: `已批准：${approval.title}`,
        detail: `${approval.impact} 授权范围：${approval.scope}。批量决策已记录。`,
        icon: "shield",
        tone: "green",
        kind: "审批",
        taskId: approval.taskId,
      });
    });
    setBulkApprovalDecision(null);
    setNotice(
      selectedHighRiskApprovalCount
        ? `已批准 ${bulkApprovableApprovals.length} 项，${selectedHighRiskApprovalCount} 项高风险操作保留待审`
        : `已批准 ${bulkApprovableApprovals.length} 项操作`,
    );
    if (nextApproval) {
      scrollApprovalIntoView();
    } else {
      scrollWorkspaceTop();
    }
  }

  function stageApprovalRejectUndo(rejectedCount: number) {
    setTaskDeleteSnapshot(null);
    setArtifactDeleteSnapshot(null);
    setApprovalRejectSnapshot({
      tasks,
      approvals,
      selectedApprovalId,
      selectedApprovalIds,
      rejectedCount,
      isRunning,
    });
  }

  function undoApprovalReject() {
    if (!approvalRejectSnapshot) return;
    const snapshot = approvalRejectSnapshot;
    setTasks(snapshot.tasks);
    setApprovals(snapshot.approvals);
    setSelectedApprovalId(snapshot.selectedApprovalId);
    setSelectedApprovalIds(snapshot.selectedApprovalIds);
    setIsRunning(snapshot.isRunning);
    setBulkApprovalDecision(null);
    setRejectApprovalId(null);
    setApprovalRejectReason("");
    setApprovalRejectSnapshot(null);
    setActiveView("approvals");
    writeWorkspaceRoute(
      { view: "approvals", taskId: null, runId: null },
      "push",
    );
    recordActivity({
      title: `已撤销拒绝 ${snapshot.rejectedCount} 项操作`,
      detail: "待确认操作、关联任务状态和原运行记录已恢复；之前的拒绝与本次恢复仍保留在审计中。",
      icon: "activity",
      tone: "green",
      kind: "审批",
    });
    setNotice(`已恢复 ${snapshot.rejectedCount} 项待确认操作`);
    scrollApprovalIntoView();
  }

  function confirmBulkReject() {
    const reason = approvalRejectReason.trim();
    if (selectedApprovals.length === 0 || reason.length < 4) return;
    const rejected = [...selectedApprovals];
    const rejectedIds = new Set(rejected.map((approval) => approval.id));
    const affectedTaskIds = new Set(
      rejected.map((approval) => approval.taskId),
    );
    const nextApproval = getNextApprovalAfterRemoving(rejectedIds);

    stageApprovalRejectUndo(rejected.length);
    setApprovals((items) =>
      items.filter((approval) => !rejectedIds.has(approval.id)),
    );
    setSelectedApprovalId(nextApproval?.id ?? "");
    setSelectedApprovalIds([]);
    setTasks((items) =>
      items.map((task) =>
        affectedTaskIds.has(task.id)
          ? {
              ...task,
              status: "已暂停",
              updated: "因批量审批拒绝暂停",
              runs: stopActiveTaskRuns(
                task.runs,
                "批量审批被拒绝，本次运行未执行外部操作。",
              ),
            }
          : task,
      ),
    );
    if (affectedTaskIds.has("competitor")) {
      setIsRunning(false);
    }
    rejected.forEach((approval) => {
      const relatedTask = tasks.find((task) => task.id === approval.taskId);
      recordActivity({
        title: `已拒绝：${approval.title}`,
        detail: `未执行外部操作，关联任务“${relatedTask?.title ?? approval.taskId}”已暂停。原因：${reason}`,
        icon: "shield",
        tone: "red",
        kind: "审批",
        taskId: approval.taskId,
      });
    });
    setBulkApprovalDecision(null);
    setApprovalRejectReason("");
    setNotice(
      `已拒绝 ${rejected.length} 项操作，暂停 ${affectedTaskIds.size} 个关联任务`,
    );
    if (nextApproval) {
      scrollApprovalIntoView();
    } else {
      scrollWorkspaceTop();
    }
  }

  function approveCurrent() {
    if (!selectedApproval) return;
    if (
      !requireOnline(
        "设备离线，未执行批准操作；这项操作仍保留在待确认列表中",
      )
    ) {
      return;
    }
    const approved = selectedApproval;
    const relatedTask = tasks.find((task) => task.id === approved.taskId);
    const shouldResume = relatedTask?.status === "待确认";
    const nextApproval = approvals.find(
      (item) => item.id !== selectedApproval.id,
    );
    setApprovals((items) => items.filter((item) => item.id !== selectedApproval.id));
    setSelectedApprovalId(nextApproval?.id ?? "");
    setSelectedApprovalIds((selectedIds) =>
      selectedIds.filter((id) => id !== approved.id),
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
    if (nextApproval) {
      scrollApprovalIntoView();
    } else {
      scrollWorkspaceTop();
    }
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
    if (nextApproval) {
      scrollApprovalIntoView();
    }
  }

  function requestRejectApproval() {
    if (!selectedApproval) return;
    setApprovalRejectReason("");
    setRejectApprovalId(selectedApproval.id);
  }

  function confirmRejectApproval() {
    const reason = approvalRejectReason.trim();
    if (!rejectedApproval || reason.length < 4) return;
    const rejected = rejectedApproval;
    const relatedTask = tasks.find((task) => task.id === rejected.taskId);
    const nextApproval = approvals.find((item) => item.id !== rejected.id);
    stageApprovalRejectUndo(1);
    setApprovals((items) => items.filter((item) => item.id !== rejected.id));
    setSelectedApprovalId(nextApproval?.id ?? "");
    setSelectedApprovalIds((selectedIds) =>
      selectedIds.filter((id) => id !== rejected.id),
    );
    setTasks((items) =>
      items.map((task) =>
        task.id === rejected.taskId
          ? {
              ...task,
              status: "已暂停",
              updated: "因审批拒绝暂停",
              runs: stopActiveTaskRuns(
                task.runs,
                "审批被拒绝，本次运行未执行外部操作。",
              ),
            }
          : task,
      ),
    );
    if (rejected.taskId === "competitor") {
      setIsRunning(false);
    }
    setRejectApprovalId(null);
    setApprovalRejectReason("");
    recordActivity({
      title: `已拒绝：${rejected.title}`,
      detail: `未执行任何外部操作，关联任务“${relatedTask?.title ?? rejected.taskId}”已暂停。原因：${reason}`,
      icon: "shield",
      tone: "red",
      kind: "审批",
      taskId: rejected.taskId,
    });
    setNotice(`已拒绝操作，任务“${relatedTask?.title ?? rejected.taskId}”已暂停`);
    if (nextApproval) {
      scrollApprovalIntoView();
    } else {
      scrollWorkspaceTop();
    }
  }

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaskFormSubmitted(true);
    if (taskFormHasErrors || taskSavingRef.current) {
      const firstInvalidField =
        (taskFormErrors.name && taskNameRef.current) ||
        (taskFormErrors.target && taskTargetRef.current) ||
        (taskFormErrors.description && taskDescriptionRef.current) ||
        (taskFormErrors.scheduleTime && taskScheduleTimeRef.current);
      window.requestAnimationFrame(() => firstInvalidField?.focus());
      return;
    }

    taskSavingRef.current = true;
    setIsSavingTask(true);
    await new Promise((resolve) => window.setTimeout(resolve, 260));

    try {
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
        closeComposer({ clearRecovery: true });
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

      const startImmediately = isOnline;
      const newTask: TaskItem = {
        id: `task-${Date.now()}`,
        title: taskName.trim(),
        description: taskDescription.trim(),
        target: taskTarget.trim(),
        status: startImmediately ? "运行中" : "已暂停",
        progress: startImmediately ? 3 : 0,
        updated: startImmediately ? "刚刚创建" : "已保存，等待网络",
        schedule: taskSchedule,
        scheduleTime: taskSchedule === "仅运行一次" ? undefined : taskScheduleTime,
        scheduleDay: taskSchedule === "每周" ? taskScheduleDay : undefined,
        requiresApproval: taskApproval,
        retryCount: 0,
        runs: startImmediately
          ? [
              {
                id: `run-${Date.now()}`,
                status: "运行中",
                startedAt: new Date().toISOString(),
                summary: "任务已创建，正在检查数据来源和执行范围。",
              },
            ]
          : [],
      };
      setTasks((items) => [newTask, ...items]);
      setTaskFilter("全部");
      setSelectedTaskIds([]);
      setActiveView("tasks");
      setSelectedTaskId(newTask.id);
      writeWorkspaceRoute(
        { view: "tasks", taskId: newTask.id, runId: null },
        "push",
      );
      closeComposer({ clearRecovery: true });
      setTaskName("");
      setTaskTarget("");
      setTaskDescription("");
      setTaskSchedule("仅运行一次");
      setTaskScheduleTime("09:00");
      setTaskScheduleDay("周一");
      setTaskApproval(true);
      recordActivity({
        title: `${
          startImmediately ? "任务已创建" : "离线任务已保存"
        }：${newTask.title}`,
        detail: startImmediately
          ? `${formatTaskSchedule(newTask)} · 目标：${newTask.target}`
          : `${formatTaskSchedule(newTask)} · 已保存配置，恢复网络后可手动开始运行。`,
        icon: "sparkles",
        tone: startImmediately ? "blue" : "amber",
        kind: "任务",
        taskId: newTask.id,
      });
      setNotice(
        startImmediately
          ? `任务“${newTask.title}”已开始运行`
          : `任务“${newTask.title}”已保存，联网后可以开始运行`,
      );
    } finally {
      taskSavingRef.current = false;
      setIsSavingTask(false);
    }
  }

  function beginCreateTask() {
    const draft: TaskDraftSnapshot = {
      name: "跟踪一个新网页",
      target: "https://example.com",
      description: "检查页面内容变化，只保留有意义的更新并生成摘要。",
      schedule: "每天",
      scheduleTime: "09:00",
      scheduleDay: "周一",
      approval: settings.approval,
    };
    if (
      !overlayTriggerRef.current &&
      document.activeElement instanceof HTMLElement
    ) {
      overlayTriggerRef.current = document.activeElement;
    }
    setEditingTaskId(null);
    setTaskName(draft.name);
    setTaskTarget(draft.target);
    setTaskDescription(draft.description);
    setTaskSchedule(draft.schedule);
    setTaskScheduleTime(draft.scheduleTime);
    setTaskScheduleDay(draft.scheduleDay);
    setTaskApproval(draft.approval);
    setTaskDraftBaseline(draft);
    taskDraftRecoveryOwnedRef.current = false;
    setTaskDraftAutoSavedAt(null);
    setTaskDraftAutoSavedSignature("");
    setTaskDraftSaveFailedSignature("");
    setTaskDiscardOpen(false);
    setTaskFormSubmitted(false);
    setComposerOpen(true);
  }

  function beginEditTask(task: TaskItem) {
    const draft: TaskDraftSnapshot = {
      name: task.title,
      target: task.target,
      description: task.description,
      schedule: task.schedule ?? "仅运行一次",
      scheduleTime: task.scheduleTime ?? "09:00",
      scheduleDay: task.scheduleDay ?? "周一",
      approval: task.requiresApproval ?? true,
    };
    if (
      !overlayTriggerRef.current &&
      document.activeElement instanceof HTMLElement
    ) {
      overlayTriggerRef.current = document.activeElement;
    }
    setTaskName(draft.name);
    setTaskTarget(draft.target);
    setTaskDescription(draft.description);
    setTaskSchedule(draft.schedule);
    setTaskScheduleTime(draft.scheduleTime);
    setTaskScheduleDay(draft.scheduleDay);
    setTaskApproval(draft.approval);
    setTaskDraftBaseline(draft);
    taskDraftRecoveryOwnedRef.current = false;
    setTaskDraftAutoSavedAt(null);
    setTaskDraftAutoSavedSignature("");
    setTaskDraftSaveFailedSignature("");
    setTaskDiscardOpen(false);
    setTaskFormSubmitted(false);
    setEditingTaskId(task.id);
    setComposerOpen(true);
  }

  function clearTaskDraftRecovery() {
    clearDraftRecoveryStorage(taskDraftRecoveryKey);
    taskDraftRecoveryOwnedRef.current = false;
    setPendingTaskDraftRecovery(null);
    setTaskDraftAutoSavedAt(null);
    setTaskDraftAutoSavedSignature("");
    setTaskDraftSaveFailedSignature("");
  }

  function closeComposer(options: { clearRecovery?: boolean } = {}) {
    if (options.clearRecovery || taskDraftRecoveryOwnedRef.current) {
      clearTaskDraftRecovery();
    }
    setTaskDiscardOpen(false);
    setComposerOpen(false);
    setEditingTaskId(null);
    setTaskDraftBaseline(null);
    setTaskFormSubmitted(false);
  }

  function requestCloseComposer() {
    if (taskSavingRef.current || isSavingTask) return;
    if (taskComposerDirty) {
      setTaskDiscardOpen(true);
      return;
    }
    closeComposer();
  }

  function confirmDiscardTaskDraft() {
    const wasEditing = Boolean(editingTaskId);
    closeComposer();
    setNotice(
      wasEditing
        ? "未保存的任务修改已放弃"
        : "未保存的新任务草稿已放弃",
    );
  }

  function restoreRecoveredTaskDraft() {
    if (!pendingTaskDraftRecovery || !tasksReady) return;
    const recovery = pendingTaskDraftRecovery;
    const originalTask = recovery.editingTaskId
      ? tasks.find((task) => task.id === recovery.editingTaskId) ?? null
      : null;
    const recoveredSignature = JSON.stringify([
      originalTask?.id ?? null,
      recovery.draft.name,
      recovery.draft.target,
      recovery.draft.description,
      recovery.draft.schedule,
      recovery.draft.scheduleTime,
      recovery.draft.scheduleDay,
      recovery.draft.approval,
    ]);

    if (
      !overlayTriggerRef.current &&
      document.activeElement instanceof HTMLElement
    ) {
      overlayTriggerRef.current = document.activeElement;
    }
    setTaskName(recovery.draft.name);
    setTaskTarget(recovery.draft.target);
    setTaskDescription(recovery.draft.description);
    setTaskSchedule(recovery.draft.schedule);
    setTaskScheduleTime(recovery.draft.scheduleTime);
    setTaskScheduleDay(recovery.draft.scheduleDay);
    setTaskApproval(recovery.draft.approval);
    setTaskDraftBaseline(recovery.baseline);
    setEditingTaskId(originalTask?.id ?? null);
    setTaskDiscardOpen(false);
    setTaskFormSubmitted(false);
    taskDraftRecoveryOwnedRef.current = true;
    setPendingTaskDraftRecovery(null);
    setTaskDraftAutoSavedAt(recovery.savedAt);
    setTaskDraftAutoSavedSignature(recoveredSignature);
    setTaskDraftSaveFailedSignature("");
    setComposerOpen(true);

    if (recovery.editingTaskId && !originalTask) {
      setNotice("原任务已不存在，草稿将作为新任务继续编辑");
    }
  }

  function discardRecoveredTaskDraft() {
    clearTaskDraftRecovery();
    setNotice("未完成的任务草稿已放弃");
  }

  function applyTaskTemplate(template: (typeof taskTemplates)[number]) {
    setTaskName(template.title);
    setTaskDescription(template.description);
    setTaskTarget(template.target);
    setTaskSchedule(template.schedule);
    setTaskScheduleTime(template.scheduleTime);
    setTaskScheduleDay(template.scheduleDay);
    setTaskFormSubmitted(false);
  }

  function restoreWorkspaceFromWarning() {
    importInputRef.current?.click();
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
      runs: [],
      lastError: undefined,
      errorCode: undefined,
      retryCount: 0,
    };
    setTasks((items) => [duplicate, ...items]);
    setSelectedTaskId(duplicate.id);
    writeWorkspaceRoute(
      { view: "tasks", taskId: duplicate.id, runId: null },
      "push",
    );
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
    setDeleteTaskId(task.id);
  }

  function stageTaskDeleteUndo(
    deletedCount: number,
    restoreTaskId: string | null = null,
  ) {
    setArtifactDeleteSnapshot(null);
    setApprovalRejectSnapshot(null);
    setTaskDeleteSnapshot({
      tasks,
      artifacts,
      activity: activityLog,
      approvals,
      selectedTaskIds,
      selectedApprovalId,
      selectedApprovalIds,
      activityTaskId,
      artifactTaskId,
      restoreTaskId,
      isRunning,
      deletedCount,
    });
  }

  function confirmDeleteTask() {
    if (!deletingTask) return;
    const deletingTaskId = deletingTask.id;
    const deletedApprovalIds = new Set(
      approvals
        .filter((approval) => approval.taskId === deletingTaskId)
        .map((approval) => approval.id),
    );
    const remainingApprovals = approvals.filter(
      (approval) => approval.taskId !== deletingTaskId,
    );
    stageTaskDeleteUndo(1, deletingTaskId);
    setTasks((items) => items.filter((item) => item.id !== deletingTask.id));
    setArtifacts((items) =>
      items.filter((artifact) => artifact.taskId !== deletingTask.id),
    );
    setActivityLog((items) =>
      items.filter((activity) => activity.taskId !== deletingTask.id),
    );
    setApprovals(remainingApprovals);
    setSelectedApprovalId((approvalId) =>
      deletedApprovalIds.has(approvalId)
        ? (remainingApprovals[0]?.id ?? "")
        : approvalId,
    );
    setSelectedApprovalIds((approvalIds) =>
      approvalIds.filter((approvalId) => !deletedApprovalIds.has(approvalId)),
    );
    setSelectedTaskIds((selectedIds) =>
      selectedIds.filter((id) => id !== deletingTaskId),
    );
    if (activityTaskId === deletingTask.id) {
      setActivityTaskId(null);
    }
    if (artifactTaskId === deletingTask.id) {
      setArtifactTaskId(null);
    }
    setDeleteTaskId(null);
    setSelectedTaskId(null);
    writeWorkspaceRoute(
      { view: "tasks", taskId: null, runId: null },
      "replace",
    );
    recordActivity({
      title: `任务已删除：${deletingTask.title}`,
      detail: `已移除任务配置、关联成果和本机记录，原数据来源：${deletingTask.target}`,
      icon: "trash",
      tone: "red",
      kind: "任务",
      taskId: deletingTaskId,
    });
    setNotice(`已删除 1 个任务“${deletingTask.title}”`);
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((selectedIds) =>
      selectedIds.includes(taskId)
        ? selectedIds.filter((id) => id !== taskId)
        : [...selectedIds, taskId],
    );
  }

  function toggleAllVisibleTasks() {
    const visibleIds = filteredTasks.map((task) => task.id);
    setSelectedTaskIds((selectedIds) => {
      if (allVisibleTasksSelected) {
        return selectedIds.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...selectedIds, ...visibleIds]));
    });
  }

  function bulkPauseTasks() {
    const targetIds = new Set(
      selectedTasks
        .filter((task) => task.status === "运行中" || task.status === "待确认")
        .map((task) => task.id),
    );
    if (targetIds.size === 0) {
      setNotice("所选任务中没有可以暂停的任务");
      return;
    }
    setTasks((items) =>
      items.map((task) =>
        targetIds.has(task.id)
          ? {
              ...task,
              status: "已暂停",
              updated: "刚刚批量暂停",
              runs: stopActiveTaskRuns(
                task.runs,
                "任务已由批量操作暂停，当前检查点已保存。",
              ),
            }
          : task,
      ),
    );
    if (targetIds.has("competitor")) setIsRunning(false);
    setSelectedTaskIds([]);
    recordActivity({
      title: `已批量暂停 ${targetIds.size} 个任务`,
      detail: "任务保留当前进度和已保存证据，可随时继续运行。",
      icon: "clock",
      tone: "amber",
      kind: "任务",
    });
    setNotice(`已暂停 ${targetIds.size} 个任务`);
  }

  function bulkResumeTasks() {
    const targetIds = new Set(
      selectedTasks
        .filter(
          (task) =>
            task.status === "已暂停" ||
            task.status === "已完成" ||
            task.status === "失败",
        )
        .map((task) => task.id),
    );
    if (targetIds.size === 0) {
      setNotice("所选任务中没有可以继续的任务");
      return;
    }
    setTasks((items) =>
      items.map((task) =>
        targetIds.has(task.id)
          ? {
              ...task,
              status: "运行中",
              progress:
                task.status === "已完成" || task.status === "失败"
                  ? Math.max(3, Math.min(task.progress, 12))
                  : task.progress,
              updated: "刚刚批量继续",
              lastError: undefined,
              errorCode: undefined,
              retryCount:
                task.status === "失败"
                  ? (task.retryCount ?? 0) + 1
                  : task.retryCount,
              runs: [
                {
                  id: `run-${task.id}-${Date.now()}`,
                  status: "运行中" as const,
                  startedAt: new Date().toISOString(),
                  summary:
                    task.status === "失败"
                      ? "批量重试已启动，正在重新验证任务依赖。"
                      : task.status === "已完成"
                        ? "批量再次运行已启动，正在重新读取任务目标。"
                        : "任务已由批量操作从保存的检查点继续运行。",
                },
                ...(task.runs ?? []),
              ].slice(0, 12),
            }
          : task,
      ),
    );
    if (targetIds.has("competitor")) setIsRunning(true);
    setSelectedTaskIds([]);
    recordActivity({
      title: `已批量继续 ${targetIds.size} 个任务`,
      detail: "任务已从各自保存的进度重新开始运行。",
      icon: "activity",
      tone: "green",
      kind: "任务",
    });
    setNotice(`已继续 ${targetIds.size} 个任务`);
  }

  function bulkEnableApproval() {
    const targetIds = new Set(
      selectedTasks
        .filter((task) => !(task.requiresApproval ?? true))
        .map((task) => task.id),
    );
    if (targetIds.size === 0) {
      setNotice("所选任务已经启用审批保护");
      return;
    }
    setTasks((items) =>
      items.map((task) =>
        targetIds.has(task.id) ? { ...task, requiresApproval: true } : task,
      ),
    );
    setSelectedTaskIds([]);
    recordActivity({
      title: `已为 ${targetIds.size} 个任务启用审批保护`,
      detail: "这些任务执行外部操作前会暂停并等待人工确认。",
      icon: "shield",
      tone: "blue",
      kind: "系统",
    });
    setNotice(`已保护 ${targetIds.size} 个任务`);
  }

  function requestBulkDelete() {
    if (deletableSelectedTasks.length === 0) {
      setNotice("首页主任务不能删除，请选择其他任务");
      return;
    }
    setBulkDeleteOpen(true);
  }

  function confirmBulkDelete() {
    if (deletableSelectedTasks.length === 0) return;
    const deletedIds = new Set(deletableSelectedTasks.map((task) => task.id));
    const deletedCount = deletedIds.size;
    const deletedApprovalIds = new Set(
      approvals
        .filter((approval) => deletedIds.has(approval.taskId))
        .map((approval) => approval.id),
    );
    const remainingApprovals = approvals.filter(
      (approval) => !deletedIds.has(approval.taskId),
    );
    stageTaskDeleteUndo(deletedCount);
    setTasks((items) => items.filter((task) => !deletedIds.has(task.id)));
    setArtifacts((items) =>
      items.filter((artifact) => !deletedIds.has(artifact.taskId)),
    );
    setActivityLog((items) =>
      items.filter((activity) => !activity.taskId || !deletedIds.has(activity.taskId)),
    );
    setApprovals(remainingApprovals);
    setSelectedApprovalId((approvalId) =>
      deletedApprovalIds.has(approvalId)
        ? (remainingApprovals[0]?.id ?? "")
        : approvalId,
    );
    setSelectedApprovalIds((approvalIds) =>
      approvalIds.filter((approvalId) => !deletedApprovalIds.has(approvalId)),
    );
    setSelectedTaskIds([]);
    setBulkDeleteOpen(false);
    recordActivity({
      title: `已批量删除 ${deletedCount} 个任务`,
      detail: "关联成果、审批事项和任务运行记录已一并移除，可在当前提示中撤销。",
      icon: "trash",
      tone: "red",
      kind: "系统",
    });
    setNotice(
      `已删除 ${deletedCount} 个任务${
        protectedSelectedTaskCount ? "，首页任务已保留" : ""
      }`,
    );
  }

  function undoTaskDelete() {
    if (!taskDeleteSnapshot) return;
    const snapshot = taskDeleteSnapshot;
    const restoredTask = snapshot.restoreTaskId
      ? snapshot.tasks.find((task) => task.id === snapshot.restoreTaskId)
      : null;
    const restoredActivityIds = new Set(
      snapshot.activity.map((activity) => activity.id),
    );
    setTasks(snapshot.tasks);
    setArtifacts(snapshot.artifacts);
    setActivityLog((items) => [
      ...items.filter((activity) => !restoredActivityIds.has(activity.id)),
      ...snapshot.activity,
    ].slice(0, 100));
    setApprovals(snapshot.approvals);
    setSelectedTaskIds(snapshot.selectedTaskIds);
    setSelectedApprovalId(snapshot.selectedApprovalId);
    setSelectedApprovalIds(snapshot.selectedApprovalIds);
    setActivityTaskId(snapshot.activityTaskId);
    setArtifactTaskId(snapshot.artifactTaskId);
    setIsRunning(snapshot.isRunning);
    if (snapshot.restoreTaskId) {
      setActiveView("tasks");
      setSelectedTaskId(snapshot.restoreTaskId);
      writeWorkspaceRoute(
        {
          view: "tasks",
          taskId: snapshot.restoreTaskId,
          runId: null,
        },
        "push",
      );
    }
    setTaskDeleteSnapshot(null);
    recordActivity({
      title: restoredTask
        ? `已撤销删除：${restoredTask.title}`
        : `已撤销删除 ${snapshot.deletedCount} 个任务`,
      detail: "任务、关联成果、审批事项和运行记录已恢复。",
      icon: "activity",
      tone: "green",
      kind: restoredTask ? "任务" : "系统",
      taskId: restoredTask?.id,
    });
    setNotice(
      restoredTask
        ? `已恢复任务“${restoredTask.title}”`
        : `已恢复 ${snapshot.deletedCount} 个任务`,
    );
  }

  function openUsageBudget() {
    setUsageBudgetDraft(String(usageSettings.monthlyBudget));
    setUsageAlertDraft(usageSettings.alertThreshold);
    setUsagePauseDraft(usageSettings.pauseAtLimit);
    setSettingsDiscardTarget(null);
    setUsageBudgetOpen(true);
  }

  function requestCloseUsageBudget() {
    if (usageBudgetDirty) {
      setSettingsDiscardTarget("budget");
      return;
    }
    setUsageBudgetOpen(false);
  }

  function discardSettingsDraft() {
    if (settingsDiscardTarget === "budget") {
      setUsageBudgetDraft(String(usageSettings.monthlyBudget));
      setUsageAlertDraft(usageSettings.alertThreshold);
      setUsagePauseDraft(usageSettings.pauseAtLimit);
      setUsageBudgetOpen(false);
    } else if (settingsDiscardTarget === "invite") {
      setInviteName("");
      setInviteEmail("");
      setInviteRole("成员");
      setInviteFormSubmitted(false);
      setTeamInviteOpen(false);
    } else if (settingsDiscardTarget === "member") {
      if (selectedTeamMember) setMemberRoleDraft(selectedTeamMember.role);
      setSelectedTeamMemberId(null);
      setMemberRemoveConfirm(false);
    }
    setSettingsDiscardTarget(null);
  }

  function saveUsageBudget() {
    if (usageBudgetDraftInvalid) return;
    const monthlyBudget = Math.round(usageBudgetDraftValue);
    const nextSettings: UsageSettings = {
      monthlyBudget,
      alertThreshold: usageAlertDraft,
      pauseAtLimit: usagePauseDraft,
    };
    const shouldPause = usagePauseDraft && usedCredits >= monthlyBudget;
    const runningTaskIds = tasks
      .filter((task) => task.status === "运行中")
      .map((task) => task.id);

    setUsageSettings(nextSettings);
    setUsageBudgetOpen(false);
    if (shouldPause && runningTaskIds.length > 0) {
      const runningIds = new Set(runningTaskIds);
      setTasks((items) =>
        items.map((task) =>
          runningIds.has(task.id)
            ? {
                ...task,
                status: "已暂停",
                updated: "因用量到限保护暂停",
                runs: stopActiveTaskRuns(
                  task.runs,
                  "达到预算上限，系统已停止本次运行。",
                ),
              }
            : task,
        ),
      );
      if (runningIds.has("competitor")) {
        setIsRunning(false);
      }
      recordActivity({
        title: `月度额度已更新：${monthlyBudget} 点`,
        detail: `当前已使用 ${usedCredits} 点，达到预算上限；已暂停 ${runningTaskIds.length} 个运行中任务。提醒阈值：${usageAlertDraft}%。`,
        icon: "settings",
        tone: "amber",
        kind: "系统",
      });
      setNotice(
        `预算已保存，${runningTaskIds.length} 个任务因用量到限保护暂停`,
      );
      return;
    }

    recordActivity({
      title: `月度额度已更新：${monthlyBudget} 点`,
      detail: `提醒阈值：${usageAlertDraft}% · 到限自动暂停：${usagePauseDraft ? "开启" : "关闭"}。`,
      icon: "settings",
      tone: "blue",
      kind: "系统",
    });
    setNotice(`月度额度已更新为 ${monthlyBudget} 点`);
  }

  function exportUsageReport() {
    const rows = [
      ["项目", "本月额度", "占已用比例"],
      ...usageBreakdown.map((item) => [
        item.label,
        String(item.credits),
        `${Math.round((item.credits / Math.max(1, usedCredits)) * 100)}%`,
      ]),
      ["合计", String(usedCredits), "100%"],
      ["月度预算", String(usageSettings.monthlyBudget), ""],
      ["月底预计", String(forecastCredits), ""],
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${value.replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unzoo-one-usage-${new Date()
      .toISOString()
      .slice(0, 7)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    recordActivity({
      title: "用量报告已导出",
      detail: `已导出本月 ${usedCredits} 点 AI 用量及分类明细。`,
      icon: "activity",
      tone: "blue",
      kind: "系统",
    });
    setNotice("本月用量报告已导出");
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

  async function toggleDesktopNotifications() {
    if (
      isRequestingNotificationPermission ||
      desktopNotificationPermission === "checking"
    ) {
      return;
    }

    if (settings.notifications) {
      setSettings((current) => ({ ...current, notifications: false }));
      recordActivity({
        title: "桌面确认提醒已关闭",
        detail: "页面内通知中心仍会保留任务、审批和成果动态。",
        icon: "settings",
        tone: "neutral",
        kind: "系统",
      });
      setNotice("桌面提醒已关闭，页面内通知仍会保留");
      return;
    }

    if (!("Notification" in window)) {
      setDesktopNotificationPermission("unsupported");
      setNotice("当前浏览器不支持桌面通知，页面内通知仍可正常使用");
      return;
    }

    setIsRequestingNotificationPermission(true);
    try {
      let permission = window.Notification.permission;
      if (permission === "default") {
        permission = await window.Notification.requestPermission();
      }
      setDesktopNotificationPermission(permission);

      if (permission !== "granted") {
        setSettings((current) => ({ ...current, notifications: false }));
        recordActivity({
          title: "桌面通知授权未通过",
          detail:
            permission === "denied"
              ? "浏览器已阻止当前站点发送桌面通知。"
              : "本次未授予桌面通知权限，页面内通知不受影响。",
          icon: "settings",
          tone: "amber",
          kind: "系统",
        });
        setNotice(
          permission === "denied"
            ? "浏览器已阻止桌面通知，请在网站权限中允许后重试"
            : "未开启桌面通知，页面内通知仍会保留",
        );
        return;
      }

      setSettings((current) => ({ ...current, notifications: true }));
      recordActivity({
        title: "桌面确认提醒已开启",
        detail: "后续任务需要确认或安全停止时，浏览器会主动发送桌面提醒。",
        icon: "settings",
        tone: "green",
        kind: "系统",
      });
      setNotice("桌面提醒已开启");

      try {
        const confirmation = new window.Notification("Unzoo One 提醒已开启", {
          body: "后续需要你决定的任务会在这里提醒。",
          icon: "/unzoo-one-mark.svg",
          tag: "unzoo-one-notifications-enabled",
        });
        window.setTimeout(() => confirmation.close(), 5000);
      } catch {
        // The saved permission remains authoritative if the preview is suppressed.
      }
    } catch {
      setSettings((current) => ({ ...current, notifications: false }));
      setDesktopNotificationPermission(window.Notification.permission);
      setNotice("无法开启桌面通知，页面内通知仍可正常使用");
    } finally {
      setIsRequestingNotificationPermission(false);
    }
  }

  function requestToggleLocalPersistence() {
    if (settings.local) {
      setTemporaryModeOpen(true);
      return;
    }
    setSettings((current) => ({ ...current, local: true }));
    recordActivity({
      title: "本机持久保存已开启",
      detail: "当前任务、成果、审批和运行记录会继续保存在这台设备。",
      icon: "settings",
      tone: "green",
      kind: "系统",
    });
    setNotice("已开启本机持久保存，当前工作区会在下次打开时恢复");
  }

  function confirmTemporaryMode() {
    setSettings((current) => ({ ...current, local: false }));
    setTemporaryModeOpen(false);
    recordActivity({
      title: "已切换到临时会话",
      detail: "当前页面关闭后，本次工作区不会从本机恢复；本次会话中的数据仍可继续使用或导出。",
      icon: "settings",
      tone: "amber",
      kind: "系统",
    });
    setNotice("已进入临时会话，关闭页面前可以随时重新开启保存");
  }

  function openConnector(connectorId: ConnectorId) {
    setConnectorDisconnectConfirm(false);
    setSelectedConnectorId(connectorId);
  }

  function connectConnector(connectorId: ConnectorId) {
    const connector = connectorCatalog.find((item) => item.id === connectorId);
    if (!connector) return;
    if (
      !requireOnline(
        `设备离线，${connector.name}尚未连接；恢复网络后可以继续授权`,
      )
    ) {
      return;
    }
    setConnectorStates((current) => ({ ...current, [connectorId]: true }));
    setConnectorDisconnectConfirm(false);
    recordActivity({
      title: `连接器已授权：${connector.name}`,
      detail: `已启用 ${connector.permissions.join("、")}；授权范围为${connector.scope}。`,
      icon: "settings",
      tone: "green",
      kind: "系统",
    });
    setNotice(`${connector.name}已连接，可以用于后续任务`);
  }

  function testConnector(connectorId: ConnectorId) {
    const connector = connectorCatalog.find((item) => item.id === connectorId);
    if (!connector || !connectorStates[connectorId] || connectorTestingId) return;
    if (
      !requireOnline(
        `设备离线，无法测试${connector.name}；当前授权状态没有改变`,
      )
    ) {
      return;
    }
    setConnectorTestingId(connectorId);
    window.setTimeout(() => {
      setConnectorTestingId(null);
      recordActivity({
        title: `连接测试通过：${connector.name}`,
        detail: `连接正常，当前授权范围为${connector.scope}。`,
        icon: "settings",
        tone: "green",
        kind: "系统",
      });
      setNotice(`${connector.name}连接正常`);
    }, 850);
  }

  function reauthorizeConnector(connectorId: ConnectorId) {
    const connector = connectorCatalog.find((item) => item.id === connectorId);
    const impactedTasks = connectorIssueTasks[connectorId];
    if (!connector || impactedTasks.length === 0 || connectorTestingId) return;
    if (
      !requireOnline(
        `设备离线，${connector.name}尚未重新授权；受影响任务仍保持安全停止`,
      )
    ) {
      return;
    }

    const impactedTaskIds = new Set(impactedTasks.map((task) => task.id));
    setConnectorTestingId(connectorId);
    window.setTimeout(() => {
      setConnectorStates((current) => ({ ...current, [connectorId]: true }));
      setTasks((items) =>
        items.map((task) =>
          impactedTaskIds.has(task.id)
            ? {
                ...task,
                errorCode: "RECOVERY_READY",
                lastError: `${connector.name}已重新授权，任务可以从安全检查点继续。`,
                updated: "刚刚恢复授权",
              }
            : task,
        ),
      );
      setConnectorTestingId(null);
      recordActivity({
        title: `连接器已重新授权：${connector.name}`,
        detail: `授权验证通过，${impactedTasks.length} 个受影响任务已准备好重新运行；系统仍会保留原始失败记录。`,
        icon: "shield",
        tone: "green",
        kind: "系统",
        taskId: impactedTasks.length === 1 ? impactedTasks[0].id : undefined,
      });
      setNotice(`${connector.name}已恢复，受影响任务可以重新运行`);
    }, 950);
  }

  function openConnectorAffectedTask(taskId: string) {
    setSelectedConnectorId(null);
    setConnectorDisconnectConfirm(false);
    openTask(taskId);
  }

  function confirmDisconnectConnector() {
    if (!selectedConnector) return;
    setConnectorStates((current) => ({
      ...current,
      [selectedConnector.id]: false,
    }));
    setConnectorDisconnectConfirm(false);
    recordActivity({
      title: `连接器已断开：${selectedConnector.name}`,
      detail: "后续任务不会再使用这项能力，历史运行记录仍会保留。",
      icon: "settings",
      tone: "amber",
      kind: "系统",
    });
    setNotice(`${selectedConnector.name}已断开`);
  }

  function openTeamInvite() {
    setInviteName("");
    setInviteEmail("");
    setInviteRole("成员");
    setInviteFormSubmitted(false);
    setSettingsDiscardTarget(null);
    setTeamInviteOpen(true);
  }

  function closeTeamInvite() {
    if (inviteSavingRef.current) return;
    if (teamInviteDirty) {
      setSettingsDiscardTarget("invite");
      return;
    }
    setTeamInviteOpen(false);
    setInviteFormSubmitted(false);
  }

  async function inviteTeamMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inviteSavingRef.current) return;
    setInviteFormSubmitted(true);
    if (teamInviteFormHasErrors) return;

    inviteSavingRef.current = true;
    setIsSendingInvite(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 520));
      const normalizedName = inviteName.trim();
      const normalizedEmail = inviteEmail.trim().toLowerCase();
      const tones: TeamMember["tone"][] = ["violet", "blue", "green", "amber"];
      const member: TeamMember = {
        id: `member-${Date.now()}`,
        name: normalizedName,
        email: normalizedEmail,
        role: inviteRole,
        status: "已邀请",
        avatar: normalizedName.slice(0, 1).toUpperCase(),
        tone: tones[teamMembers.length % tones.length],
        lastActive: "邀请刚刚发送",
      };
      setTeamMembers((members) => [...members, member]);
      setTeamInviteOpen(false);
      setInviteFormSubmitted(false);
      recordActivity({
        title: `已邀请团队成员：${member.name}`,
        detail: `${member.email} · ${member.role} · 邀请邮件已发送。`,
        icon: "settings",
        tone: "blue",
        kind: "系统",
      });
      setNotice(`邀请已发送给 ${member.name}`);
    } finally {
      inviteSavingRef.current = false;
      setIsSendingInvite(false);
    }
  }

  function openTeamMember(member: TeamMember) {
    setMemberRoleDraft(member.role);
    setMemberRemoveConfirm(false);
    setSettingsDiscardTarget(null);
    setSelectedTeamMemberId(member.id);
  }

  function closeTeamMember() {
    if (teamMemberRoleDirty) {
      setSettingsDiscardTarget("member");
      return;
    }
    setSelectedTeamMemberId(null);
    setMemberRemoveConfirm(false);
  }

  function saveTeamMemberRole() {
    if (!selectedTeamMember || selectedTeamMember.role === "所有者") return;
    if (memberRoleDraft === selectedTeamMember.role) {
      setNotice("成员角色没有变化");
      return;
    }
    const previousRole = selectedTeamMember.role;
    setTeamMembers((members) =>
      members.map((member) =>
        member.id === selectedTeamMember.id
          ? { ...member, role: memberRoleDraft }
          : member,
      ),
    );
    recordActivity({
      title: `成员角色已更新：${selectedTeamMember.name}`,
      detail: `${previousRole} → ${memberRoleDraft}；新权限已立即生效。`,
      icon: "shield",
      tone: "violet",
      kind: "系统",
    });
    setNotice(`${selectedTeamMember.name} 已设为${memberRoleDraft}`);
  }

  function resendTeamInvite() {
    if (!selectedTeamMember || selectedTeamMember.status !== "已邀请") return;
    setTeamMembers((members) =>
      members.map((member) =>
        member.id === selectedTeamMember.id
          ? { ...member, lastActive: "邀请刚刚重新发送" }
          : member,
      ),
    );
    recordActivity({
      title: `团队邀请已重发：${selectedTeamMember.name}`,
      detail: `新的邀请邮件已发送至 ${selectedTeamMember.email}。`,
      icon: "settings",
      tone: "blue",
      kind: "系统",
    });
    setNotice(`已重新发送邀请给 ${selectedTeamMember.name}`);
  }

  function confirmRemoveTeamMember() {
    if (!selectedTeamMember || selectedTeamMember.role === "所有者") return;
    const removedMember = selectedTeamMember;
    setTeamMembers((members) =>
      members.filter((member) => member.id !== removedMember.id),
    );
    setSelectedTeamMemberId(null);
    setMemberRemoveConfirm(false);
    recordActivity({
      title: `团队成员已移除：${removedMember.name}`,
      detail: `${removedMember.email} 已失去当前工作区访问权限。`,
      icon: "settings",
      tone: "red",
      kind: "系统",
    });
    setNotice(`${removedMember.name} 已从工作区移除`);
  }

  function scrollWorkspaceTop() {
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      window.scrollTo({
        top: 0,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
  }

  function openView(
    view: ViewId,
    options: { scrollToTop?: boolean } = {},
  ) {
    setActiveView(view);
    if (view !== "tasks") {
      setSelectedTaskIds([]);
      setBulkDeleteOpen(false);
    }
    if (view !== "approvals") {
      setSelectedApprovalIds([]);
      setBulkApprovalDecision(null);
      setApprovalRejectReason("");
    }
    if (view === "activity") {
      setActivityTaskId(null);
      setActivityFilter("全部");
      setActivityListQuery("");
      setActivitySort("最新优先");
      setSelectedActivityId(activityLog[0]?.id ?? "");
    }
    if (view === "artifacts") {
      setArtifactTaskId(null);
      setArtifactFilter("全部");
      setSelectedArtifactId(artifacts[0]?.id ?? "");
    }
    setNotificationsOpen(false);
    setWorkspaceMenuOpen(false);
    setSelectedTaskId(null);
    setInspectedRunTaskId(null);
    setInspectedRunId(null);
    writeWorkspaceRoute(
      { view, taskId: null, runId: null },
      "push",
    );
    if (options.scrollToTop !== false) {
      scrollWorkspaceTop();
    }
  }

  function openWorkspaceSection(sectionId: string) {
    openView("settings", { scrollToTop: false });
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() =>
        document.getElementById(sectionId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      ),
    );
  }

  function openWorkspaceBudget() {
    openView("settings");
    openUsageBudget();
  }

  function openWorkspaceInvite() {
    openView("settings");
    openTeamInvite();
  }

  function exportWorkspaceFromMenu() {
    setWorkspaceMenuOpen(false);
    exportWorkspace();
  }

  function openTask(taskId: string) {
    setActiveView("tasks");
    setInspectedRunTaskId(null);
    setInspectedRunId(null);
    setSelectedTaskId(taskId);
    setNotificationsOpen(false);
    writeWorkspaceRoute(
      { view: "tasks", taskId, runId: null },
      "push",
    );
  }

  function openTaskRun(taskId: string, runId: string) {
    setActiveView("tasks");
    setSelectedTaskId(null);
    setInspectedRunTaskId(taskId);
    setInspectedRunId(runId);
    setNotificationsOpen(false);
    writeWorkspaceRoute(
      { view: "tasks", taskId, runId },
      "push",
    );
  }

  function dismissRunDetail() {
    setInspectedRunTaskId(null);
    setInspectedRunId(null);
  }

  function closeRunDetail() {
    const taskId = inspectedRunTaskId;
    if (canReturnToWorkspaceParent()) {
      window.history.back();
      return;
    }
    dismissRunDetail();
    if (taskId) {
      setActiveView("tasks");
      setSelectedTaskId(taskId);
      writeWorkspaceRoute(
        { view: "tasks", taskId, runId: null },
        "replace",
      );
    }
  }

  function closeTaskDetail() {
    if (canReturnToWorkspaceParent()) {
      window.history.back();
      return;
    }
    setSelectedTaskId(null);
    writeWorkspaceRoute(
      { view: activeView, taskId: null, runId: null },
      "replace",
    );
  }

  function openInspectedRunTask() {
    if (!inspectedRunTask) return;
    const taskId = inspectedRunTask.id;
    dismissRunDetail();
    openTask(taskId);
  }

  async function copyTaskRunId(run: TaskRun) {
    try {
      await window.navigator.clipboard.writeText(run.id);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = run.id;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setNotice(`已复制运行 ID：${run.id}`);
  }

  function downloadTaskRun(task: TaskItem, run: TaskRun) {
    const payload = {
      product: "Unzoo One",
      exportedAt: new Date().toISOString(),
      task: {
        id: task.id,
        title: task.title,
        target: task.target,
        schedule: formatTaskSchedule(task),
        requiresApproval: task.requiresApproval ?? true,
      },
      run,
      stages: getTaskRunStages(run),
      evidence: {
        externalActions:
          run.status === "失败" &&
          /AUTH|PERMISSION|ACCESS/.test(
            `${run.errorCode ?? ""} ${run.errorMessage ?? ""}`,
          )
            ? 0
            : null,
        artifactCount: inspectedRunArtifacts.length,
        artifacts: inspectedRunArtifacts.map((artifact) => ({
          id: artifact.id,
          title: artifact.title,
          filename: artifact.filename,
          version: artifact.version ?? 1,
        })),
        auditRecordCount: inspectedRunActivity.length,
        activity: inspectedRunActivity,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unzoo-one-run-${run.id.replace(/[^a-z0-9-]/gi, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    recordActivity({
      title: `运行记录已导出：${task.title}`,
      detail: `${run.id} · ${run.status} · ${formatTaskRunDuration(run.durationSeconds)}`,
      icon: "activity",
      tone: "blue",
      kind: "系统",
      taskId: task.id,
    });
    setNotice("运行记录已导出为 JSON");
  }

  function pauseInspectedRun(task: TaskItem) {
    updateTaskStatus(task);
    dismissRunDetail();
    openTask(task.id);
  }

  function retryInspectedRun(task: TaskItem) {
    if (task.status === "运行中") {
      openInspectedRunTask();
      return;
    }
    retryTask(task);
    dismissRunDetail();
    openTask(task.id);
  }

  function openTaskActivity(taskId: string) {
    const taskActivities = activityLog.filter((item) => item.taskId === taskId);
    setActivityTaskId(taskId);
    setActivityFilter("全部");
    setActivityListQuery("");
    setActivitySort("最新优先");
    setSelectedActivityId(taskActivities[0]?.id ?? "");
    setActiveView("activity");
    setSelectedTaskId(null);
    setInspectedRunTaskId(null);
    setInspectedRunId(null);
    setNotificationsOpen(false);
    writeWorkspaceRoute(
      { view: "activity", taskId: null, runId: null },
      "push",
    );
    scrollWorkspaceTop();
  }

  function openTaskArtifacts(taskId: string) {
    const taskArtifacts = artifacts.filter((artifact) => artifact.taskId === taskId);
    setArtifactTaskId(taskId);
    setArtifactFilter("全部");
    setArtifactListQuery("");
    setArtifactSort("最近更新");
    setSelectedArtifactId(taskArtifacts[0]?.id ?? "");
    setActiveView("artifacts");
    setSelectedTaskId(null);
    setInspectedRunTaskId(null);
    setInspectedRunId(null);
    setNotificationsOpen(false);
    writeWorkspaceRoute(
      { view: "artifacts", taskId: null, runId: null },
      "push",
    );
    scrollWorkspaceTop();
  }

  function chooseArtifactFilter(filter: ArtifactFilter) {
    const nextArtifact =
      filter === "全部"
        ? scopedArtifacts[0]
        : filter === "重点"
          ? scopedArtifacts.find((artifact) => artifact.starred)
          : scopedArtifacts.find((artifact) => artifact.type === filter);
    setArtifactFilter(filter);
    setSelectedArtifactId(nextArtifact?.id ?? "");
  }

  function chooseSearchResult(result: SearchResult) {
    setSearchOpen(false);
    setQuery("");
    setActiveSearchIndex(0);
    setRecentSearchKeys((keys) => [
      result.key,
      ...keys.filter((key) => key !== result.key),
    ].slice(0, 4));

    if (result.kind === "task") {
      openTask(result.id);
    } else if (result.kind === "artifact") {
      setActiveView("artifacts");
      setArtifactTaskId(null);
      setArtifactFilter("全部");
      setSelectedArtifactId(result.id);
      writeWorkspaceRoute(
        { view: "artifacts", taskId: null, runId: null },
        "push",
      );
    } else if (result.kind === "view") {
      openView(result.id as ViewId);
    } else if (result.id === "new-task") {
      beginCreateTask();
    } else if (result.id === "artifacts") {
      openView("artifacts");
    } else {
      openView("approvals");
    }

    window.requestAnimationFrame(() => searchInputRef.current?.blur());
  }

  function clearRecentSearches() {
    setRecentSearchKeys([]);
    setActiveSearchIndex(0);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function markNotificationRead(notificationId: string) {
    setReadNotificationIds((ids) =>
      ids.includes(notificationId)
        ? ids
        : [notificationId, ...ids].slice(0, 30),
    );
  }

  function markAllNotificationsRead() {
    setReadNotificationIds((ids) =>
      Array.from(
        new Set([...notificationItems.map((item) => item.id), ...ids]),
      ).slice(0, 30),
    );
    setNotice("全部通知已标记为已读");
  }

  function closeNotifications() {
    setNotificationsOpen(false);
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => notificationButtonRef.current?.focus()),
    );
  }

  function closeWorkspaceMenu() {
    setWorkspaceMenuOpen(false);
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => workspaceMenuButtonRef.current?.focus()),
    );
  }

  function requireOnline(message: string) {
    if (isOnline) return true;
    setNotice(message);
    return false;
  }

  async function checkNetworkConnection() {
    if (isCheckingNetwork) return;
    setIsCheckingNetwork(true);
    try {
      if (!window.navigator.onLine) {
        setNotice("设备仍处于离线状态，本机数据不会受到影响");
        return;
      }

      const response = await window.fetch(
        `/unzoo-one-mark.svg?network-check=${Date.now()}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error("Network check failed");
      }
      setNotice("网络连接正常，在线能力可以继续使用");
    } catch {
      setNotice("暂时无法连接在线服务，本机数据仍可正常查看");
    } finally {
      setIsCheckingNetwork(false);
    }
  }

  function openNotification(item: NotificationItem) {
    markNotificationRead(item.id);
    setNotificationsOpen(false);

    if (item.target === "approvals") {
      openView("approvals");
    } else if (item.target === "activity") {
      openView("activity");
      if (item.targetId) setSelectedActivityId(item.targetId);
    } else if (item.target === "artifact") {
      openView("artifacts");
      if (item.targetId) setSelectedArtifactId(item.targetId);
    } else {
      if (item.targetId) {
        openTask(item.targetId);
      } else {
        openView("tasks");
      }
    }
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

  function retryTask(task: TaskItem) {
    if (
      !requireOnline(
        `设备离线，任务“${task.title}”仍保持停止；恢复网络后可以重试`,
      )
    ) {
      return;
    }
    const now = new Date();
    const nextRun: TaskRun = {
      id: `run-${task.id}-${now.getTime()}`,
      status: "运行中",
      startedAt: now.toISOString(),
      summary: "重试已启动，正在重新验证连接器授权和任务依赖。",
    };

    setTasks((items) =>
      items.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: "运行中",
              progress: Math.max(3, Math.min(item.progress, 12)),
              updated: "刚刚重试",
              lastError: undefined,
              errorCode: undefined,
              retryCount: (item.retryCount ?? 0) + 1,
              runs: [nextRun, ...(item.runs ?? [])].slice(0, 12),
            }
          : item,
      ),
    );
    if (task.id === "competitor") setIsRunning(true);
    recordActivity({
      title: `任务已重新运行：${task.title}`,
      detail: `重试 #${(task.retryCount ?? 0) + 1} 已启动；系统会先验证连接器授权，再从安全检查点继续。`,
      icon: "activity",
      tone: "blue",
      kind: "任务",
      taskId: task.id,
    });
    setNotice(`任务“${task.title}”已重新运行`);
  }

  function openTaskRecoverySettings() {
    openView("settings");
    setSelectedConnectorId("mail");
  }

  function updateTaskStatus(task: TaskItem) {
    if (task.status === "待确认") {
      setSelectedTaskId(null);
      openView("approvals");
      return;
    }

    if (task.status === "失败") {
      retryTask(task);
      return;
    }

    const willStart = task.status !== "运行中";
    if (
      willStart &&
      !requireOnline(
        `设备离线，任务“${task.title}”仍保持暂停；恢复网络后可以继续`,
      )
    ) {
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
              runs:
                nextStatus === "运行中"
                  ? [
                      {
                        id: `run-${task.id}-${Date.now()}`,
                        status: "运行中" as const,
                        startedAt: new Date().toISOString(),
                        summary:
                          task.status === "已完成"
                            ? "再次运行已启动，正在重新读取任务目标。"
                            : "任务已从保存的检查点继续运行。",
                      },
                      ...(item.runs ?? []),
                    ].slice(0, 12)
                  : stopActiveTaskRuns(
                      item.runs,
                      "用户暂停运行，当前检查点已保存。",
                    ),
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
    if (
      nextRunning &&
      !requireOnline(
        `设备离线，任务“${primaryTask.title}”仍保持暂停；恢复网络后可以继续`,
      )
    ) {
      return;
    }
    setIsRunning(nextRunning);
    setTasks((items) =>
      items.map((task) =>
        task.id === "competitor"
          ? {
              ...task,
              status: nextRunning ? "运行中" : "已暂停",
              updated: nextRunning ? "刚刚继续" : "刚刚暂停",
              runs: nextRunning
                ? [
                    {
                      id: `run-${task.id}-${Date.now()}`,
                      status: "运行中" as const,
                      startedAt: new Date().toISOString(),
                      summary: "首页主任务已从保存的检查点继续运行。",
                    },
                    ...(task.runs ?? []),
                  ].slice(0, 12)
                : stopActiveTaskRuns(
                    task.runs,
                    "用户从首页暂停运行，当前检查点已保存。",
                  ),
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
              aria-current={activeView === item.id ? "page" : undefined}
              title={item.label}
              onClick={() => openView(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              <small>{item.mobileLabel}</small>
              {item.id === "approvals" && approvals.length > 0 && (
                <em>{approvals.length}</em>
              )}
            </button>
          ))}
        </nav>

        <div className="clarity-sidebar-status">
          <i className={systemStatusTone} />
          <div>
            <strong>{systemStatusLabel}</strong>
            <small>{systemStatusDetail}</small>
          </div>
        </div>
      </aside>

      <section className="clarity-main" aria-busy={!tasksReady}>
        <div className="clarity-mobile-topbar">
          <button
            className="clarity-mobile-brand"
            type="button"
            aria-label="返回首页"
            onClick={() => openView("home")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/unzoo-one-mark.svg" alt="" />
            <span>
              <strong>Unzoo One</strong>
              <small>
                <i className={systemStatusTone} />
                {systemStatusLabel}
              </small>
            </span>
          </button>
          <button
            className="clarity-mobile-create"
            type="button"
            aria-label="新建任务"
            title="新建任务"
            onClick={beginCreateTask}
          >
            <Plus size={19} />
          </button>
        </div>

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
                  placeholder="搜索任务、成果、页面和操作"
                  value={query}
                  onFocus={() => {
                    setNotificationsOpen(false);
                    setWorkspaceMenuOpen(false);
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
                    <div className="clarity-search-sections">
                      {searchResultSections.map((section) => (
                        <section
                          className="clarity-search-section"
                          key={section.id}
                          role="group"
                          aria-label={section.label}
                        >
                          <div className="clarity-search-section-heading">
                            <span>{section.label}</span>
                            <em>{section.results.length}</em>
                            {section.canClear && (
                              <button
                                type="button"
                                onClick={clearRecentSearches}
                              >
                                清除
                              </button>
                            )}
                          </div>
                          <div className="clarity-search-results">
                            {section.results.map((result) => {
                              const index = searchResults.findIndex(
                                (item) => item.key === result.key,
                              );
                              return (
                                <button
                                  id={`search-result-${index}`}
                                  className={
                                    index === activeSearchIndex ? "active" : ""
                                  }
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
                              );
                            })}
                          </div>
                        </section>
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

            <div className="clarity-notification-wrap" ref={notificationWrapRef}>
              <button
                ref={notificationButtonRef}
                className="clarity-icon-button"
                type="button"
                aria-label={
                  unreadNotificationCount
                    ? `通知，${unreadNotificationCount} 条未读`
                    : "通知，无未读消息"
                }
                aria-controls="global-notifications"
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
                onClick={() => {
                  setSearchOpen(false);
                  setWorkspaceMenuOpen(false);
                  setNotificationsOpen((open) => {
                    const nextOpen = !open;
                    if (nextOpen) {
                      setNotificationFilter("全部");
                      window.requestAnimationFrame(() =>
                        window.requestAnimationFrame(() =>
                          notificationPanelRef.current
                            ?.querySelector<HTMLButtonElement>(
                              ".notification-item",
                            )
                            ?.focus(),
                        ),
                      );
                    }
                    return nextOpen;
                  });
                }}
              >
                <Bell size={18} />
                {unreadNotificationCount > 0 && (
                  <span
                    className="clarity-notification-badge"
                    aria-hidden="true"
                  >
                    {unreadNotificationCount > 9
                      ? "9+"
                      : unreadNotificationCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <>
                  <button
                    className="notification-backdrop"
                    type="button"
                    tabIndex={-1}
                    aria-label="关闭通知中心"
                    onClick={closeNotifications}
                  />
                  <div
                    className="clarity-notifications"
                    id="global-notifications"
                    role="dialog"
                    aria-modal="true"
                    aria-label="通知"
                    ref={notificationPanelRef}
                  >
                  <header className="notification-heading">
                    <div>
                      <strong>通知中心</strong>
                      <span>
                        {unreadNotificationCount
                          ? `${unreadNotificationCount} 条未读`
                          : "全部已读"}
                      </span>
                    </div>
                    <div>
                      <button
                        className="notification-mark-all"
                        type="button"
                        disabled={unreadNotificationCount === 0}
                        onClick={markAllNotificationsRead}
                      >
                        <CheckCircle2 size={14} />
                        全部已读
                      </button>
                      <button
                        className="notification-close"
                        type="button"
                        aria-label="关闭通知"
                        onClick={closeNotifications}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </header>

                  <div
                    className="notification-filters"
                    role="tablist"
                    aria-label="通知筛选"
                  >
                    {(["全部", "未读"] as NotificationFilter[]).map(
                      (filter) => (
                        <button
                          className={
                            notificationFilter === filter ? "active" : ""
                          }
                          key={filter}
                          type="button"
                          role="tab"
                          aria-selected={notificationFilter === filter}
                          onClick={() => setNotificationFilter(filter)}
                        >
                          {filter}
                          <span>
                            {filter === "全部"
                              ? notificationItems.length
                              : unreadNotificationCount}
                          </span>
                        </button>
                      ),
                    )}
                  </div>

                  {visibleNotificationItems.length > 0 ? (
                    <div className="notification-list">
                      {visibleNotificationItems.map((item) => {
                        const isUnread = !readNotificationIds.includes(item.id);
                        return (
                          <button
                            className={`notification-item ${
                              isUnread ? "unread" : ""
                            }`}
                            key={item.id}
                            type="button"
                            onClick={() => openNotification(item)}
                          >
                            <span
                              className={`notification-item-icon tone-${item.tone}`}
                            >
                              <item.icon size={17} />
                            </span>
                            <span className="notification-item-copy">
                              <strong>{item.title}</strong>
                              <small>{item.detail}</small>
                            </span>
                            <span className="notification-item-meta">
                              <em>{item.meta}</em>
                              {isUnread && <i />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="notification-empty">
                      <CheckCircle2 size={22} />
                      <strong>没有未读通知</strong>
                      <small>需要处理的新消息会出现在这里。</small>
                      <button
                        type="button"
                        onClick={() => setNotificationFilter("全部")}
                      >
                        查看全部
                      </button>
                    </div>
                  )}

                  <button
                    className="notification-footer"
                    type="button"
                    onClick={() => {
                      setNotificationsOpen(false);
                      openView("activity");
                    }}
                  >
                    查看全部运行记录
                    <ChevronRight size={14} />
                  </button>
                  </div>
                </>
              )}
            </div>

            <div className="workspace-menu-wrap" ref={workspaceMenuWrapRef}>
              <button
                ref={workspaceMenuButtonRef}
                className={`workspace-menu-trigger ${
                  workspaceMenuOpen ? "open" : ""
                }`}
                type="button"
                aria-label="打开工作区控制中心"
                aria-controls="workspace-control-center"
                aria-expanded={workspaceMenuOpen}
                aria-haspopup="dialog"
                onClick={() => {
                  setSearchOpen(false);
                  setNotificationsOpen(false);
                  setWorkspaceMenuOpen((open) => {
                    const nextOpen = !open;
                    if (nextOpen) {
                      window.requestAnimationFrame(() =>
                        window.requestAnimationFrame(() =>
                          workspaceMenuPanelRef.current
                            ?.querySelector<HTMLButtonElement>(
                              ".workspace-menu-nav button",
                            )
                            ?.focus(),
                        ),
                      );
                    }
                    return nextOpen;
                  });
                }}
              >
                <span className="workspace-menu-trigger-icon">
                  <Building2 size={17} />
                </span>
                <span className="workspace-menu-trigger-copy">
                  <strong>MVP 工作区</strong>
                  <small>Team 方案</small>
                </span>
                <ChevronDown
                  className={workspaceMenuOpen ? "is-open" : ""}
                  size={15}
                />
              </button>

              {workspaceMenuOpen && (
                <>
                  <button
                    className="workspace-menu-backdrop"
                    type="button"
                    tabIndex={-1}
                    aria-label="关闭工作区控制中心"
                    onClick={closeWorkspaceMenu}
                  />
                  <div
                    className="workspace-menu-panel"
                    id="workspace-control-center"
                    role="dialog"
                    aria-modal="true"
                    aria-label="工作区控制中心"
                    ref={workspaceMenuPanelRef}
                  >
                  <header className="workspace-menu-heading">
                    <span className="workspace-menu-avatar">M</span>
                    <div>
                      <span>当前工作区</span>
                      <strong>MVP 工作区</strong>
                      <small>
                        {!isOnline
                          ? "设备离线 · 本机数据可用"
                          : settings.local
                            ? "数据保存在本机"
                            : "当前为临时会话"}
                      </small>
                    </div>
                    <button
                      type="button"
                      aria-label="关闭工作区控制中心"
                      onClick={closeWorkspaceMenu}
                    >
                      <X size={16} />
                    </button>
                  </header>

                  <div className="workspace-menu-summary" aria-label="工作区状态">
                    <span>
                      <small>成员</small>
                      <strong>{teamMembers.length}</strong>
                    </span>
                    <span className={!isOnline ? "is-alert" : ""}>
                      <small>{isOnline ? "可用连接" : "网络状态"}</small>
                      <strong>
                        {isOnline
                          ? `${healthyConnectorCount}/${connectorCatalog.length}`
                          : "离线"}
                      </strong>
                    </span>
                    <span className={budgetAlertReached ? "is-alert" : ""}>
                      <small>本月用量</small>
                      <strong>{usagePercent}%</strong>
                    </span>
                  </div>

                  <nav className="workspace-menu-nav" aria-label="工作区快捷操作">
                    <button
                      type="button"
                      onClick={() => openWorkspaceSection("settings-team")}
                    >
                      <span className="tone-blue">
                        <Users size={17} />
                      </span>
                      <span>
                        <strong>团队与权限</strong>
                        <small>
                          {onlineMemberCount} 位在线 · {approverMemberCount} 位可审批
                        </small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                    <button type="button" onClick={openWorkspaceBudget}>
                      <span className="tone-violet">
                        <Sparkles size={17} />
                      </span>
                      <span>
                        <strong>用量与预算</strong>
                        <small>
                          已使用 {usedCredits} / {usageSettings.monthlyBudget} 点
                        </small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openWorkspaceSection("settings-connectors")
                      }
                    >
                      <span
                        className={
                          connectorIssueCount > 0 ? "tone-amber" : "tone-green"
                        }
                      >
                        <Link2 size={17} />
                      </span>
                      <span>
                        <strong>能力连接</strong>
                        <small>
                          {connectorIssueCount > 0
                            ? `${connectorIssueCount} 项需要处理`
                            : `${connectedConnectorCount} 项已连接`}
                        </small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                    <button type="button" onClick={exportWorkspaceFromMenu}>
                      <span className="tone-slate">
                        <Download size={17} />
                      </span>
                      <span>
                        <strong>导出工作区备份</strong>
                        <small>下载任务、成果、设置和审计记录</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  </nav>

                  <footer className="workspace-menu-footer">
                    <div
                      className="workspace-menu-people"
                      aria-label={`${teamMembers.length} 位工作区成员`}
                    >
                      {teamMembers.slice(0, 3).map((member) => (
                        <span
                          className={`tone-${member.tone}`}
                          key={member.id}
                          title={member.name}
                        >
                          {member.avatar}
                        </span>
                      ))}
                      <small>{teamMembers.length} 位成员</small>
                    </div>
                    <button type="button" onClick={openWorkspaceInvite}>
                      <UserPlus size={15} />
                      邀请成员
                    </button>
                  </footer>
                  </div>
                </>
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

        {!isOnline && (
          <section
            className="network-status-banner"
            role="status"
            aria-live="polite"
          >
            <span className="network-status-icon" aria-hidden="true">
              <Globe2 size={18} />
            </span>
            <div>
              <strong>当前设备已离线</strong>
              <p>
                本机任务、成果和审计记录仍可查看；网页、邮件和日历能力会在网络恢复后继续。
              </p>
            </div>
            <button
              type="button"
              disabled={isCheckingNetwork}
              onClick={checkNetworkConnection}
            >
              {isCheckingNetwork ? (
                <LoaderCircle className="spinning" size={15} />
              ) : (
                <RotateCcw size={15} />
              )}
              {isCheckingNetwork ? "正在检查" : "检查连接"}
            </button>
          </section>
        )}

        <input
          ref={importInputRef}
          className="workspace-import-input"
          type="file"
          accept=".json,application/json"
          onChange={importWorkspace}
        />

        {!tasksReady && (
          <section
            className="workspace-loading"
            role="status"
            aria-label="正在恢复工作区"
          >
            <div className="workspace-loading-heading">
              <span className="workspace-loading-icon">
                <LoaderCircle size={19} />
              </span>
              <span>
                <strong>正在恢复你的工作区</strong>
                <small>读取本机任务、成果和运行记录</small>
              </span>
            </div>
            <div className="workspace-loading-metrics" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="workspace-loading-canvas" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </section>
        )}

        {tasksReady && workspaceLoadWarning && (
          <section className="workspace-warning" role="status">
            <span className="workspace-warning-icon">
              <AlertTriangle size={19} />
            </span>
            <span className="workspace-warning-copy">
              <strong>工作区已安全恢复</strong>
              <small>{workspaceLoadWarning}</small>
            </span>
            <button type="button" onClick={restoreWorkspaceFromWarning}>
              <Upload size={15} />
              从备份恢复
            </button>
            <button
              className="workspace-warning-dismiss"
              type="button"
              aria-label="关闭工作区提示"
              onClick={() => setWorkspaceLoadWarning("")}
            >
              <X size={15} />
            </button>
          </section>
        )}

        {tasksReady && pendingTaskDraftRecovery && !composerOpen && (
          <DraftRecoveryNotice
            id="task-draft-recovery"
            icon={Save}
            title="发现未完成的任务草稿"
            description={`${
              pendingTaskDraftRecovery.editingTaskId ? "任务修改" : "新任务"
            }：${
              pendingTaskDraftRecovery.draft.name.trim() || "未命名任务"
            } · 保存于 ${formatDraftSavedAt(pendingTaskDraftRecovery.savedAt)}`}
            continueLabel="继续编辑"
            onContinue={restoreRecoveredTaskDraft}
            onDiscard={discardRecoveredTaskDraft}
          />
        )}

        {tasksReady && pendingArtifactDraftRecovery && !editingArtifact && (
          <DraftRecoveryNotice
            id="artifact-draft-recovery"
            icon={FileText}
            title="发现未完成的成果修订"
            description={`成果修订：${
              pendingArtifactDraftRecovery.draft.title.trim() || "未命名成果"
            } · 保存于 ${formatDraftSavedAt(
              pendingArtifactDraftRecovery.savedAt,
            )}`}
            continueLabel="继续修订"
            onContinue={restoreRecoveredArtifactDraft}
            onDiscard={discardRecoveredArtifactDraft}
          />
        )}

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
              <span className="summary-failed">
                <i><AlertTriangle size={14} /></i>
                <span>
                  <small>需要恢复</small>
                  <strong>{failedTaskCount}</strong>
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
                  <div className="task-tools-actions">
                    <button
                      type="button"
                      onClick={() => openTaskArtifacts(primaryTask.id)}
                    >
                      <Files size={14} />
                      查看成果
                    </button>
                    <button type="button" onClick={() => openView("activity")}>
                      完整记录
                      <ChevronRight size={14} />
                    </button>
                  </div>
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
                      {task.status === "失败" && <AlertTriangle size={17} />}
                      {task.status === "已暂停" && <Pause size={17} />}
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
                    <span>{filter}</span>
                    <em>{taskFilterCounts[filter]}</em>
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

            <div className="task-list-controls">
              <label className="task-list-search">
                <Search size={16} />
                <input
                  type="search"
                  aria-label="搜索任务列表"
                  autoComplete="off"
                  placeholder="搜索名称、来源或运行计划"
                  value={taskListQuery}
                  onChange={(event) => setTaskListQuery(event.target.value)}
                />
                {taskListQuery && (
                  <button
                    type="button"
                    aria-label="清除任务搜索"
                    onClick={() => setTaskListQuery("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>

              <label className="task-sort-control">
                <ArrowUpDown size={15} />
                <span>排序</span>
                <select
                  aria-label="任务排序"
                  value={taskSort}
                  onChange={(event) => setTaskSort(event.target.value as TaskSort)}
                >
                  <option value="状态优先">状态优先</option>
                  <option value="进度最高">进度最高</option>
                  <option value="名称">名称</option>
                </select>
              </label>

              <span className="task-result-count" aria-live="polite">
                显示 <strong>{filteredTasks.length}</strong> / {tasks.length} 个任务
              </span>
            </div>

            {selectedTasks.length > 0 && (
              <section
                className="task-bulk-bar"
                role="toolbar"
                aria-label="批量任务操作"
              >
                <div className="task-bulk-summary">
                  <span>
                    <CheckCircle2 size={17} />
                  </span>
                  <span>
                    <strong>已选择 {selectedTasks.length} 个任务</strong>
                    <small>
                      {selectedVisibleTaskCount === selectedTasks.length
                        ? "操作只会影响当前选择"
                        : `其中 ${selectedVisibleTaskCount} 个在当前筛选中`}
                    </small>
                  </span>
                </div>
                <div className="task-bulk-actions">
                  <button
                    className="task-bulk-select-all"
                    type="button"
                    onClick={toggleAllVisibleTasks}
                  >
                    <ListChecks size={15} />
                    {allVisibleTasksSelected ? "取消全选" : "全选当前"}
                  </button>
                  <button
                    type="button"
                    disabled={pausableSelectedTaskCount === 0}
                    onClick={bulkPauseTasks}
                  >
                    <Pause size={15} />
                    暂停
                  </button>
                  <button
                    type="button"
                    disabled={resumableSelectedTaskCount === 0}
                    onClick={bulkResumeTasks}
                  >
                    <Play size={15} />
                    继续
                  </button>
                  <button
                    type="button"
                    disabled={unprotectedSelectedTaskCount === 0}
                    onClick={bulkEnableApproval}
                  >
                    <ShieldCheck size={15} />
                    开启审批
                  </button>
                  <button
                    className="danger"
                    type="button"
                    disabled={deletableSelectedTasks.length === 0}
                    onClick={requestBulkDelete}
                  >
                    <Trash2 size={15} />
                    删除
                  </button>
                  <button
                    className="task-bulk-clear"
                    type="button"
                    aria-label="清除任务选择"
                    title="清除选择"
                    onClick={() => setSelectedTaskIds([])}
                  >
                    <X size={16} />
                  </button>
                </div>
              </section>
            )}

            <div className="task-table">
              <div className="task-table-head">
                <label className="task-selection-control task-select-all">
                  <input
                    type="checkbox"
                    aria-label="选择当前筛选中的全部任务"
                    checked={allVisibleTasksSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate =
                          selectedVisibleTaskCount > 0 &&
                          !allVisibleTasksSelected;
                      }
                    }}
                    onChange={toggleAllVisibleTasks}
                  />
                  <span aria-hidden="true">
                    <Check size={13} />
                  </span>
                </label>
                <span>任务</span>
                <span>状态</span>
                <span>进度</span>
                <span>最后更新</span>
                <span />
              </div>
              {filteredTasks.map((task) => (
                <div
                  className={`task-table-row-shell ${
                    selectedTaskIds.includes(task.id) ? "is-selected" : ""
                  } ${task.status === "失败" ? "is-failed" : ""}`}
                  key={task.id}
                >
                  <label className="task-selection-control">
                    <input
                      type="checkbox"
                      aria-label={`选择任务：${task.title}`}
                      checked={selectedTaskIds.includes(task.id)}
                      onChange={() => toggleTaskSelection(task.id)}
                    />
                    <span aria-hidden="true">
                      <Check size={13} />
                    </span>
                  </label>
                  <button
                    className="task-table-row"
                    type="button"
                    aria-label={`打开任务：${task.title}`}
                    onClick={() => openTask(task.id)}
                  >
                  <span className="task-table-title">
                    <span className="task-table-title-line">
                      <strong>{task.title}</strong>
                      {task.pinned && (
                        <em title="首页主任务">
                          <Pin size={11} />
                          首页任务
                        </em>
                      )}
                    </span>
                    <small>{task.description}</small>
                    {task.status === "失败" && task.lastError && (
                      <small
                        className={`task-table-error ${
                          task.errorCode === "RECOVERY_READY" ? "is-ready" : ""
                        }`}
                      >
                        {task.errorCode === "RECOVERY_READY" ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <AlertTriangle size={12} />
                        )}
                        {task.lastError}
                      </small>
                    )}
                    <small className="task-table-schedule">
                      <CalendarDays size={12} />
                      {formatTaskSchedule(task)}
                    </small>
                  </span>
                  <em className={`status-label status-${task.status}`}>{task.status}</em>
                  <span className="table-progress">
                    <i><b style={{ width: `${task.progress}%` }} /></i>
                    <small>{task.progress}%</small>
                  </span>
                  <span className="task-updated">{task.updated}</span>
                  <ChevronRight size={16} />
                  </button>
                </div>
              ))}
              {filteredTasks.length === 0 && (
                <div className="task-empty-state">
                  <Search size={22} />
                  <strong>
                    {taskListQuery.trim()
                      ? `没有找到“${taskListQuery.trim()}”`
                      : "这个状态下还没有任务"}
                  </strong>
                  <p>
                    {taskListQuery.trim()
                      ? "可以搜索任务名称、来源地址或运行计划。"
                      : "切换状态筛选，查看其他任务。"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (taskListQuery.trim()) {
                        setTaskListQuery("");
                      } else {
                        setTaskFilter("全部");
                      }
                    }}
                  >
                    {taskListQuery.trim() ? "清除搜索" : "查看全部任务"}
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
                <div className="approval-inbox-toolbar">
                  <div className="approval-inbox-overview">
                    <span>
                      <ShieldCheck size={20} />
                    </span>
                    <div>
                      <small>审批收件箱</small>
                      <strong>{approvals.length} 项操作等待决定</strong>
                    </div>
                    <div className="approval-risk-summary" aria-label="待确认风险分布">
                      <span>
                        <i className="risk-dot high" />
                        高风险 {approvalRiskCounts["高风险"]}
                      </span>
                      <span>
                        <i className="risk-dot medium" />
                        中风险 {approvalRiskCounts["中风险"]}
                      </span>
                      <span>
                        <i className="risk-dot low" />
                        低风险 {approvalRiskCounts["低风险"]}
                      </span>
                    </div>
                  </div>
                  <div className="approval-inbox-controls">
                    <label className="approval-list-search">
                      <Search size={16} />
                      <input
                        type="search"
                        aria-label="搜索待确认操作"
                        autoComplete="off"
                        placeholder="搜索操作、对象或关联任务"
                        value={approvalListQuery}
                        onChange={(event) =>
                          setApprovalListQuery(event.target.value)
                        }
                      />
                      {approvalListQuery && (
                        <button
                          type="button"
                          aria-label="清除审批搜索"
                          onClick={() => setApprovalListQuery("")}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <div
                      className="approval-risk-filters"
                      role="tablist"
                      aria-label="审批风险筛选"
                    >
                      {approvalRiskFilters.map((filter) => (
                        <button
                          className={approvalRiskFilter === filter ? "active" : ""}
                          key={filter}
                          type="button"
                          role="tab"
                          aria-selected={approvalRiskFilter === filter}
                          onClick={() => setApprovalRiskFilter(filter)}
                        >
                          {filter}
                          <span>{approvalRiskCounts[filter]}</span>
                        </button>
                      ))}
                    </div>
                    <span className="approval-result-count" aria-live="polite">
                      显示 {filteredApprovals.length} / {approvals.length} 项
                    </span>
                  </div>
                </div>

                {selectedApprovals.length > 0 && (
                  <section
                    className="approval-bulk-bar"
                    role="toolbar"
                    aria-label="批量审批操作"
                  >
                    <div className="approval-bulk-summary">
                      <span>
                        <ListChecks size={17} />
                      </span>
                      <span>
                        <strong>已选择 {selectedApprovals.length} 项操作</strong>
                        <small>
                          {selectedHighRiskApprovalCount
                            ? `${selectedHighRiskApprovalCount} 项高风险操作只能逐项批准`
                            : `涉及 ${selectedApprovalTaskCount} 个任务`}
                        </small>
                      </span>
                    </div>
                    <div className="approval-bulk-actions">
                      <button
                        className="approval-bulk-select-all"
                        type="button"
                        onClick={toggleAllVisibleApprovals}
                      >
                        <ListChecks size={15} />
                        {allVisibleApprovalsSelected ? "取消全选" : "全选当前"}
                      </button>
                      <button
                        className="approve"
                        type="button"
                        disabled={bulkApprovableApprovals.length === 0}
                        onClick={() => requestBulkApprovalDecision("approve")}
                      >
                        <Check size={15} />
                        批量批准
                        {bulkApprovableApprovals.length > 0 &&
                          ` ${bulkApprovableApprovals.length}`}
                      </button>
                      <button
                        className="reject"
                        type="button"
                        onClick={() => requestBulkApprovalDecision("reject")}
                      >
                        <Ban size={15} />
                        批量拒绝 {selectedApprovals.length}
                      </button>
                      <button
                        className="approval-bulk-clear"
                        type="button"
                        aria-label="清除审批选择"
                        title="清除选择"
                        onClick={() => setSelectedApprovalIds([])}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </section>
                )}

                <div className="approval-queue">
                  <div className="approval-queue-heading">
                    <label className="approval-selection-control approval-select-all">
                      <input
                        type="checkbox"
                        aria-label="选择当前筛选中的全部审批"
                        checked={allVisibleApprovalsSelected}
                        ref={(input) => {
                          if (input) {
                            input.indeterminate =
                              selectedVisibleApprovalCount > 0 &&
                              !allVisibleApprovalsSelected;
                          }
                        }}
                        onChange={toggleAllVisibleApprovals}
                      />
                      <span aria-hidden="true">
                        <Check size={13} />
                      </span>
                    </label>
                    <span>审批队列</span>
                    <strong>{filteredApprovals.length} 项</strong>
                  </div>
                  {filteredApprovals.map((item) => (
                    <div
                      className={`approval-queue-row-shell ${
                        selectedApproval?.id === item.id ? "selected" : ""
                      } ${selectedApprovalIds.includes(item.id) ? "is-checked" : ""}`}
                      key={item.id}
                    >
                      <label className="approval-selection-control">
                        <input
                          type="checkbox"
                          aria-label={`选择审批：${item.title}`}
                          checked={selectedApprovalIds.includes(item.id)}
                          onChange={() => toggleApprovalSelection(item.id)}
                        />
                        <span aria-hidden="true">
                          <Check size={13} />
                        </span>
                      </label>
                      <button
                        className="approval-queue-main"
                        type="button"
                        aria-pressed={selectedApproval?.id === item.id}
                        aria-label={`查看审批：${item.title}`}
                        onClick={() => chooseApproval(item.id)}
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
                    </div>
                  ))}
                  {filteredApprovals.length === 0 && (
                    <div className="approval-queue-empty">
                      <Search size={22} />
                      <strong>没有匹配的待确认操作</strong>
                      <small>换一个关键词或风险等级，待确认操作不会被移除。</small>
                      <button
                        type="button"
                        onClick={() => {
                          setApprovalListQuery("");
                          setApprovalRiskFilter("全部");
                        }}
                      >
                        清除筛选
                      </button>
                    </div>
                  )}
                </div>

                {selectedApproval && (
                  <div className="approval-detail" ref={approvalDetailRef}>
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

        {activeView === "artifacts" && (
          <section className="artifacts-view">
            <div className="artifact-overview">
              <div className="artifact-overview-title">
                <span>
                  <Files size={21} />
                </span>
                <div>
                  <small>{artifactScopeTask ? "任务成果" : "成果库"}</small>
                  <h2>
                    {artifactScopeTask
                      ? artifactScopeTask.title
                      : "AI 已交付的工作成果"}
                  </h2>
                  <p>
                    {artifactScopeTask
                      ? "这里只显示当前任务生成的文件和证据。"
                      : "所有成果都保存在本机，并与原始任务和审计记录关联。"}
                  </p>
                </div>
              </div>
              <div className="artifact-overview-metrics">
                <span>
                  <small>全部成果</small>
                  <strong>{artifactStats.total}</strong>
                </span>
                <span>
                  <small>完成报告</small>
                  <strong>{artifactStats.reports}</strong>
                </span>
                <span>
                  <small>截图证据</small>
                  <strong>{artifactStats.evidence}</strong>
                </span>
                <span>
                  <small>本机占用</small>
                  <strong>{artifactStats.size.toFixed(1)} KB</strong>
                </span>
              </div>
            </div>

            <div className="artifact-toolbar">
              <div className="artifact-filter-row">
                <div
                  className="artifact-filter-tabs"
                  role="tablist"
                  aria-label="成果筛选"
                >
                  {artifactFilters.map((filter) => {
                    const count =
                      filter === "全部"
                        ? scopedArtifacts.length
                        : filter === "重点"
                          ? scopedArtifacts.filter((artifact) => artifact.starred)
                              .length
                          : scopedArtifacts.filter(
                              (artifact) => artifact.type === filter,
                            ).length;
                    return (
                      <button
                        className={artifactFilter === filter ? "active" : ""}
                        key={filter}
                        type="button"
                        role="tab"
                        aria-selected={artifactFilter === filter}
                        onClick={() => chooseArtifactFilter(filter)}
                      >
                        {filter === "重点" && <Star size={13} />}
                        {filter}
                        <span>{count}</span>
                      </button>
                    );
                  })}
                </div>
                {artifactScopeTask && (
                  <button
                    className="artifact-scope-clear"
                    type="button"
                    onClick={() => {
                      setArtifactTaskId(null);
                      setArtifactFilter("全部");
                      setSelectedArtifactId(artifacts[0]?.id ?? "");
                    }}
                  >
                    <X size={14} />
                    查看全部任务
                  </button>
                )}
              </div>

              <div className="artifact-list-controls">
                <label className="artifact-list-search">
                  <Search size={16} />
                  <input
                    type="search"
                    aria-label="搜索成果列表"
                    autoComplete="off"
                    placeholder="搜索成果名称、文件名或格式"
                    value={artifactListQuery}
                    onChange={(event) => setArtifactListQuery(event.target.value)}
                  />
                  {artifactListQuery && (
                    <button
                      type="button"
                      aria-label="清除成果搜索"
                      onClick={() => setArtifactListQuery("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>

                <label className="artifact-sort-control">
                  <ArrowUpDown size={15} />
                  <span>排序</span>
                  <select
                    aria-label="成果排序"
                    value={artifactSort}
                    onChange={(event) =>
                      setArtifactSort(event.target.value as ArtifactSort)
                    }
                  >
                    <option value="最近更新">最近更新</option>
                    <option value="重点优先">重点优先</option>
                    <option value="文件名">文件名</option>
                  </select>
                </label>

                <span className="artifact-result-count" aria-live="polite">
                  显示 {filteredArtifacts.length} / {scopedArtifacts.length} 项
                </span>
              </div>
            </div>

            <div className="artifact-workspace">
              <aside className="artifact-list" aria-label="成果列表">
                <div className="artifact-list-heading">
                  <span>
                    <strong>成果列表</strong>
                    <small>{artifactSort}</small>
                  </span>
                  <em>{filteredArtifacts.length} 项</em>
                </div>
                <div className="artifact-list-items">
                  {filteredArtifacts.map((artifact) => {
                    const ArtifactIcon = artifactIconMap[artifact.type];
                    return (
                      <div
                        className={`artifact-list-row ${
                          selectedArtifact?.id === artifact.id ? "selected" : ""
                        }`}
                        key={artifact.id}
                      >
                        <button
                          className="artifact-list-main"
                          type="button"
                          onClick={() => setSelectedArtifactId(artifact.id)}
                        >
                          <span className={`artifact-type-icon type-${artifact.type}`}>
                            <ArtifactIcon size={18} />
                          </span>
                          <span className="artifact-list-copy">
                            <span>
                              <em>{artifact.type}</em>
                              <small>{artifact.updated}</small>
                            </span>
                            <strong>{artifact.title}</strong>
                            <span className="artifact-file-meta">
                              <small>{artifact.filename}</small>
                              <em>
                                {artifact.format} · {artifact.sizeKb.toFixed(1)} KB
                              </em>
                            </span>
                          </span>
                        </button>
                        <button
                          className={`artifact-star ${artifact.starred ? "active" : ""}`}
                          type="button"
                          aria-label={
                            artifact.starred
                              ? `取消重点标记：${artifact.title}`
                              : `标记为重点：${artifact.title}`
                          }
                          title={artifact.starred ? "取消重点" : "标记为重点"}
                          onClick={() => toggleArtifactStar(artifact)}
                        >
                          <Star size={15} fill={artifact.starred ? "currentColor" : "none"} />
                        </button>
                      </div>
                    );
                  })}
                  {filteredArtifacts.length === 0 && (
                    <div className="artifact-list-empty">
                      {artifactListQuery.trim() ? <Search size={22} /> : <Files size={22} />}
                      <strong>
                        {artifactListQuery.trim()
                          ? `没有找到“${artifactListQuery.trim()}”`
                          : "这个分类还没有成果"}
                      </strong>
                      <small>
                        {artifactListQuery.trim()
                          ? "可以尝试成果名称、文件名、格式或关联任务。"
                          : "切换到其他分类查看已有交付文件。"}
                      </small>
                      <button
                        type="button"
                        onClick={() =>
                          artifactListQuery.trim()
                            ? setArtifactListQuery("")
                            : chooseArtifactFilter("全部")
                        }
                      >
                        {artifactListQuery.trim() ? "清除搜索" : "查看全部成果"}
                      </button>
                    </div>
                  )}
                </div>
              </aside>

              {selectedArtifact ? (
                <article className="artifact-preview">
                  <header className="artifact-preview-heading">
                    <div>
                      <span className={`artifact-preview-icon type-${selectedArtifact.type}`}>
                        <SelectedArtifactIcon size={22} />
                      </span>
                      <span>
                        <small>
                          {selectedArtifact.type} · {selectedArtifact.status}
                        </small>
                        <h2>{selectedArtifact.title}</h2>
                        <p>{selectedArtifact.description}</p>
                      </span>
                    </div>
                    <div className="artifact-preview-actions" aria-label="成果操作">
                      {artifactCanBeEdited(selectedArtifact) && (
                        <button
                          className="edit"
                          type="button"
                          onClick={() => openArtifactEditor(selectedArtifact)}
                        >
                          <Pencil size={16} />
                          <span>编辑</span>
                        </button>
                      )}
                      <button
                        className={selectedArtifact.starred ? "active" : ""}
                        type="button"
                        aria-label={
                          selectedArtifact.starred
                            ? "取消重点标记"
                            : "标记为重点"
                        }
                        title={
                          selectedArtifact.starred ? "取消重点" : "标记为重点"
                        }
                        onClick={() => toggleArtifactStar(selectedArtifact)}
                      >
                        <Star
                          size={16}
                          fill={selectedArtifact.starred ? "currentColor" : "none"}
                        />
                        <span>{selectedArtifact.starred ? "取消重点" : "重点"}</span>
                      </button>
                      <button
                        type="button"
                        aria-label="复制成果内容"
                        title="复制内容"
                        onClick={() => copyArtifactContent(selectedArtifact)}
                      >
                        <Copy size={16} />
                        <span>复制</span>
                      </button>
                      <button
                        className="delete"
                        type="button"
                        aria-label="删除成果"
                        title="删除成果"
                        onClick={() => requestDeleteArtifact(selectedArtifact)}
                      >
                        <Trash2 size={16} />
                        <span>删除</span>
                      </button>
                      <button
                        className="download"
                        type="button"
                        onClick={() => downloadArtifact(selectedArtifact)}
                      >
                        <Download size={16} />
                        下载
                      </button>
                    </div>
                  </header>

                  <div className="artifact-preview-meta">
                    <span>
                      <small>文件名</small>
                      <strong>{selectedArtifact.filename}</strong>
                    </span>
                    <span>
                      <small>格式</small>
                      <strong>
                        {selectedArtifact.format} ·{" "}
                        {selectedArtifact.sizeKb.toFixed(1)} KB
                      </strong>
                    </span>
                    <span>
                      <small>当前版本</small>
                      <strong>v{selectedArtifact.version ?? 1}</strong>
                    </span>
                    <span>
                      <small>最近更新</small>
                      <strong>{selectedArtifact.updated}</strong>
                    </span>
                  </div>

                  <div className="artifact-highlights" aria-label="成果摘要">
                    {selectedArtifact.highlights.map((highlight) => (
                      <span key={highlight}>
                        <CheckCircle2 size={14} />
                        {highlight}
                      </span>
                    ))}
                  </div>

                  <section className="artifact-content-preview">
                    <div>
                      <span>内容预览</span>
                      <em>
                        v{selectedArtifact.version ?? 1} ·{" "}
                        {artifactCanBeEdited(selectedArtifact)
                          ? "可修订"
                          : "原始记录只读"}
                      </em>
                    </div>
                    {selectedArtifact.table ? (
                      <div className="artifact-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              {selectedArtifact.table.columns.map((column) => (
                                <th key={column}>{column}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedArtifact.table.rows.map((row, rowIndex) => (
                              <tr key={`${selectedArtifact.id}-${rowIndex}`}>
                                {row.map((cell, cellIndex) => (
                                  <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <pre>{selectedArtifact.content}</pre>
                    )}
                  </section>

                  <footer className="artifact-preview-footer">
                    <span>
                      <ShieldCheck size={16} />
                      <span>
                        <small>来源已验证</small>
                        <strong>
                          {tasks.find(
                            (task) => task.id === selectedArtifact.taskId,
                          )?.title ?? selectedArtifact.taskId}
                        </strong>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => openTask(selectedArtifact.taskId)}
                    >
                      查看关联任务
                      <ChevronRight size={14} />
                    </button>
                  </footer>
                </article>
              ) : (
                <div className="artifact-preview-empty">
                  <Files size={28} />
                  <strong>选择一个成果查看内容</strong>
                  <p>切换筛选条件，或从任务详情进入对应成果。</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeView === "activity" && (
          <section className="activity-view">
            <div className="activity-toolbar">
              <div className="activity-toolbar-primary">
                <div className="activity-toolbar-title">
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
                  导出全部
                </button>
              </div>

              <div className="activity-list-controls">
                <label className="activity-list-search">
                  <Search size={16} />
                  <input
                    type="search"
                    aria-label="搜索运行记录"
                    autoComplete="off"
                    placeholder="搜索事件、任务或事件 ID"
                    value={activityListQuery}
                    onChange={(event) => setActivityListQuery(event.target.value)}
                  />
                  {activityListQuery && (
                    <button
                      type="button"
                      aria-label="清除运行记录搜索"
                      onClick={() => setActivityListQuery("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>

                <label className="activity-sort-control">
                  <ArrowUpDown size={15} />
                  <span>时间</span>
                  <select
                    aria-label="运行记录排序"
                    value={activitySort}
                    onChange={(event) =>
                      setActivitySort(event.target.value as ActivitySort)
                    }
                  >
                    <option value="最新优先">最新优先</option>
                    <option value="最早优先">最早优先</option>
                  </select>
                </label>

                <span className="activity-result-count" aria-live="polite">
                  显示 {filteredActivityLog.length} / {scopedActivityLog.length} 条
                </span>
              </div>
            </div>

            <div className="activity-summary">
              <Activity size={18} />
              <div>
                <strong>
                  {activityTask?.title ?? "所有任务与系统事件"}
                </strong>
                <small>
                  {activityTask
                    ? `${formatTaskSchedule(activityTask)} · 仅显示此任务的记录`
                    : "任务执行、审批决定和系统变更都保存在这条时间线上"}
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
                    activityTask && activityTask.status !== "运行中" ? "paused" : ""
                  }`}
                >
                  <i />
                  {activityTask?.status ?? "持续记录"}
                </span>
              </div>
            </div>

            <div className="activity-workspace">
              <div className="activity-timeline" aria-live="polite">
                {filteredActivityLog.map((item) => {
                  const ItemIcon = activityIconMap[item.icon] ?? Activity;
                  const itemTask = item.taskId
                    ? tasks.find((task) => task.id === item.taskId) ?? null
                    : null;
                  return (
                    <div
                      className={`timeline-row ${
                        selectedActivity?.id === item.id ? "selected" : ""
                      }`}
                      key={item.id}
                    >
                      <time dateTime={item.createdAt}>{item.time}</time>
                      <button
                        className="timeline-row-main"
                        type="button"
                        aria-pressed={selectedActivity?.id === item.id}
                        onClick={() => selectActivityItem(item)}
                      >
                        <span className={`timeline-icon ${item.tone}`}>
                          <ItemIcon size={17} />
                        </span>
                        <span className="timeline-content">
                          <span className={`timeline-kind kind-${item.kind}`}>
                            {item.kind}
                          </span>
                          <strong>{item.title}</strong>
                          <p>{item.detail}</p>
                          <small>
                            {itemTask?.title ??
                              (item.kind === "系统" ? "工作区系统" : "无关联任务")}
                          </small>
                        </span>
                      </button>
                      <button
                        className="timeline-detail-button"
                        type="button"
                        onClick={() => selectActivityItem(item)}
                      >
                        查看详情
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  );
                })}
                {filteredActivityLog.length === 0 && (
                  <div className="activity-empty">
                    <Search size={22} />
                    <strong>
                      {activityListQuery.trim()
                        ? `没有找到“${activityListQuery.trim()}”`
                        : activityTask
                          ? activityFilter === "全部"
                            ? "这个任务还没有运行记录"
                            : "这个任务还没有此类记录"
                          : "这个分类还没有记录"}
                    </strong>
                    <small>
                      {activityListQuery.trim()
                        ? "可以尝试事件标题、任务名称或事件 ID。"
                        : "切换分类或查看全部任务的审计记录。"}
                    </small>
                    <button
                      type="button"
                      onClick={() => {
                        if (activityListQuery.trim()) {
                          setActivityListQuery("");
                        } else if (activityFilter !== "全部") {
                          setActivityFilter("全部");
                        } else {
                          setActivityTaskId(null);
                        }
                      }}
                    >
                      {activityListQuery.trim()
                        ? "清除搜索"
                        : activityFilter !== "全部"
                          ? "查看此任务全部记录"
                          : "查看全部任务"}
                    </button>
                  </div>
                )}
              </div>

              {selectedActivity ? (
                <aside
                  className="activity-inspector"
                  ref={activityInspectorRef}
                  tabIndex={-1}
                  aria-label="审计事件详情"
                >
                  <header className="activity-inspector-heading">
                    <span className={`timeline-icon ${selectedActivity.tone}`}>
                      <SelectedActivityIcon size={19} />
                    </span>
                    <div>
                      <small>
                        {selectedActivity.kind}事件 · 已记录
                      </small>
                      <h2>{selectedActivity.title}</h2>
                    </div>
                  </header>

                  <p className="activity-inspector-detail">
                    {selectedActivity.detail}
                  </p>

                  <div className="activity-inspector-facts">
                    <span>
                      <small>发生时间</small>
                      <strong>
                        {formatAuditTimestamp(selectedActivity.createdAt)}
                      </strong>
                    </span>
                    <span>
                      <small>事件类型</small>
                      <strong>{selectedActivity.kind}</strong>
                    </span>
                    <span>
                      <small>关联对象</small>
                      <strong>
                        {selectedActivityTask?.title ?? "全局工作区"}
                      </strong>
                    </span>
                    <span>
                      <small>触发来源</small>
                      <strong>
                        {selectedActivity.kind === "任务"
                          ? "任务执行引擎"
                          : selectedActivity.kind === "审批"
                            ? "审批策略引擎"
                            : "工作区系统"}
                      </strong>
                    </span>
                  </div>

                  <div className="activity-event-id">
                    <span>
                      <small>事件 ID</small>
                      <code>{selectedActivity.id}</code>
                    </span>
                    <button
                      type="button"
                      aria-label="复制事件 ID"
                      title="复制事件 ID"
                      onClick={() => copyActivityId(selectedActivity)}
                    >
                      <Copy size={15} />
                    </button>
                  </div>

                  <div className="activity-integrity">
                    <ShieldCheck size={18} />
                    <span>
                      <strong>审计记录已写入本机</strong>
                      <small>事件时间、来源和关联对象可随工作区一起导出。</small>
                    </span>
                  </div>

                  <footer className="activity-inspector-actions">
                    <button
                      type="button"
                      onClick={() => exportActivityItem(selectedActivity)}
                    >
                      <Download size={15} />
                      导出此事件
                    </button>
                    <button
                      className="primary"
                      type="button"
                      onClick={() => openActivityItem(selectedActivity)}
                    >
                      {selectedActivityTask
                        ? "打开关联任务"
                        : selectedActivity.kind === "审批"
                          ? "查看审批队列"
                          : "打开系统设置"}
                      <ChevronRight size={14} />
                    </button>
                  </footer>
                </aside>
              ) : (
                <div className="activity-inspector-empty">
                  <History size={24} />
                  <strong>选择一条记录查看审计详情</strong>
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
                      ? "任务、成果、审批和运行记录会自动保存在这台设备。"
                      : "当前数据仍可使用，但关闭页面后不会自动恢复。"}
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

            <section
              id="settings-usage"
              className={`settings-usage-center ${
                budgetExceeded
                  ? "is-over"
                  : budgetAlertReached
                    ? "is-alert"
                    : ""
              }`}
            >
              <header className="settings-usage-heading">
                <div>
                  <span>用量与预算</span>
                  <h2>看清 AI 消耗，并在超额前自动保护</h2>
                  <p>本月额度根据任务执行、连接器调用和本机成果记录实时估算。</p>
                </div>
                <div className="settings-usage-heading-actions">
                  <span className="settings-plan-badge">
                    <Sparkles size={15} />
                    Team 方案
                  </span>
                  <button type="button" onClick={exportUsageReport}>
                    <Download size={15} />
                    导出用量
                  </button>
                  <button className="primary" type="button" onClick={openUsageBudget}>
                    <Pencil size={15} />
                    调整预算
                  </button>
                </div>
              </header>

              <div className="settings-usage-layout">
                <div className="usage-meter-panel">
                  <div className="usage-meter-heading">
                    <span>
                      <small>本月已使用</small>
                      <strong>
                        {usedCredits}
                        <em> 点</em>
                      </strong>
                    </span>
                    <span>
                      <small>月度预算</small>
                      <strong>
                        {usageSettings.monthlyBudget}
                        <em> 点</em>
                      </strong>
                    </span>
                  </div>
                  <div
                    className="usage-budget-track"
                    role="progressbar"
                    aria-label="本月 AI 额度使用"
                    aria-valuemin={0}
                    aria-valuemax={usageSettings.monthlyBudget}
                    aria-valuenow={Math.min(
                      usedCredits,
                      usageSettings.monthlyBudget,
                    )}
                  >
                    <span style={{ width: `${usagePercent}%` }} />
                    <i
                      style={{
                        left: `${Math.min(100, usageSettings.alertThreshold)}%`,
                      }}
                      title={`${usageSettings.alertThreshold}% 提醒线`}
                    />
                  </div>
                  <div className="usage-meter-legend">
                    <span>{usagePercent}% 已使用</span>
                    <span>{usageSettings.alertThreshold}% 提醒</span>
                  </div>
                  <div className="usage-forecast">
                    <span>
                      <Activity size={16} />
                      <span>
                        <small>月底预计</small>
                        <strong>{forecastCredits} 点</strong>
                      </span>
                    </span>
                    <span>
                      <Clock3 size={16} />
                      <span>
                        <small>额度刷新</small>
                        <strong>8 月 1 日</strong>
                      </span>
                    </span>
                  </div>
                  {budgetAlertReached && (
                    <div className="usage-budget-alert" role="status">
                      <AlertTriangle size={16} />
                      <span>
                        <strong>
                          {budgetExceeded ? "已达到月度预算" : "用量已超过提醒线"}
                        </strong>
                        <small>
                          {usageSettings.pauseAtLimit
                            ? "到达 100% 后会自动暂停运行中的任务。"
                            : "当前未开启到限自动暂停，请关注后续消耗。"}
                        </small>
                      </span>
                    </div>
                  )}
                </div>

                <div className="usage-breakdown-panel">
                  <div className="usage-section-heading">
                    <span>消耗分布</span>
                    <strong>{usageBreakdown.length} 类</strong>
                  </div>
                  <div className="usage-breakdown-list">
                    {usageBreakdown.map((item) => {
                      const UsageIcon = item.icon;
                      const share = Math.round(
                        (item.credits / Math.max(1, usedCredits)) * 100,
                      );
                      return (
                        <div className={`tone-${item.tone}`} key={item.id}>
                          <span className="usage-breakdown-icon">
                            <UsageIcon size={16} />
                          </span>
                          <span className="usage-breakdown-copy">
                            <span>
                              <strong>{item.label}</strong>
                              <em>{item.credits} 点</em>
                            </span>
                            <small>{item.detail}</small>
                            <i>
                              <span style={{ width: `${Math.max(5, share)}%` }} />
                            </i>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <aside className="usage-guard-panel">
                  <div className="usage-section-heading">
                    <span>预算保护</span>
                    <strong>{budgetExceeded ? "已触发" : "运行中"}</strong>
                  </div>
                  <div className="usage-guard-list">
                    <div>
                      <Bell size={17} />
                      <span>
                        <small>用量提醒</small>
                        <strong>达到 {usageSettings.alertThreshold}% 时提醒</strong>
                      </span>
                    </div>
                    <div>
                      <Pause size={17} />
                      <span>
                        <small>到限处理</small>
                        <strong>
                          {usageSettings.pauseAtLimit
                            ? "自动暂停运行中任务"
                            : "继续运行并仅显示提醒"}
                        </strong>
                      </span>
                    </div>
                    <div>
                      <ShieldCheck size={17} />
                      <span>
                        <small>影响范围</small>
                        <strong>只影响当前工作区</strong>
                      </span>
                    </div>
                  </div>
                  <button type="button" onClick={openUsageBudget}>
                    <Settings2 size={15} />
                    管理预算保护
                    <ChevronRight size={15} />
                  </button>
                </aside>
              </div>

              <footer className="settings-usage-footnote">
                <ShieldCheck size={15} />
                <span>
                  用量为本机运行记录估算，不包含未连接服务的外部账单；预算变更会写入审计记录。
                </span>
              </footer>
            </section>

            <section className="settings-team-center" id="settings-team">
              <header className="settings-team-heading">
                <div>
                  <span>团队与权限</span>
                  <h2>知道谁可以查看、修改和审批</h2>
                  <p>成员角色会直接决定任务、成果和外部操作的访问边界。</p>
                </div>
                <button type="button" onClick={openTeamInvite}>
                  <UserPlus size={16} />
                  邀请成员
                </button>
              </header>

              <div className="settings-team-summary" aria-label="团队概览">
                <span>
                  <Users size={18} />
                  <span>
                    <small>工作区成员</small>
                    <strong>{teamMembers.length} 位</strong>
                  </span>
                </span>
                <span>
                  <ShieldCheck size={18} />
                  <span>
                    <small>可以审批</small>
                    <strong>{approverMemberCount} 位</strong>
                  </span>
                </span>
                <span>
                  <Activity size={18} />
                  <span>
                    <small>当前在线</small>
                    <strong>{onlineMemberCount} 位</strong>
                  </span>
                </span>
                <span>
                  <CheckCircle2 size={18} />
                  <span>
                    <small>安全策略</small>
                    <strong>已生效</strong>
                  </span>
                </span>
              </div>

              <div className="settings-team-table">
                <div className="settings-team-table-head" aria-hidden="true">
                  <span>成员</span>
                  <span>角色与权限</span>
                  <span>状态</span>
                  <span>最近活动</span>
                  <span>操作</span>
                </div>
                <div className="settings-team-list">
                  {teamMembers.map((member) => (
                    <article className="settings-team-row" key={member.id}>
                      <div className="settings-team-identity">
                        <span className={`settings-team-avatar tone-${member.tone}`}>
                          {member.avatar}
                          <i className={`status-${member.status}`} />
                        </span>
                        <span>
                          <strong>
                            {member.name}
                            {member.role === "所有者" && <em>你</em>}
                          </strong>
                          <small>{member.email}</small>
                        </span>
                      </div>
                      <div className="settings-team-role">
                        <strong>{member.role}</strong>
                        <small>{teamRoleDetails[member.role].summary}</small>
                      </div>
                      <span
                        className={`settings-team-member-status status-${member.status}`}
                      >
                        <i />
                        {member.status}
                      </span>
                      <span className="settings-team-last-active">
                        <Clock3 size={14} />
                        {member.lastActive}
                      </span>
                      <button
                        type="button"
                        aria-label={`管理成员：${member.name}`}
                        onClick={() => openTeamMember(member)}
                      >
                        管理
                        <ChevronRight size={15} />
                      </button>
                    </article>
                  ))}
                </div>
              </div>

              <footer className="settings-team-footnote">
                <ShieldCheck size={16} />
                <span>只有所有者和管理员可以邀请成员或修改角色。</span>
              </footer>
            </section>

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
                  <strong>关闭页面后保留工作区</strong>
                  <small>
                    开启后，任务、成果和运行记录会在下次打开时自动恢复。
                  </small>
                </span>
                <button
                  className={`switch-control ${settings.local ? "on" : ""}`}
                  type="button"
                  role="switch"
                  aria-checked={settings.local}
                  aria-label="关闭页面后保留工作区"
                  onClick={requestToggleLocalPersistence}
                >
                  <i />
                </button>
              </label>
              <label className="setting-row">
                <span>
                  <strong>需要确认时通知</strong>
                  <small>{desktopNotificationPreferenceDetail}</small>
                </span>
                <button
                  className={`switch-control ${settings.notifications ? "on" : ""}`}
                  type="button"
                  role="switch"
                  aria-checked={settings.notifications}
                  aria-label="需要确认时发送桌面通知"
                  aria-busy={isRequestingNotificationPermission}
                  disabled={
                    isRequestingNotificationPermission ||
                    desktopNotificationPermission === "checking"
                  }
                  onClick={toggleDesktopNotifications}
                >
                  <i />
                </button>
              </label>
            </div>

            <div
              className="settings-group workspace-data-group"
              id="settings-data"
            >
              <div>
                <span>数据与恢复</span>
                <h2>备份或迁移工作区</h2>
              </div>
              <div
                className={`workspace-data-summary ${
                  settings.local ? "" : "is-temporary"
                }`}
              >
                <span>
                  {settings.local ? <HardDrive size={18} /> : <Timer size={18} />}
                </span>
                <div>
                  <strong>
                    {settings.local
                      ? `约 ${workspaceDataSize} KB 本机数据`
                      : "当前更改仅保留在本次会话"}
                  </strong>
                  <small>
                    {settings.local
                      ? "备份包含任务、成果、团队成员、审批状态、运行记录和全部设置。"
                      : "关闭页面前可以导出备份，或重新开启本机持久保存。"}
                  </small>
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
            </div>

            <section
              className="settings-connectors-center"
              id="settings-connectors"
            >
              <header className="settings-connectors-heading">
                <div>
                  <span>能力连接</span>
                  <h2>AI 当前可以使用这些工具</h2>
                  <p>查看每项能力的授权范围、使用状态，并随时测试或断开连接。</p>
                </div>
                <span
                  className={`settings-connectors-state ${
                    connectorIssueCount > 0 ? "is-attention" : ""
                  }`}
                >
                  {connectorIssueCount > 0 ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <Link2 size={16} />
                  )}
                  {connectorIssueCount > 0
                    ? `${connectorIssueCount} 项需要处理 · ${healthyConnectorCount} / ${connectorCatalog.length} 可用`
                    : `${healthyConnectorCount} / ${connectorCatalog.length} 项可用`}
                </span>
              </header>

              <div className="settings-connector-grid">
                {connectorCatalog.map((connector) => {
                  const ConnectorIcon = connector.icon;
                  const connected = connectorStates[connector.id];
                  const usageCount = connectorUsageCounts[connector.id];
                  const issueTasks = connectorIssueTasks[connector.id];
                  const hasIssue = issueTasks.length > 0;
                  return (
                    <article
                      className={`settings-connector-card tone-${connector.tone} ${
                        hasIssue
                          ? "is-attention"
                          : connected
                            ? "is-connected"
                            : "is-disconnected"
                      }`}
                      key={connector.id}
                    >
                      <div className="settings-connector-card-top">
                        <span className="settings-connector-icon">
                          <ConnectorIcon size={20} />
                        </span>
                        <span
                          className={`settings-connector-status ${
                            hasIssue ? "is-attention" : ""
                          }`}
                        >
                          <i />
                          {hasIssue
                            ? "需要重新授权"
                            : connected
                              ? "已连接"
                              : "未连接"}
                        </span>
                      </div>
                      <div className="settings-connector-copy">
                        <h3>{connector.name}</h3>
                        <p>{connector.description}</p>
                      </div>
                      <div className="settings-connector-facts">
                        <span>
                          <small>授权范围</small>
                          <strong>
                            {hasIssue
                              ? "授权已失效"
                              : connected
                                ? connector.scope
                                : "尚未授权"}
                          </strong>
                        </span>
                        <span>
                          <small>关联任务</small>
                          <strong>{usageCount} 个</strong>
                        </span>
                      </div>
                      <div className="settings-connector-footer">
                        <small>
                          {hasIssue
                            ? `${issueTasks[0].title} 已安全停止`
                            : connected
                              ? connector.lastUsed
                              : "连接后才会用于任务"}
                        </small>
                        <button
                          type="button"
                          onClick={() => openConnector(connector.id)}
                        >
                          {hasIssue ? "修复" : connected ? "管理" : "连接"}
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="settings-trust-center">
              <header className="settings-trust-heading">
                <div>
                  <span>执行边界与审计</span>
                  <h2>确认 AI 能做什么，以及刚刚做了什么</h2>
                  <p>这里汇总当前工作区真正生效的规则，不展示未连接的能力。</p>
                </div>
                <span className="settings-trust-state">
                  <CheckCircle2 size={16} />
                  规则已生效
                </span>
              </header>

              <div className="settings-trust-layout">
                <div className="settings-policy-list" aria-label="当前执行规则">
                  <div className="settings-policy-row">
                    <span className="settings-policy-icon approval">
                      <ShieldCheck size={19} />
                    </span>
                    <div>
                      <span>审批保护</span>
                      <strong>
                        {settings.approval ? "新任务默认需要确认" : "新任务默认自动执行"}
                      </strong>
                      <small>
                        {protectedTaskCount} / {tasks.length} 个现有任务保留审批边界
                      </small>
                    </div>
                    <em className={settings.approval ? "is-safe" : "is-caution"}>
                      {settings.approval ? "默认开启" : "默认关闭"}
                    </em>
                    <button
                      type="button"
                      onClick={() =>
                        openView(approvals.length > 0 ? "approvals" : "tasks")
                      }
                    >
                      {approvals.length > 0
                        ? `查看 ${approvals.length} 项待确认`
                        : "查看任务规则"}
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  <div className="settings-policy-row">
                    <span className="settings-policy-icon storage">
                      <HardDrive size={19} />
                    </span>
                    <div>
                      <span>工作区保存</span>
                      <strong>
                        {settings.local ? "数据保存在这台设备" : "当前是临时会话"}
                      </strong>
                      <small>
                        {settings.local
                          ? `约 ${workspaceDataSize} KB，可随时导出迁移`
                          : "关闭页面前请先导出需要保留的数据"}
                      </small>
                    </div>
                    <em className={settings.local ? "is-safe" : "is-caution"}>
                      {settings.local ? "本机保存" : "临时模式"}
                    </em>
                    <button
                      type="button"
                      onClick={
                        settings.local ? exportWorkspace : requestToggleLocalPersistence
                      }
                    >
                      {settings.local ? "立即备份" : "开启保存"}
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  <div className="settings-policy-row">
                    <span className="settings-policy-icon notification">
                      <Bell size={19} />
                    </span>
                    <div>
                      <span>确认提醒</span>
                      <strong>{desktopNotificationSummary}</strong>
                      <small>只影响后续需要你决定的任务，不改变执行规则</small>
                    </div>
                    <em className={desktopNotificationStateClass}>
                      {desktopNotificationStateLabel}
                    </em>
                    <button
                      type="button"
                      aria-busy={isRequestingNotificationPermission}
                      disabled={
                        isRequestingNotificationPermission ||
                        desktopNotificationPermission === "checking"
                      }
                      onClick={toggleDesktopNotifications}
                    >
                      {isRequestingNotificationPermission
                        ? "等待授权"
                        : desktopNotificationActionLabel}
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>

                <div className="settings-audit-preview">
                  <div className="settings-audit-heading">
                    <div>
                      <span>最近安全事件</span>
                      <strong>{settingsAuditItems.length} 条可追溯记录</strong>
                    </div>
                    <History size={18} />
                  </div>
                  <div className="settings-audit-list">
                    {settingsAuditItems.map((item) => {
                      const ItemIcon = activityIconMap[item.icon] ?? Activity;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openActivityItem(item)}
                        >
                          <span className={`tone-${item.tone}`}>
                            <ItemIcon size={16} />
                          </span>
                          <span>
                            <small>
                              {item.kind} · {item.time}
                            </small>
                            <strong>{item.title}</strong>
                          </span>
                          <ChevronRight size={15} />
                        </button>
                      );
                    })}
                    {settingsAuditItems.length === 0 && (
                      <div className="settings-audit-empty">
                        <CheckCircle2 size={19} />
                        <strong>还没有安全事件</strong>
                        <small>审批、设置和系统变更会自动记录在这里。</small>
                      </div>
                    )}
                  </div>
                  <button
                    className="settings-audit-open"
                    type="button"
                    onClick={() => {
                      setActivityFilter("全部");
                      openView("activity");
                    }}
                  >
                    <History size={16} />
                    打开完整运行记录
                  </button>
                </div>
              </div>
            </section>
          </section>
        )}
      </section>

      {teamInviteOpen && (
        <div
          className="clarity-dialog-backdrop team-dialog-backdrop"
          onMouseDown={closeTeamInvite}
        >
          <form
            className="team-invite-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-invite-title"
            aria-describedby="team-invite-description"
            aria-busy={isSendingInvite}
            onSubmit={inviteTeamMember}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="team-dialog-close"
              type="button"
              aria-label="关闭邀请成员"
              onClick={closeTeamInvite}
            >
              <X size={17} />
            </button>
            <header className="team-dialog-heading">
              <span className="team-dialog-icon">
                <UserPlus size={22} />
              </span>
              <div>
                <span>团队协作</span>
                <h2 id="team-invite-title">邀请成员加入工作区</h2>
                <p id="team-invite-description">
                  发送邀请前先选择角色，成员接受后会获得对应权限。
                </p>
              </div>
            </header>

            <div className="team-invite-fields">
              <label
                className={
                  inviteFormSubmitted && teamInviteFormErrors.name
                    ? "has-error"
                    : ""
                }
              >
                <span>成员姓名</span>
                <input
                  type="text"
                  value={inviteName}
                  disabled={isSendingInvite}
                  data-overlay-initial-focus
                  aria-invalid={
                    inviteFormSubmitted && Boolean(teamInviteFormErrors.name)
                  }
                  aria-describedby={
                    inviteFormSubmitted && teamInviteFormErrors.name
                      ? "team-invite-name-error"
                      : undefined
                  }
                  placeholder="例如：张宁"
                  onChange={(event) => {
                    setInviteName(event.target.value);
                    if (inviteFormSubmitted) setInviteFormSubmitted(false);
                  }}
                />
                {inviteFormSubmitted && teamInviteFormErrors.name && (
                  <small id="team-invite-name-error">
                    {teamInviteFormErrors.name}
                  </small>
                )}
              </label>
              <label
                className={
                  inviteFormSubmitted && teamInviteFormErrors.email
                    ? "has-error"
                    : ""
                }
              >
                <span>工作邮箱</span>
                <input
                  type="email"
                  value={inviteEmail}
                  disabled={isSendingInvite}
                  aria-invalid={
                    inviteFormSubmitted && Boolean(teamInviteFormErrors.email)
                  }
                  aria-describedby={
                    inviteFormSubmitted && teamInviteFormErrors.email
                      ? "team-invite-email-error"
                      : undefined
                  }
                  placeholder="name@company.com"
                  onChange={(event) => {
                    setInviteEmail(event.target.value);
                    if (inviteFormSubmitted) setInviteFormSubmitted(false);
                  }}
                />
                {inviteFormSubmitted && teamInviteFormErrors.email && (
                  <small id="team-invite-email-error">
                    {teamInviteFormErrors.email}
                  </small>
                )}
              </label>
              <label>
                <span>成员角色</span>
                <select
                  value={inviteRole}
                  disabled={isSendingInvite}
                  onChange={(event) =>
                    setInviteRole(event.target.value as TeamRole)
                  }
                >
                  {(["管理员", "审批者", "成员"] as TeamRole[]).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="team-role-preview">
              <div>
                <ShieldCheck size={17} />
                <span>
                  <small>{inviteRole}权限</small>
                  <strong>{teamRoleDetails[inviteRole].summary}</strong>
                </span>
              </div>
              <div>
                {teamRoleDetails[inviteRole].permissions.map((permission) => (
                  <span key={permission}>
                    <Check size={14} />
                    {permission}
                  </span>
                ))}
              </div>
            </div>

            {inviteFormSubmitted && teamInviteFormHasErrors && (
              <div className="team-form-error-summary" role="alert">
                <AlertTriangle size={16} />
                请先修正上方信息，再发送邀请。
              </div>
            )}

            <footer className="team-dialog-actions">
              <button
                type="button"
                disabled={isSendingInvite}
                onClick={closeTeamInvite}
              >
                取消
              </button>
              <button
                className="primary"
                type="submit"
                disabled={isSendingInvite}
              >
                {isSendingInvite ? (
                  <LoaderCircle className="is-spinning" size={16} />
                ) : (
                  <Send size={16} />
                )}
                {isSendingInvite ? "正在发送" : "发送邀请"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {selectedTeamMember && (
        <div
          className="clarity-dialog-backdrop team-dialog-backdrop"
          onMouseDown={closeTeamMember}
        >
          <section
            className="team-member-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-member-title"
            aria-describedby="team-member-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="team-dialog-close"
              type="button"
              aria-label="关闭成员管理"
              onClick={closeTeamMember}
            >
              <X size={17} />
            </button>
            <header className="team-member-heading">
              <span
                className={`team-member-avatar tone-${selectedTeamMember.tone}`}
              >
                {selectedTeamMember.avatar}
              </span>
              <div>
                <span>成员权限</span>
                <h2 id="team-member-title">{selectedTeamMember.name}</h2>
                <p id="team-member-description">{selectedTeamMember.email}</p>
              </div>
              <span
                className={`team-member-dialog-status status-${selectedTeamMember.status}`}
              >
                <i />
                {selectedTeamMember.status}
              </span>
            </header>

            <div className="team-member-facts">
              <span>
                <small>当前角色</small>
                <strong>{selectedTeamMember.role}</strong>
              </span>
              <span>
                <small>最近活动</small>
                <strong>{selectedTeamMember.lastActive}</strong>
              </span>
              <span>
                <small>审批权限</small>
                <strong>
                  {["所有者", "管理员", "审批者"].includes(
                    selectedTeamMember.role,
                  )
                    ? "可以审批"
                    : "不可审批"}
                </strong>
              </span>
            </div>

            <div className="team-member-role-editor">
              <label>
                <span>工作区角色</span>
                <select
                  value={memberRoleDraft}
                  disabled={selectedTeamMember.role === "所有者"}
                  onChange={(event) =>
                    setMemberRoleDraft(event.target.value as TeamRole)
                  }
                >
                  {(["管理员", "审批者", "成员"] as TeamRole[]).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                  {selectedTeamMember.role === "所有者" && (
                    <option value="所有者">所有者</option>
                  )}
                </select>
              </label>
              <div>
                <small>{memberRoleDraft}将获得</small>
                <strong>{teamRoleDetails[memberRoleDraft].summary}</strong>
                <div>
                  {teamRoleDetails[memberRoleDraft].permissions.map(
                    (permission) => (
                      <span key={permission}>
                        <Check size={14} />
                        {permission}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>

            {selectedTeamMember.role === "所有者" && (
              <div className="team-owner-note">
                <ShieldCheck size={17} />
                <span>
                  <strong>工作区所有者</strong>
                  <small>为避免失去管理权限，所有者角色不能在这里修改或移除。</small>
                </span>
              </div>
            )}

            {memberRemoveConfirm ? (
              <div className="team-member-remove-confirm" role="alert">
                <AlertTriangle size={18} />
                <span>
                  <strong>移除 {selectedTeamMember.name}？</strong>
                  <small>该成员会立即失去任务、成果和审批访问权限。</small>
                </span>
                <div>
                  <button
                    type="button"
                    data-overlay-initial-focus
                    onClick={() => setMemberRemoveConfirm(false)}
                  >
                    取消
                  </button>
                  <button
                    className="danger"
                    type="button"
                    onClick={confirmRemoveTeamMember}
                  >
                    确认移除
                  </button>
                </div>
              </div>
            ) : (
              <footer className="team-member-actions">
                {selectedTeamMember.role === "所有者" ? (
                  <button
                    className="primary"
                    type="button"
                    data-overlay-initial-focus
                    onClick={closeTeamMember}
                  >
                    完成
                  </button>
                ) : (
                  <>
                    <button
                      className="remove"
                      type="button"
                      onClick={() => setMemberRemoveConfirm(true)}
                    >
                      <Trash2 size={15} />
                      移除成员
                    </button>
                    {selectedTeamMember.status === "已邀请" && (
                      <button type="button" onClick={resendTeamInvite}>
                        <Mail size={15} />
                        重发邀请
                      </button>
                    )}
                    <button
                      className="primary"
                      type="button"
                      data-overlay-initial-focus
                      onClick={saveTeamMemberRole}
                    >
                      <CheckCircle2 size={15} />
                      保存角色
                    </button>
                  </>
                )}
              </footer>
            )}
          </section>
        </div>
      )}

      {selectedConnector && (
        <div
          className="clarity-dialog-backdrop connector-detail-backdrop"
          onMouseDown={() => {
            setSelectedConnectorId(null);
            setConnectorDisconnectConfirm(false);
          }}
        >
          <section
            className={`connector-detail-dialog tone-${selectedConnector.tone} ${
              selectedConnectorHasIssue ? "is-attention" : ""
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="connector-detail-title"
            aria-describedby="connector-detail-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="connector-detail-close"
              type="button"
              aria-label="关闭连接器管理"
              data-overlay-initial-focus={
                selectedConnectorHasIssue ? true : undefined
              }
              onClick={() => {
                setSelectedConnectorId(null);
                setConnectorDisconnectConfirm(false);
              }}
            >
              <X size={17} />
            </button>

            <header className="connector-detail-heading">
              <span className="connector-detail-icon">
                <SelectedConnectorIcon size={23} />
              </span>
              <div>
                <span>连接器管理</span>
                <h2 id="connector-detail-title">{selectedConnector.name}</h2>
                <p id="connector-detail-description">
                  {selectedConnector.description}
                </p>
              </div>
              <span
                className={`connector-detail-status ${
                  selectedConnectorHasIssue
                    ? "is-attention"
                    : connectorStates[selectedConnector.id]
                      ? "is-connected"
                      : ""
                }`}
              >
                <i />
                {selectedConnectorHasIssue
                  ? "需要重新授权"
                  : connectorStates[selectedConnector.id]
                    ? "连接正常"
                    : "尚未连接"}
              </span>
            </header>

            <div className="connector-detail-facts">
              <span>
                <small>授权范围</small>
                <strong>
                  {selectedConnectorHasIssue
                    ? "授权已过期，暂不可用"
                    : connectorStates[selectedConnector.id]
                    ? selectedConnector.scope
                    : "未授予任何权限"}
                </strong>
              </span>
              <span>
                <small>
                  {selectedConnectorHasIssue ? "受影响任务" : "关联任务"}
                </small>
                <strong>
                  {selectedConnectorHasIssue
                    ? selectedConnectorIssueTasks.length
                    : connectorUsageCounts[selectedConnector.id]}{" "}
                  个
                </strong>
              </span>
              <span>
                <small>最近使用</small>
                <strong>
                  {selectedConnectorHasIssue
                    ? selectedConnectorIssueTasks[0]?.updated
                    : connectorStates[selectedConnector.id]
                    ? selectedConnector.lastUsed
                    : "尚未使用"}
                </strong>
              </span>
            </div>

            {selectedConnectorHasIssue && (
              <section className="connector-issue-panel" role="alert">
                <div className="connector-issue-heading">
                  <span>
                    <AlertTriangle size={17} />
                  </span>
                  <div>
                    <em>授权异常</em>
                    <strong>连接仍然存在，但当前凭证已不可用</strong>
                  </div>
                  <code>
                    {selectedConnectorIssueTasks[0]?.errorCode ??
                      "AUTH_EXPIRED"}
                  </code>
                </div>
                <p>
                  为避免未经确认的外部操作，系统已停止受影响任务。重新授权不会自动发送内容，也不会删除原始失败记录。
                </p>
                <div className="connector-issue-tasks">
                  <span>受影响任务</span>
                  {selectedConnectorIssueTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openConnectorAffectedTask(task.id)}
                    >
                      <span>
                        <strong>{task.title}</strong>
                        <small>{task.lastError}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="connector-permission-section">
              <div>
                <span>权限范围</span>
                <strong>
                  {connectorStates[selectedConnector.id]
                    ? "当前已允许以下操作"
                    : "连接后将请求以下权限"}
                </strong>
              </div>
              <div className="connector-permission-list">
                {selectedConnector.permissions.map((permission) => (
                  <span key={permission}>
                    <Check size={15} />
                    {permission}
                  </span>
                ))}
              </div>
            </div>

            <div className="connector-safety-note">
              <ShieldCheck size={17} />
              <span>
                {selectedConnector.id === "mail"
                  ? "邮件只会在你确认后发送，连接器不会绕过审批保护。"
                  : "连接器只在任务需要时调用，每次使用都会写入运行记录。"}
              </span>
            </div>

            {connectorDisconnectConfirm ? (
              <div className="connector-disconnect-confirm" role="alert">
                <AlertTriangle size={18} />
                <span>
                  <strong>确认断开 {selectedConnector.name}？</strong>
                  <small>后续任务将停止使用这项能力，历史记录不会被删除。</small>
                </span>
                <div>
                  <button
                    type="button"
                    data-overlay-initial-focus
                    onClick={() => setConnectorDisconnectConfirm(false)}
                  >
                    取消
                  </button>
                  <button
                    className="danger"
                    type="button"
                    onClick={confirmDisconnectConnector}
                  >
                    确认断开
                  </button>
                </div>
              </div>
            ) : (
              <div className="connector-detail-actions">
                {selectedConnectorHasIssue ? (
                  <>
                    <button
                      className="disconnect"
                      type="button"
                      onClick={() => setConnectorDisconnectConfirm(true)}
                    >
                      断开连接
                    </button>
                    <button
                      className="primary reauthorize"
                      type="button"
                      disabled={connectorTestingId !== null}
                      aria-busy={
                        connectorTestingId === selectedConnector.id
                      }
                      onClick={() =>
                        reauthorizeConnector(selectedConnector.id)
                      }
                    >
                      {connectorTestingId === selectedConnector.id ? (
                        <LoaderCircle className="is-spinning" size={16} />
                      ) : (
                        <RotateCcw size={16} />
                      )}
                      {connectorTestingId === selectedConnector.id
                        ? "正在重新授权"
                        : "重新授权"}
                    </button>
                  </>
                ) : connectorStates[selectedConnector.id] ? (
                  <>
                    <button
                      className="disconnect"
                      type="button"
                      onClick={() => setConnectorDisconnectConfirm(true)}
                    >
                      断开连接
                    </button>
                    <button
                      className="primary"
                      type="button"
                      data-overlay-initial-focus
                      disabled={connectorTestingId !== null}
                      aria-busy={connectorTestingId === selectedConnector.id}
                      onClick={() => testConnector(selectedConnector.id)}
                    >
                      {connectorTestingId === selectedConnector.id ? (
                        <LoaderCircle className="is-spinning" size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      {connectorTestingId === selectedConnector.id
                        ? "正在测试"
                        : "测试连接"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedConnectorId(null)}
                    >
                      暂不连接
                    </button>
                    <button
                      className="primary"
                      type="button"
                      data-overlay-initial-focus
                      onClick={() => connectConnector(selectedConnector.id)}
                    >
                      <Link2 size={16} />
                      连接并授权
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {inspectedRunTask && inspectedRun && (
        <div
          className="clarity-dialog-backdrop run-detail-backdrop"
          onMouseDown={closeRunDetail}
        >
          <section
            className={`run-detail-dialog status-${inspectedRun.status}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="run-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="run-detail-close"
              type="button"
              data-overlay-initial-focus
              aria-label="返回任务详情"
              title="返回任务详情"
              onClick={closeRunDetail}
            >
              <X size={18} />
            </button>

            <header className="run-detail-heading">
              <span className="run-detail-result-icon" aria-hidden="true">
                {inspectedRun.status === "成功" && <CheckCircle2 size={22} />}
                {inspectedRun.status === "失败" && <AlertTriangle size={22} />}
                {inspectedRun.status === "运行中" && (
                  <LoaderCircle className="is-spinning" size={22} />
                )}
                {inspectedRun.status === "已取消" && <Pause size={22} />}
              </span>
              <div>
                <span>运行详情</span>
                <h2 id="run-detail-title">{inspectedRunTask.title}</h2>
                <p>{inspectedRun.summary}</p>
              </div>
              <em>{inspectedRun.status}</em>
            </header>

            <div className="run-detail-identity" aria-label="运行信息">
              <span className="run-detail-id">
                <small>运行 ID</small>
                <span>
                  <code>{inspectedRun.id}</code>
                  <button
                    type="button"
                    aria-label="复制运行 ID"
                    title="复制运行 ID"
                    onClick={() => copyTaskRunId(inspectedRun)}
                  >
                    <Copy size={14} />
                  </button>
                </span>
              </span>
              <span>
                <small>开始时间</small>
                <strong>{formatTaskRunTime(inspectedRun.startedAt)}</strong>
              </span>
              <span>
                <small>实际耗时</small>
                <strong>
                  {formatTaskRunDuration(inspectedRun.durationSeconds)}
                </strong>
              </span>
              <span>
                <small>启动方式</small>
                <strong>{inspectedRunLaunchType}</strong>
              </span>
            </div>

            <section className="run-stage-section">
              <div className="run-section-heading">
                <span>
                  <small>执行路径</small>
                  <h3>从配置到审计的完整阶段</h3>
                </span>
                <em>
                  {inspectedRunStages.filter((stage) => stage.status === "成功")
                    .length}
                  /{inspectedRunStages.length} 已完成
                </em>
              </div>
              <ol className="run-stage-list" aria-label="运行阶段">
                {inspectedRunStages.map((stage, index) => (
                  <li className={`stage-${stage.status}`} key={stage.id}>
                    <span className="run-stage-index">
                      {stage.status === "成功" ? (
                        <Check size={15} />
                      ) : stage.status === "失败" ? (
                        <AlertTriangle size={15} />
                      ) : stage.status === "运行中" ? (
                        <LoaderCircle className="is-spinning" size={15} />
                      ) : stage.status === "已取消" ? (
                        <Pause size={15} />
                      ) : (
                        String(index + 1).padStart(2, "0")
                      )}
                    </span>
                    <span>
                      <strong>{stage.title}</strong>
                      <small>{stage.detail}</small>
                    </span>
                    <em>{stage.status}</em>
                  </li>
                ))}
              </ol>
            </section>

            <section
              className={`run-boundary-panel status-${inspectedRun.status}`}
              aria-label="结果与安全边界"
            >
              <div className="run-section-heading">
                <span>
                  <small>结果与安全边界</small>
                  <h3>
                    {inspectedRun.status === "失败"
                      ? "失败已被安全拦截"
                      : inspectedRun.status === "运行中"
                        ? "正在受控执行"
                        : inspectedRun.status === "已取消"
                          ? "运行已在检查点停止"
                          : "运行结果已完成保存"}
                  </h3>
                </span>
                <ShieldCheck size={19} />
              </div>
              {inspectedRun.status === "失败" && (
                <div className="run-error-summary" role="alert">
                  <code>{inspectedRun.errorCode ?? "RUN_FAILED"}</code>
                  <p>
                    {inspectedRun.errorMessage ??
                      "本次运行没有完成，系统已保留失败现场和审计记录。"}
                  </p>
                </div>
              )}
              <div className="run-evidence-grid">
                <span>
                  <small>外部动作</small>
                  <strong>
                    {inspectedRunAuthorizationBlocked ? "0 次" : "已记录"}
                  </strong>
                  <em>
                    {inspectedRunAuthorizationBlocked
                      ? "授权通过前未执行"
                      : "全部进入审计"}
                  </em>
                </span>
                <span>
                  <small>关联成果</small>
                  <strong>{inspectedRunArtifacts.length} 项</strong>
                  <em>版本和来源可追溯</em>
                </span>
                <span>
                  <small>审计证据</small>
                  <strong>{inspectedRunActivity.length} 条</strong>
                  <em>保存在本机工作区</em>
                </span>
              </div>
            </section>

            <footer className="run-detail-actions">
              <button
                type="button"
                title="复制运行 ID"
                onClick={() => copyTaskRunId(inspectedRun)}
              >
                <Copy size={15} />
                复制 ID
              </button>
              <button
                type="button"
                onClick={() => downloadTaskRun(inspectedRunTask, inspectedRun)}
              >
                <Download size={15} />
                导出 JSON
              </button>
              {inspectedRun.status === "运行中" &&
              inspectedRunTask.status === "运行中" ? (
                <button
                  className="primary is-caution"
                  type="button"
                  onClick={() => pauseInspectedRun(inspectedRunTask)}
                >
                  <Pause size={16} />
                  暂停本次运行
                </button>
              ) : inspectedRun.status === "失败" &&
                inspectedRunTask.status !== "运行中" ? (
                <button
                  className="primary"
                  type="button"
                  onClick={() => retryInspectedRun(inspectedRunTask)}
                >
                  <RotateCcw size={16} />
                  从安全检查点重试
                </button>
              ) : inspectedRun.status === "成功" &&
                inspectedRunArtifacts.length > 0 ? (
                <button
                  className="primary"
                  type="button"
                  onClick={() => openTaskArtifacts(inspectedRunTask.id)}
                >
                  <Files size={16} />
                  查看运行成果
                </button>
              ) : (
                <button
                  className="primary"
                  type="button"
                  onClick={openInspectedRunTask}
                >
                  查看当前任务
                  <ChevronRight size={16} />
                </button>
              )}
            </footer>
          </section>
        </div>
      )}

      {selectedTask && (
        <div
          className="task-detail-backdrop"
          onMouseDown={closeTaskDetail}
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
                  data-overlay-initial-focus
                  onClick={closeTaskDetail}
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="task-detail-intro">
              <div className="task-detail-intro-heading">
                <span className={`task-detail-icon status-${selectedTask.status}`}>
                  {selectedTask.status === "运行中" && <Activity size={21} />}
                  {selectedTask.status === "待确认" && <ShieldCheck size={21} />}
                  {selectedTask.status === "失败" && <AlertTriangle size={21} />}
                  {selectedTask.status === "已暂停" && <Pause size={21} />}
                  {selectedTask.status === "已完成" && <CheckCircle2 size={21} />}
                </span>
                <div>
                  <h2>{selectedTask.title}</h2>
                  <p>{selectedTask.description}</p>
                </div>
              </div>
            </div>

            {selectedTask.status === "失败" && (
              <section
                className={`task-failure-diagnostic ${
                  selectedTaskRecoveryReady ? "is-ready" : ""
                }`}
                role="alert"
              >
                <div className="task-failure-heading">
                  <span>
                    {selectedTaskRecoveryReady ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <AlertTriangle size={18} />
                    )}
                  </span>
                  <div>
                    <em>
                      {selectedTaskRecoveryReady
                        ? "已准备恢复"
                        : "已安全停止"}
                    </em>
                    <h3>
                      {selectedTaskRecoveryReady
                        ? "连接器已修复，可以从安全检查点继续"
                        : "任务未完成，但没有执行外部发送"}
                    </h3>
                  </div>
                  <code>{selectedTask.errorCode ?? "TASK_FAILED"}</code>
                </div>
                <p>
                  {selectedTask.lastError ??
                    "任务遇到无法自动恢复的问题，已在安全检查点停止。"}
                </p>
                <div className="task-failure-impact">
                  <span>
                    <CheckCircle2 size={15} />
                    已生成的成果与证据仍然保留
                  </span>
                  <span>
                    <ShieldCheck size={15} />
                    未向外部人员发送任何内容
                  </span>
                </div>
                <div className="task-failure-actions">
                  <button type="button" onClick={() => retryTask(selectedTask)}>
                    {selectedTaskRecoveryReady ? (
                      <Play size={15} />
                    ) : (
                      <RotateCcw size={15} />
                    )}
                    {selectedTaskRecoveryReady ? "继续运行" : "立即重试"}
                  </button>
                  <button type="button" onClick={openTaskRecoverySettings}>
                    <Link2 size={15} />
                    检查邮件连接器
                  </button>
                </div>
              </section>
            )}

            <section
              className={`task-detail-progress ${
                selectedTaskRecoveryReady
                  ? "is-ready"
                  : selectedTask.status === "失败"
                    ? "is-failed"
                    : ""
              }`}
              aria-label="任务进度"
            >
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
                  <strong>
                    {selectedTask.status === "失败"
                      ? "等待你确认重试"
                      : getNextRunLabel(selectedTask)}
                  </strong>
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

            <section className="task-run-health" aria-label="运行健康">
              <div className="task-run-health-heading">
                <span>
                  <small>运行健康</small>
                  <strong>最近执行是否稳定</strong>
                </span>
                <em
                  className={
                    selectedTaskRecoveryReady
                      ? "is-ready"
                      : selectedTask.status === "失败"
                      ? "is-attention"
                      : selectedTask.status === "运行中"
                        ? "is-live"
                        : "is-healthy"
                  }
                >
                  {selectedTaskRecoveryReady
                    ? "可以恢复"
                    : selectedTask.status === "失败"
                      ? "需要处理"
                    : selectedTask.status === "运行中"
                      ? "正在运行"
                      : "运行正常"}
                </em>
              </div>
              <div className="task-run-metrics">
                <span>
                  <small>成功率</small>
                  <strong>
                    {selectedTaskSuccessRate === null
                      ? "暂无"
                      : `${selectedTaskSuccessRate}%`}
                  </strong>
                </span>
                <span>
                  <small>近期开跑</small>
                  <strong>{selectedTaskRuns.length} 次</strong>
                </span>
                <span>
                  <small>平均耗时</small>
                  <strong>
                    {selectedTaskAverageDuration === undefined
                      ? "暂无"
                      : formatTaskRunDuration(selectedTaskAverageDuration)}
                  </strong>
                </span>
              </div>
              {selectedTaskRuns.length > 0 ? (
                <ol className="task-run-list">
                  {selectedTaskRuns.slice(0, 3).map((run) => (
                    <li className={`run-${run.status}`} key={run.id}>
                      <button
                        type="button"
                        aria-label={`查看运行：${run.id}`}
                        onClick={() => openTaskRun(selectedTask.id, run.id)}
                      >
                        <span>
                          {run.status === "成功" && <CheckCircle2 size={14} />}
                          {run.status === "失败" && <AlertTriangle size={14} />}
                          {run.status === "运行中" && (
                            <LoaderCircle className="is-spinning" size={14} />
                          )}
                          {run.status === "已取消" && <Pause size={14} />}
                        </span>
                        <span>
                          <strong>{run.status}</strong>
                          <small>{run.summary}</small>
                        </span>
                        <span>
                          <time dateTime={run.startedAt}>
                            {formatTaskRunTime(run.startedAt)}
                          </time>
                          <small>
                            {formatTaskRunDuration(run.durationSeconds)}
                          </small>
                        </span>
                        <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="task-run-empty">
                  第一次运行开始后，这里会显示成功率和耗时。
                </div>
              )}
            </section>

            <section className="task-detail-artifacts">
              <div>
                <span>关联成果</span>
                <button
                  type="button"
                  onClick={() => openTaskArtifacts(selectedTask.id)}
                >
                  {artifacts.filter((artifact) => artifact.taskId === selectedTask.id)
                    .length}{" "}
                  项
                  <ChevronRight size={14} />
                </button>
              </div>
              {selectedTaskArtifacts.length > 0 ? (
                <div className="task-artifact-list">
                  {selectedTaskArtifacts.map((artifact) => {
                    const ArtifactIcon = artifactIconMap[artifact.type];
                    return (
                      <button
                        key={artifact.id}
                        type="button"
                        onClick={() => {
                          setArtifactTaskId(selectedTask.id);
                          setArtifactFilter("全部");
                          setSelectedArtifactId(artifact.id);
                          setActiveView("artifacts");
                          setSelectedTaskId(null);
                          writeWorkspaceRoute(
                            {
                              view: "artifacts",
                              taskId: null,
                              runId: null,
                            },
                            "push",
                          );
                        }}
                      >
                        <span className={`type-${artifact.type}`}>
                          <ArtifactIcon size={15} />
                        </span>
                        <span>
                          <strong>{artifact.title}</strong>
                          <small>
                            {artifact.format} · {artifact.sizeKb.toFixed(1)} KB
                          </small>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="task-artifact-empty">
                  <Files size={17} />
                  <span>
                    <strong>还没有生成成果</strong>
                    <small>任务完成交付后会自动显示在这里。</small>
                  </span>
                </div>
              )}
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
                {selectedTask.status === "失败" &&
                  (selectedTaskRecoveryReady ? (
                    <Play size={16} />
                  ) : (
                    <RotateCcw size={16} />
                  ))}
                {(selectedTask.status === "已暂停" || selectedTask.status === "已完成") && (
                  <Play size={16} />
                )}
                {selectedTask.status === "运行中" && "暂停任务"}
                {selectedTask.status === "待确认" && "处理确认"}
                {selectedTask.status === "失败" &&
                  (selectedTaskRecoveryReady ? "继续运行" : "重试任务")}
                {selectedTask.status === "已暂停" && "继续任务"}
                {selectedTask.status === "已完成" && "再次运行"}
              </button>
              {selectedTask.pinned ? (
                <button type="button" onClick={closeTaskDetail}>
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
        <div
          className="clarity-dialog-backdrop"
          onMouseDown={requestCloseComposer}
        >
          <form
            className="clarity-dialog"
            role="dialog"
            aria-modal="true"
            aria-busy={isSavingTask}
            aria-hidden={taskDiscardOpen || undefined}
            aria-label={editingTaskId ? "编辑任务" : "新建任务"}
            aria-labelledby="task-composer-title"
            inert={taskDiscardOpen}
            onSubmit={createTask}
            onMouseDown={(event) => event.stopPropagation()}
            noValidate
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
              <button
                type="button"
                aria-label="关闭"
                disabled={isSavingTask}
                onClick={requestCloseComposer}
              >
                <X size={17} />
              </button>
            </div>

            {!isOnline && (
              <div className="task-offline-note" role="status">
                <Globe2 size={16} />
                <span>
                  <strong>当前处于离线状态</strong>
                  <small>
                    任务配置会保存在本机，但不会显示为正在运行；恢复网络后可以手动开始。
                  </small>
                </span>
              </div>
            )}

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
              <label className={taskFormSubmitted && taskFormErrors.name ? "has-error" : ""}>
                <span>任务名称</span>
                <input
                  ref={taskNameRef}
                  autoFocus
                  data-overlay-initial-focus
                  required
                  maxLength={80}
                  aria-invalid={Boolean(taskFormSubmitted && taskFormErrors.name)}
                  aria-describedby={
                    taskFormSubmitted && taskFormErrors.name
                      ? "task-name-error"
                      : undefined
                  }
                  value={taskName}
                  placeholder="例如：每天跟踪竞品更新"
                  onChange={(event) => setTaskName(event.target.value)}
                />
                {taskFormSubmitted && taskFormErrors.name && (
                  <small className="composer-field-error" id="task-name-error">
                    <AlertTriangle size={13} />
                    {taskFormErrors.name}
                  </small>
                )}
              </label>

              <label className={taskFormSubmitted && taskFormErrors.target ? "has-error" : ""}>
                <span>数据来源或网址</span>
                <input
                  ref={taskTargetRef}
                  required
                  maxLength={240}
                  aria-invalid={Boolean(taskFormSubmitted && taskFormErrors.target)}
                  aria-describedby={
                    taskFormSubmitted && taskFormErrors.target
                      ? "task-target-error"
                      : undefined
                  }
                  value={taskTarget}
                  placeholder="网页、文件夹或资料库"
                  onChange={(event) => setTaskTarget(event.target.value)}
                />
                {taskFormSubmitted && taskFormErrors.target && (
                  <small className="composer-field-error" id="task-target-error">
                    <AlertTriangle size={13} />
                    {taskFormErrors.target}
                  </small>
                )}
              </label>
            </div>

            <label
              className={`composer-instruction ${
                taskFormSubmitted && taskFormErrors.description ? "has-error" : ""
              }`}
            >
              <span>希望得到什么结果</span>
              <textarea
                ref={taskDescriptionRef}
                required
                maxLength={500}
                aria-invalid={Boolean(
                  taskFormSubmitted && taskFormErrors.description,
                )}
                aria-describedby={
                  taskFormSubmitted && taskFormErrors.description
                    ? "task-description-error"
                    : undefined
                }
                value={taskDescription}
                placeholder="说清楚要做什么、保留哪些证据，以及最终交付什么结果。"
                onChange={(event) => setTaskDescription(event.target.value)}
              />
              <span className="composer-field-meta">
                {taskFormSubmitted && taskFormErrors.description ? (
                  <small className="composer-field-error" id="task-description-error">
                    <AlertTriangle size={13} />
                    {taskFormErrors.description}
                  </small>
                ) : (
                  <small>描述交付结果，AI 会自行规划执行步骤</small>
                )}
                <small>{taskDescription.length}/500</small>
              </span>
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
                      ref={taskScheduleTimeRef}
                      aria-label="选择运行时间"
                      type="time"
                      required
                      aria-invalid={Boolean(
                        taskFormSubmitted && taskFormErrors.scheduleTime,
                      )}
                      aria-describedby={
                        taskFormSubmitted && taskFormErrors.scheduleTime
                          ? "task-schedule-error"
                          : undefined
                      }
                      value={taskScheduleTime}
                      onInput={(event) =>
                        setTaskScheduleTime((event.target as HTMLInputElement).value)
                      }
                    />
                    {taskFormSubmitted && taskFormErrors.scheduleTime && (
                      <small
                        className="composer-field-error"
                        id="task-schedule-error"
                      >
                        <AlertTriangle size={13} />
                        {taskFormErrors.scheduleTime}
                      </small>
                    )}
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
              {taskFormSubmitted && taskFormHasErrors && (
                <span className="composer-error-summary" role="alert">
                  <AlertTriangle size={14} />
                  请先修正标出的内容
                </span>
              )}
              {!(taskFormSubmitted && taskFormHasErrors) && taskComposerDirty && (
                <span
                  className={`composer-dirty-summary ${
                    taskDraftSaveFailed
                      ? "failed"
                      : taskDraftIsAutoSaved
                        ? "saved"
                        : "saving"
                  }`}
                  aria-live="polite"
                >
                  {taskDraftSaveFailed ? (
                    <AlertTriangle size={14} />
                  ) : taskDraftIsAutoSaved ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <Save size={14} />
                  )}
                  {taskDraftSaveFailed
                    ? "草稿保存失败，请立即提交"
                    : taskDraftIsAutoSaved
                      ? "草稿已自动保存，仍需提交"
                      : "正在保护你的修改"}
                </span>
              )}
              <button
                type="button"
                disabled={isSavingTask}
                onClick={requestCloseComposer}
              >
                取消
              </button>
              <button className="confirm" type="submit" disabled={isSavingTask}>
                {isSavingTask ? (
                  <LoaderCircle className="composer-saving-icon" size={16} />
                ) : editingTaskId ? (
                  <Pencil size={16} />
                ) : !isOnline ? (
                  <Save size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                {isSavingTask
                  ? editingTaskId
                    ? "正在保存"
                    : isOnline
                      ? "正在创建"
                      : "正在保存"
                  : editingTaskId
                    ? "保存修改"
                    : isOnline
                      ? "创建并运行"
                      : "保存，联网后运行"}
              </button>
            </div>
          </form>
        </div>
      )}

      {taskDiscardOpen && composerOpen && (
        <div
          className="clarity-dialog-backdrop task-discard-backdrop"
          onMouseDown={() => setTaskDiscardOpen(false)}
        >
          <section
            className="task-discard-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="task-discard-title"
            aria-describedby="task-discard-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="关闭放弃任务草稿确认"
              onClick={() => setTaskDiscardOpen(false)}
            >
              <X size={17} />
            </button>
            <span>
              <AlertTriangle size={20} />
            </span>
            <small>未保存修改</small>
            <h2 id="task-discard-title">
              {editingTaskId ? "放弃任务修改？" : "放弃这个新任务？"}
            </h2>
            <p id="task-discard-description">
              {editingTaskId
                ? `对“${taskDraftBaseline?.name ?? taskName}”的配置修改还没有保存，放弃后无法恢复。`
                : "名称、目标、运行计划和审批设置还没有创建，放弃后需要重新填写。"}
            </p>
            <div>
              <button
                type="button"
                data-overlay-initial-focus
                onClick={() => setTaskDiscardOpen(false)}
              >
                继续编辑
              </button>
              <button
                className="danger"
                type="button"
                onClick={confirmDiscardTaskDraft}
              >
                {editingTaskId ? "放弃修改" : "放弃草稿"}
              </button>
            </div>
          </section>
        </div>
      )}

      {editingArtifact && (
        <div
          className="clarity-dialog-backdrop artifact-editor-backdrop"
          onMouseDown={requestCloseArtifactEditor}
        >
          <form
            className="artifact-editor-dialog"
            role="dialog"
            aria-modal="true"
            aria-busy={isSavingArtifact}
            aria-labelledby="artifact-editor-title"
            aria-describedby="artifact-editor-description"
            onSubmit={(event) => {
              event.preventDefault();
              saveArtifactEdit();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            noValidate
          >
            <header className="artifact-editor-heading">
              <span className="artifact-editor-icon">
                <Pencil size={20} />
              </span>
              <div>
                <span>成果编辑</span>
                <h2 id="artifact-editor-title">修订内容并保存新版本</h2>
                <p id="artifact-editor-description">
                  保存不会覆盖原文件。当前 v{editingArtifactVersion} 会进入版本记录，
                  新内容保存为 v{editingArtifactVersion + 1}。
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭成果编辑器"
                disabled={isSavingArtifact}
                onClick={requestCloseArtifactEditor}
              >
                <X size={17} />
              </button>
            </header>

            <div className="artifact-editor-workspace">
              <section className="artifact-editor-main">
                <div className="artifact-editor-field-grid">
                  <label
                    className={
                      artifactEditSubmitted && artifactFormErrors.title
                        ? "has-error"
                        : ""
                    }
                  >
                    <span>成果名称</span>
                    <input
                      ref={artifactTitleRef}
                      data-overlay-initial-focus
                      required
                      maxLength={100}
                      aria-invalid={Boolean(
                        artifactEditSubmitted && artifactFormErrors.title,
                      )}
                      aria-describedby={
                        artifactEditSubmitted && artifactFormErrors.title
                          ? "artifact-title-error"
                          : undefined
                      }
                      value={artifactTitleDraft}
                      onChange={(event) =>
                        setArtifactTitleDraft(event.target.value)
                      }
                    />
                    {artifactEditSubmitted && artifactFormErrors.title && (
                      <small
                        className="artifact-editor-error"
                        id="artifact-title-error"
                      >
                        <AlertTriangle size={13} />
                        {artifactFormErrors.title}
                      </small>
                    )}
                  </label>

                  <label
                    className={
                      artifactEditSubmitted && artifactFormErrors.filename
                        ? "has-error"
                        : ""
                    }
                  >
                    <span>文件名</span>
                    <input
                      ref={artifactFilenameRef}
                      required
                      maxLength={120}
                      spellCheck={false}
                      aria-invalid={Boolean(
                        artifactEditSubmitted && artifactFormErrors.filename,
                      )}
                      aria-describedby={
                        artifactEditSubmitted && artifactFormErrors.filename
                          ? "artifact-filename-error"
                          : undefined
                      }
                      value={artifactFilenameDraft}
                      onChange={(event) =>
                        setArtifactFilenameDraft(event.target.value)
                      }
                    />
                    {artifactEditSubmitted && artifactFormErrors.filename && (
                      <small
                        className="artifact-editor-error"
                        id="artifact-filename-error"
                      >
                        <AlertTriangle size={13} />
                        {artifactFormErrors.filename}
                      </small>
                    )}
                  </label>
                </div>

                <label
                  className={`artifact-editor-content ${
                    artifactEditSubmitted && artifactFormErrors.content
                      ? "has-error"
                      : ""
                  }`}
                >
                  <span>
                    <strong>内容</strong>
                    <small>{editingArtifact.format} · 支持 Markdown</small>
                  </span>
                  <textarea
                    ref={artifactContentRef}
                    required
                    maxLength={100000}
                    spellCheck
                    aria-invalid={Boolean(
                      artifactEditSubmitted && artifactFormErrors.content,
                    )}
                    aria-describedby={
                      artifactEditSubmitted && artifactFormErrors.content
                        ? "artifact-content-error"
                        : "artifact-content-meta"
                    }
                    value={artifactContentDraft}
                    onChange={(event) =>
                      setArtifactContentDraft(event.target.value)
                    }
                  />
                  <span className="artifact-editor-content-meta">
                    {artifactEditSubmitted && artifactFormErrors.content ? (
                      <small
                        className="artifact-editor-error"
                        id="artifact-content-error"
                      >
                        <AlertTriangle size={13} />
                        {artifactFormErrors.content}
                      </small>
                    ) : (
                      <small id="artifact-content-meta">
                        人工修订会写入审计，不改变来源任务与原始证据。
                      </small>
                    )}
                    <small>
                      {artifactContentDraft.length.toLocaleString()} / 100,000
                    </small>
                  </span>
                </label>
              </section>

              <aside className="artifact-version-panel">
                <div className="artifact-version-current">
                  <span>
                    <History size={17} />
                    当前版本
                  </span>
                  <strong>v{editingArtifactVersion}</strong>
                  <p>{editingArtifact.filename}</p>
                  <dl>
                    <div>
                      <dt>状态</dt>
                      <dd>{editingArtifact.status}</dd>
                    </div>
                    <div>
                      <dt>最近编辑</dt>
                      <dd>{editingArtifact.editedBy ?? "Unzoo One AI"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="artifact-version-history">
                  <div>
                    <span>历史版本</span>
                    <em>{artifactRevisionHistory.length} 个</em>
                  </div>
                  {artifactRevisionHistory.length > 0 ? (
                    <div>
                      {artifactRevisionHistory.map((revision) => (
                        <button
                          key={`${editingArtifact.id}-${revision.version}`}
                          type="button"
                          onClick={() => loadArtifactRevision(revision)}
                        >
                          <span>v{revision.version}</span>
                          <span>
                            <strong>{revision.title}</strong>
                            <small>
                              {revision.editor} ·{" "}
                              {new Date(revision.createdAt).toLocaleDateString(
                                "zh-CN",
                                { month: "numeric", day: "numeric" },
                              )}
                            </small>
                          </span>
                          <RotateCcw size={14} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="artifact-version-empty">
                      <History size={20} />
                      <strong>这是第一个版本</strong>
                      <small>首次保存修改后，v1 会保留在这里。</small>
                    </div>
                  )}
                </div>

                <div className="artifact-version-safety">
                  <ShieldCheck size={16} />
                  <span>
                    <strong>原始记录受保护</strong>
                    <small>数据和证据不可编辑；报告修订会保留全部版本。</small>
                  </span>
                </div>
              </aside>
            </div>

            <footer className="artifact-editor-actions">
              <span
                className={`artifact-editor-save-state ${
                  artifactEditorDirty
                    ? artifactDraftSaveFailed
                      ? "is-dirty failed"
                      : artifactDraftIsAutoSaved
                        ? "is-dirty saved"
                        : "is-dirty saving"
                    : ""
                }`}
                aria-live="polite"
              >
                <i />
                {artifactEditorDirty
                  ? artifactDraftSaveFailed
                    ? "草稿保存失败，请立即保存版本"
                    : artifactDraftIsAutoSaved
                      ? "草稿已自动保存，仍需保存版本"
                      : "正在保护你的修改"
                  : "当前内容未修改"}
                <kbd>Ctrl S</kbd>
              </span>
              {artifactEditSubmitted && artifactFormHasErrors && (
                <span className="artifact-editor-summary" role="alert">
                  <AlertTriangle size={14} />
                  请先修正标出的内容
                </span>
              )}
              <button
                type="button"
                disabled={isSavingArtifact}
                onClick={requestCloseArtifactEditor}
              >
                取消
              </button>
              <button
                className="confirm"
                type="submit"
                disabled={isSavingArtifact || !artifactEditorDirty}
              >
                {isSavingArtifact ? (
                  <LoaderCircle className="composer-saving-icon" size={16} />
                ) : (
                  <Save size={16} />
                )}
                {isSavingArtifact
                  ? "正在保存"
                  : `保存为 v${editingArtifactVersion + 1}`}
              </button>
            </footer>
          </form>
        </div>
      )}

      {artifactDiscardOpen && editingArtifact && (
        <div
          className="clarity-dialog-backdrop artifact-discard-backdrop"
          onMouseDown={() => setArtifactDiscardOpen(false)}
        >
          <section
            className="artifact-discard-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="artifact-discard-title"
            aria-describedby="artifact-discard-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="关闭放弃修改确认"
              onClick={() => setArtifactDiscardOpen(false)}
            >
              <X size={17} />
            </button>
            <span>
              <AlertTriangle size={20} />
            </span>
            <small>未保存修改</small>
            <h2 id="artifact-discard-title">放弃这次成果修订？</h2>
            <p id="artifact-discard-description">
              对“{editingArtifact.title}”的修改还没有保存，关闭后无法恢复。
            </p>
            <div>
              <button
                type="button"
                data-overlay-initial-focus
                onClick={() => setArtifactDiscardOpen(false)}
              >
                继续编辑
              </button>
              <button
                className="danger"
                type="button"
                onClick={confirmDiscardArtifactDraft}
              >
                放弃修改
              </button>
            </div>
          </section>
        </div>
      )}

      {deletingArtifact && (
        <div
          className="clarity-dialog-backdrop artifact-delete-backdrop"
          onMouseDown={() => setArtifactDeleteId(null)}
        >
          <section
            className="artifact-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="artifact-delete-title"
            aria-describedby="artifact-delete-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="artifact-delete-close"
              type="button"
              aria-label="关闭成果删除确认"
              onClick={() => setArtifactDeleteId(null)}
            >
              <X size={17} />
            </button>

            <header className="artifact-delete-heading">
              <span>
                <Trash2 size={21} />
              </span>
              <div>
                <small>删除成果</small>
                <h2 id="artifact-delete-title">
                  删除“{deletingArtifact.title}”？
                </h2>
                <p id="artifact-delete-description">
                  文件与全部修订版本将从当前工作区移除，完成后可在底部提示中撤销。
                </p>
              </div>
            </header>

            <div className="artifact-delete-file">
              <span
                className={`artifact-preview-icon type-${deletingArtifact.type}`}
              >
                <DeletingArtifactIcon size={19} />
              </span>
              <span>
                <strong>{deletingArtifact.filename}</strong>
                <small>
                  {deletingArtifact.format} ·{" "}
                  {deletingArtifact.sizeKb.toFixed(1)} KB
                </small>
              </span>
              <em>{deletingArtifact.status}</em>
            </div>

            <div className="artifact-delete-facts" aria-label="删除影响">
              <span>
                <small>将移除</small>
                <strong>
                  {(deletingArtifact.revisions?.length ?? 0) + 1} 个版本
                </strong>
              </span>
              <span>
                <small>关联任务</small>
                <strong>{deletingArtifactTask?.title ?? "原任务已移除"}</strong>
              </span>
              <span>
                <small>撤销时间</small>
                <strong>10 秒</strong>
              </span>
            </div>

            <div className="artifact-delete-safety">
              <ShieldCheck size={18} />
              <span>
                <strong>任务和审计记录不会被删除</strong>
                <small>
                  系统会保留来源任务及删除事件，方便后续追溯是谁在何时执行了操作。
                </small>
              </span>
            </div>

            <div className="artifact-delete-actions">
              <button
                type="button"
                data-overlay-initial-focus
                onClick={() => setArtifactDeleteId(null)}
              >
                保留成果
              </button>
              <button
                className="danger"
                type="button"
                onClick={confirmDeleteArtifact}
              >
                <Trash2 size={15} />
                确认删除
              </button>
            </div>
          </section>
        </div>
      )}

      {settingsDiscardTarget && activeSettingsDiscardCopy && (
        <div
          className="clarity-dialog-backdrop settings-discard-backdrop"
          onMouseDown={() => setSettingsDiscardTarget(null)}
        >
          <section
            className="settings-discard-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="settings-discard-title"
            aria-describedby="settings-discard-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="关闭放弃设置确认"
              onClick={() => setSettingsDiscardTarget(null)}
            >
              <X size={17} />
            </button>
            <span>
              <AlertTriangle size={22} />
            </span>
            <small>{activeSettingsDiscardCopy.eyebrow}</small>
            <h2 id="settings-discard-title">
              {activeSettingsDiscardCopy.title}
            </h2>
            <p id="settings-discard-description">
              {activeSettingsDiscardCopy.description}
            </p>
            <div>
              <button
                type="button"
                data-overlay-initial-focus
                onClick={() => setSettingsDiscardTarget(null)}
              >
                继续编辑
              </button>
              <button
                className="danger"
                type="button"
                onClick={discardSettingsDraft}
              >
                {activeSettingsDiscardCopy.discardLabel}
              </button>
            </div>
          </section>
        </div>
      )}

      {usageBudgetOpen && (
        <div
          className="clarity-dialog-backdrop"
          onMouseDown={requestCloseUsageBudget}
        >
          <section
            className="usage-budget-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="usage-budget-title"
            aria-describedby="usage-budget-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="usage-budget-close"
              type="button"
              aria-label="关闭预算设置"
              onClick={requestCloseUsageBudget}
            >
              <X size={17} />
            </button>
            <span className="usage-budget-icon">
              <Sparkles size={21} />
            </span>
            <span className="usage-budget-eyebrow">用量与预算</span>
            <h2 id="usage-budget-title">设置当前工作区的月度额度</h2>
            <p id="usage-budget-description">
              额度只影响当前工作区。提醒和到限保护会依据本机估算用量执行。
            </p>

            <div className="usage-budget-facts">
              <span>
                <small>当前已用</small>
                <strong>{usedCredits} 点</strong>
              </span>
              <span>
                <small>月底预计</small>
                <strong>{forecastCredits} 点</strong>
              </span>
              <span>
                <small>运行中任务</small>
                <strong>{runningTaskCount} 个</strong>
              </span>
            </div>

            <label className="usage-budget-field">
              <span>
                <strong>月度额度</strong>
                <small>100 - 50,000 点</small>
              </span>
              <span className={usageBudgetDraftInvalid ? "has-error" : ""}>
                <input
                  data-overlay-initial-focus
                  type="number"
                  min={100}
                  max={50000}
                  step={50}
                  aria-label="月度 AI 额度"
                  aria-invalid={usageBudgetDraftInvalid}
                  value={usageBudgetDraft}
                  onChange={(event) => setUsageBudgetDraft(event.target.value)}
                />
                <em>点 / 月</em>
              </span>
              {usageBudgetDraftInvalid && (
                <small className="usage-budget-error" role="alert">
                  请输入 100 到 50,000 之间的额度。
                </small>
              )}
            </label>

            <div className="usage-budget-presets" aria-label="常用额度">
              {[500, 1000, 2000, 5000].map((value) => (
                <button
                  className={
                    usageBudgetDraftValue === value ? "active" : ""
                  }
                  key={value}
                  type="button"
                  onClick={() => setUsageBudgetDraft(String(value))}
                >
                  {value.toLocaleString()} 点
                </button>
              ))}
            </div>

            <fieldset className="usage-alert-threshold">
              <legend>
                <strong>提醒阈值</strong>
                <small>达到预算比例时显示提醒</small>
              </legend>
              <div role="radiogroup" aria-label="预算提醒阈值">
                {([50, 75, 90] as const).map((threshold) => (
                  <button
                    className={usageAlertDraft === threshold ? "active" : ""}
                    key={threshold}
                    type="button"
                    role="radio"
                    aria-checked={usageAlertDraft === threshold}
                    onClick={() => setUsageAlertDraft(threshold)}
                  >
                    {threshold}%
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="usage-pause-setting">
              <span>
                <Pause size={17} />
                <span>
                  <strong>达到预算后暂停运行中任务</strong>
                  <small>不会删除任务，调整额度或手动继续后可恢复。</small>
                </span>
              </span>
              <button
                className={`switch-control ${usagePauseDraft ? "on" : ""}`}
                type="button"
                role="switch"
                aria-checked={usagePauseDraft}
                aria-label="达到预算后暂停运行中任务"
                onClick={() => setUsagePauseDraft((current) => !current)}
              >
                <i />
              </button>
            </div>

            {!usageBudgetDraftInvalid &&
              usagePauseDraft &&
              usageBudgetDraftValue <= usedCredits && (
                <div className="usage-budget-warning">
                  <AlertTriangle size={16} />
                  <span>
                    保存后会立即暂停 {runningTaskCount} 个运行中任务，因为当前用量已经达到新预算。
                  </span>
                </div>
              )}

            <div className="usage-budget-actions">
              <button type="button" onClick={requestCloseUsageBudget}>
                取消
              </button>
              <button
                className="confirm"
                type="button"
                disabled={usageBudgetDraftInvalid}
                onClick={saveUsageBudget}
              >
                <Check size={15} />
                保存预算
              </button>
            </div>
          </section>
        </div>
      )}

      {bulkApprovalDecision && selectedApprovals.length > 0 && (
        <div
          className="clarity-dialog-backdrop"
          onMouseDown={() => {
            setBulkApprovalDecision(null);
            setApprovalRejectReason("");
          }}
        >
          <section
            className={`bulk-approval-dialog is-${bulkApprovalDecision}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="bulk-approval-title"
            aria-describedby="bulk-approval-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="bulk-approval-close"
              type="button"
              aria-label="关闭批量审批确认"
              onClick={() => {
                setBulkApprovalDecision(null);
                setApprovalRejectReason("");
              }}
            >
              <X size={17} />
            </button>
            <span className="bulk-approval-icon">
              {bulkApprovalDecision === "approve" ? (
                <Check size={21} />
              ) : (
                <Ban size={21} />
              )}
            </span>
            <span className="bulk-approval-eyebrow">
              {bulkApprovalDecision === "approve"
                ? "批量批准操作"
                : "批量拒绝操作"}
            </span>
            <h2 id="bulk-approval-title">
              {bulkApprovalDecision === "approve"
                ? `批准 ${bulkApprovableApprovals.length} 项操作？`
                : `拒绝 ${selectedApprovals.length} 项操作？`}
            </h2>
            <p id="bulk-approval-description">
              {bulkApprovalDecision === "approve"
                ? "每项授权都只在原申请范围内生效，并会分别写入审计记录。"
                : "系统不会执行这些外部操作，关联任务将暂停；完成后可在底部提示中撤销。"}
            </p>

            <div className="bulk-approval-facts">
              <span>
                <small>当前选择</small>
                <strong>{selectedApprovals.length} 项</strong>
              </span>
              <span>
                <small>
                  {bulkApprovalDecision === "approve" ? "可以批准" : "将拒绝"}
                </small>
                <strong>
                  {bulkApprovalDecision === "approve"
                    ? bulkApprovableApprovals.length
                    : selectedApprovals.length}{" "}
                  项
                </strong>
              </span>
              <span>
                <small>关联任务</small>
                <strong>{selectedApprovalTaskCount} 个</strong>
              </span>
            </div>

            <div className="bulk-approval-list" aria-label="批量审批项目">
              {(bulkApprovalDecision === "approve"
                ? bulkApprovableApprovals
                : selectedApprovals
              )
                .slice(0, 4)
                .map((approval) => (
                  <span key={approval.id}>
                    <span>
                      <strong>{approval.title}</strong>
                      <small>{approval.target}</small>
                    </span>
                    <em className={`risk-${approval.risk}`}>
                      {approval.risk}
                    </em>
                  </span>
                ))}
              {(bulkApprovalDecision === "approve"
                ? bulkApprovableApprovals.length
                : selectedApprovals.length) > 4 && (
                <small>
                  另有{" "}
                  {(bulkApprovalDecision === "approve"
                    ? bulkApprovableApprovals.length
                    : selectedApprovals.length) - 4}{" "}
                  项操作
                </small>
              )}
            </div>

            {bulkApprovalDecision === "approve" &&
              selectedHighRiskApprovalCount > 0 && (
                <div className="bulk-approval-protected-note">
                  <ShieldCheck size={16} />
                  <span>
                    {selectedHighRiskApprovalCount} 项高风险操作不会被批量批准，将保留在队列中逐项审核。
                  </span>
                </div>
              )}

            {bulkApprovalDecision === "reject" && (
              <label className="approval-reject-reason">
                <span>
                  <strong>拒绝原因</strong>
                  <small>将写入每一条审批记录</small>
                </span>
                <textarea
                  data-overlay-initial-focus
                  aria-label="批量拒绝原因"
                  maxLength={120}
                  placeholder="例如：执行对象不正确，需要重新确认授权范围"
                  value={approvalRejectReason}
                  onChange={(event) =>
                    setApprovalRejectReason(event.target.value)
                  }
                />
                <small>{approvalRejectReason.trim().length} / 120，至少 4 个字</small>
              </label>
            )}

            <div className="bulk-approval-actions">
              <button
                type="button"
                data-overlay-initial-focus={
                  bulkApprovalDecision === "approve" ? true : undefined
                }
                onClick={() => {
                  setBulkApprovalDecision(null);
                  setApprovalRejectReason("");
                }}
              >
                返回检查
              </button>
              <button
                className={
                  bulkApprovalDecision === "approve" ? "confirm" : "danger"
                }
                type="button"
                disabled={
                  bulkApprovalDecision === "reject" &&
                  approvalRejectReason.trim().length < 4
                }
                onClick={
                  bulkApprovalDecision === "approve"
                    ? confirmBulkApprove
                    : confirmBulkReject
                }
              >
                {bulkApprovalDecision === "approve" ? (
                  <Check size={15} />
                ) : (
                  <Ban size={15} />
                )}
                {bulkApprovalDecision === "approve"
                  ? `批准 ${bulkApprovableApprovals.length} 项`
                  : `拒绝 ${selectedApprovals.length} 项`}
              </button>
            </div>
          </section>
        </div>
      )}

      {bulkDeleteOpen && (
        <div
          className="clarity-dialog-backdrop"
          onMouseDown={() => setBulkDeleteOpen(false)}
        >
          <section
            className="bulk-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-title"
            aria-describedby="bulk-delete-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="bulk-delete-close"
              type="button"
              aria-label="关闭批量删除确认"
              onClick={() => setBulkDeleteOpen(false)}
            >
              <X size={17} />
            </button>
            <span className="bulk-delete-icon">
              <Trash2 size={21} />
            </span>
            <span className="bulk-delete-eyebrow">批量删除任务</span>
            <h2 id="bulk-delete-title">
              删除 {deletableSelectedTasks.length} 个任务？
            </h2>
            <p id="bulk-delete-description">
              关联成果、审批事项和任务运行记录会一并移除。完成后可在底部提示中撤销。
            </p>

            <div className="bulk-delete-facts">
              <span>
                <small>当前选择</small>
                <strong>{selectedTasks.length} 个</strong>
              </span>
              <span>
                <small>可以删除</small>
                <strong>{deletableSelectedTasks.length} 个</strong>
              </span>
              <span>
                <small>受保护</small>
                <strong>{protectedSelectedTaskCount} 个</strong>
              </span>
            </div>

            <div className="bulk-delete-list" aria-label="将删除的任务">
              {deletableSelectedTasks.slice(0, 4).map((task) => (
                <span key={task.id}>
                  <span>
                    <strong>{task.title}</strong>
                    <small>{task.target}</small>
                  </span>
                  <em>{task.status}</em>
                </span>
              ))}
              {deletableSelectedTasks.length > 4 && (
                <small>另有 {deletableSelectedTasks.length - 4} 个任务</small>
              )}
            </div>

            {protectedSelectedTaskCount > 0 && (
              <div className="bulk-delete-protected-note">
                <Pin size={16} />
                <span>首页主任务受到保护，不会被删除。</span>
              </div>
            )}

            <div className="bulk-delete-actions">
              <button
                type="button"
                data-overlay-initial-focus
                onClick={() => setBulkDeleteOpen(false)}
              >
                返回检查
              </button>
              <button
                className="danger"
                type="button"
                onClick={confirmBulkDelete}
              >
                <Trash2 size={15} />
                删除 {deletableSelectedTasks.length} 个任务
              </button>
            </div>
          </section>
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
              任务配置、关联成果、审批和本机运行记录将移出工作区；完成后 10
              秒内可以恢复，原始数据源不会被删除。
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
              <button
                type="button"
                data-overlay-initial-focus
                onClick={() => setDeleteTaskId(null)}
              >
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
          onMouseDown={() => {
            setRejectApprovalId(null);
            setApprovalRejectReason("");
          }}
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
              onClick={() => {
                setRejectApprovalId(null);
                setApprovalRejectReason("");
              }}
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
            <label className="approval-reject-reason">
              <span>
                <strong>拒绝原因</strong>
                <small>将写入这条审批的审计记录</small>
              </span>
              <textarea
                data-overlay-initial-focus
                aria-label="拒绝原因"
                maxLength={120}
                placeholder="例如：执行对象不正确，需要重新确认授权范围"
                value={approvalRejectReason}
                onChange={(event) =>
                  setApprovalRejectReason(event.target.value)
                }
              />
              <small>{approvalRejectReason.trim().length} / 120，至少 4 个字</small>
            </label>
            <div className="approval-reject-note">
              <ShieldCheck size={16} />
              <span>
                不会发生任何外部操作；完成后 10 秒内可以撤销，决定仍会写入审计记录。
              </span>
            </div>
            <div className="approval-reject-actions">
              <button
                type="button"
                onClick={() => {
                  setRejectApprovalId(null);
                  setApprovalRejectReason("");
                }}
              >
                返回审核
              </button>
              <button
                className="danger"
                type="button"
                disabled={approvalRejectReason.trim().length < 4}
                onClick={confirmRejectApproval}
              >
                <Ban size={15} />
                确认拒绝
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingWorkspaceImport && (
        <div
          className="clarity-dialog-backdrop"
          onMouseDown={() => setPendingWorkspaceImport(null)}
        >
          <section
            className="workspace-import-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="workspace-import-title"
            aria-describedby="workspace-import-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="workspace-import-close"
              type="button"
              aria-label="关闭备份恢复预览"
              onClick={() => setPendingWorkspaceImport(null)}
            >
              <X size={17} />
            </button>
            <span className="workspace-import-icon">
              <Upload size={21} />
            </span>
            <span className="workspace-import-eyebrow">备份已通过校验</span>
            <h2 id="workspace-import-title">
              恢复“{pendingWorkspaceImport.fileName}”中的工作区？
            </h2>
            <p id="workspace-import-description">
              确认后，当前任务、成果、团队成员、审批状态、运行记录和设置会被这份备份替换。
            </p>

            <div className="workspace-import-meta">
              <span>
                <Clock3 size={16} />
                <span>
                  <small>备份时间</small>
                  <strong>
                    {formatAuditTimestamp(
                      pendingWorkspaceImport.backup.exportedAt,
                    )}
                  </strong>
                </span>
              </span>
              <span>
                <FileJson size={16} />
                <span>
                  <small>文件大小</small>
                  <strong>
                    {(pendingWorkspaceImport.fileSize / 1024).toFixed(1)} KB
                  </strong>
                </span>
              </span>
            </div>

            <div className="workspace-import-facts" aria-label="备份内容">
              <span>
                <small>任务</small>
                <strong>{pendingWorkspaceImport.backup.tasks.length}</strong>
              </span>
              <span>
                <small>成果</small>
                <strong>
                  {(pendingWorkspaceImport.backup.artifacts ?? initialArtifacts).length}
                </strong>
              </span>
              <span>
                <small>运行记录</small>
                <strong>{pendingWorkspaceImport.backup.activity.length}</strong>
              </span>
              <span>
                <small>待确认</small>
                <strong>
                  {
                    initialApprovals.filter((item) =>
                      pendingWorkspaceImport.backup.approvalIds.includes(item.id),
                    ).length
                  }
                </strong>
              </span>
            </div>

            <div className="workspace-import-comparison">
              <span>
                <small>当前工作区</small>
                <strong>{tasks.length} 个任务 · {artifacts.length} 项成果</strong>
              </span>
              <i><ChevronRight size={17} /></i>
              <span>
                <small>恢复后</small>
                <strong>
                  {pendingWorkspaceImport.backup.tasks.length} 个任务 ·{" "}
                  {(pendingWorkspaceImport.backup.artifacts ?? initialArtifacts).length}
                  {" "}项成果
                </strong>
              </span>
            </div>

            <div className="workspace-import-note">
              <ShieldCheck size={16} />
              <span>
                文件只在当前设备中读取。恢复前仍可先导出一份当前工作区备份。
              </span>
            </div>

            <button
              className="workspace-import-backup"
              type="button"
              onClick={exportWorkspace}
            >
              <Download size={16} />
              先备份当前工作区
            </button>

            <div className="workspace-import-actions">
              <button
                type="button"
                data-overlay-initial-focus
                onClick={() => setPendingWorkspaceImport(null)}
              >
                取消恢复
              </button>
              <button
                className="confirm"
                type="button"
                onClick={confirmWorkspaceImport}
              >
                <Upload size={15} />
                确认并恢复
              </button>
            </div>
          </section>
        </div>
      )}

      {temporaryModeOpen && (
        <div
          className="clarity-dialog-backdrop"
          onMouseDown={() => setTemporaryModeOpen(false)}
        >
          <section
            className="temporary-session-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="temporary-session-title"
            aria-describedby="temporary-session-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="temporary-session-close"
              type="button"
              aria-label="关闭临时会话确认"
              onClick={() => setTemporaryModeOpen(false)}
            >
              <X size={17} />
            </button>
            <span className="temporary-session-icon">
              <Timer size={21} />
            </span>
            <span className="temporary-session-eyebrow">数据保存方式</span>
            <h2 id="temporary-session-title">切换到临时会话？</h2>
            <p id="temporary-session-description">
              当前页面仍可继续使用，但刷新或关闭页面后，不会自动恢复这次工作区。
            </p>
            <div className="temporary-session-facts">
              <span>
                <small>当前任务</small>
                <strong>{tasks.length} 个</strong>
              </span>
              <span>
                <small>任务成果</small>
                <strong>{artifacts.length} 项</strong>
              </span>
              <span>
                <small>运行记录</small>
                <strong>{activityLog.length} 条</strong>
              </span>
            </div>
            <div className="temporary-session-note">
              <ShieldCheck size={16} />
              <span>
                这不会上传或立即删除当前页面中的数据。离开前重新开启保存即可保留。
              </span>
            </div>
            <button
              className="temporary-session-backup"
              type="button"
              onClick={exportWorkspace}
            >
              <Download size={16} />
              先导出工作区备份
            </button>
            <div className="temporary-session-actions">
              <button
                type="button"
                data-overlay-initial-focus
                onClick={() => setTemporaryModeOpen(false)}
              >
                保持本机保存
              </button>
              <button
                className="warning"
                type="button"
                onClick={confirmTemporaryMode}
              >
                <Timer size={15} />
                使用临时会话
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
              <button
                type="button"
                data-overlay-initial-focus
                onClick={() => setWorkspaceResetOpen(false)}
              >
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
        <div
          className={`clarity-toast ${noticeIsCaution ? "caution" : ""} ${
            artifactUndoAvailable ||
            taskDeleteUndoAvailable ||
            approvalRejectUndoAvailable
              ? "has-action"
              : ""
          }`}
          role={noticeIsCaution ? "alert" : "status"}
        >
          {noticeIsCaution ? (
            <AlertTriangle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <span>{notice}</span>
          {taskDeleteUndoAvailable && (
            <button
              className="clarity-toast-undo"
              type="button"
              onClick={undoTaskDelete}
            >
              <RotateCcw size={14} />
              恢复任务
            </button>
          )}
          {artifactUndoAvailable && (
            <button
              className="clarity-toast-undo"
              type="button"
              onClick={undoArtifactDelete}
            >
              <RotateCcw size={14} />
              撤销
            </button>
          )}
          {approvalRejectUndoAvailable && (
            <button
              className="clarity-toast-undo"
              type="button"
              onClick={undoApprovalReject}
            >
              <RotateCcw size={14} />
              撤销拒绝
            </button>
          )}
          <button
            className="clarity-toast-close"
            type="button"
            aria-label="关闭提示"
            onClick={() => {
              setNotice("");
              setTaskDeleteSnapshot(null);
              setArtifactDeleteSnapshot(null);
              setApprovalRejectSnapshot(null);
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
