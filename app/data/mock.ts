import { Brain, CalendarDays, FileText, Globe2, HardDrive, Mail, Send, Sparkles } from "lucide-react";
import type {
  ConnectorState,
  ActivityItem,
  ApprovalItem,
  ArtifactItem,
  ConnectorDefinition,
  ConnectorId,
  TaskItem,
  TaskSchedule,
  TeamMember,
  TeamRole,
  Weekday,
} from "../types";

export const connectorTestLatencies: Record<ConnectorId, number> = {
  browser: 176,
  workspace: 38,
  mail: 214,
  calendar: 196,
};

export const connectorErrorCodes: Record<ConnectorId, string[]> = {
  browser: ["BROWSER_AUTH_EXPIRED"],
  workspace: ["WORKSPACE_PERMISSION_REVOKED"],
  mail: ["MAIL_AUTH_EXPIRED"],
  calendar: ["CALENDAR_AUTH_EXPIRED"],
};

export const connectorCatalog: ConnectorDefinition[] = [
  {
    id: "browser",
    name: "Unzoo Browser",
    description: "读取网页、保存截图与提取页面结构",
    scope: "仅限任务指定页面",
    dataFlow: "外部网页 → 任务上下文",
    credential: "浏览器会话授权",
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
    dataFlow: "本机文件 ↔ 任务成果",
    credential: "设备本机权限",
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
    dataFlow: "审批结果 → 外部收件人",
    credential: "邮箱 OAuth 授权",
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
    dataFlow: "日历忙闲 ↔ 任务计划",
    credential: "日历 OAuth 授权",
    lastUsed: "尚未使用",
    permissions: ["读取空闲时间", "创建日程提醒", "更新任务时间"],
    icon: CalendarDays,
    tone: "violet",
  },
];

export const teamRoleDetails: Record<
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

export const teamSeatLimit = 10;

export const initialTeamMembers: TeamMember[] = [
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

export const initialTasks: TaskItem[] = [
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

export const demoTaskIds = new Set(initialTasks.map((task) => task.id));

export const initialApprovals: ApprovalItem[] = [
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

export const initialArtifacts: ArtifactItem[] = [
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

export const initialActivityItems: ActivityItem[] = [
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

export const runSteps = [
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

export const signalBars = [30, 44, 34, 58, 48, 72, 42, 64, 82, 52, 68, 46, 76, 60, 88, 62, 78, 96];

export const signalPoints = signalBars
  .map((height, index) => {
    const x = 2 + (index / (signalBars.length - 1)) * 96;
    const y = 48 - (height / 100) * 42;
    return `${x},${y}`;
  })
  .join(" ");

export const taskTemplates: Array<{
  id: string;
  label: string;
  title: string;
  description: string;
  target: string;
  targetHint: string;
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
    target: "",
    targetHint: "粘贴要监控的网页地址",
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
    target: "",
    targetHint: "输入研究主题、网页或资料库",
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
    target: "",
    targetHint: "选择项目文件夹或工作区",
    schedule: "每周",
    scheduleTime: "17:30",
    scheduleDay: "周五",
    icon: FileText,
  },
];

export const defaultConnectorStates: ConnectorState = {
  browser: true,
  workspace: true,
  mail: true,
  calendar: false,
};
