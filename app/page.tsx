"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Globe2,
  History,
  Home,
  ListChecks,
  Mail,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

type ViewId = "home" | "tasks" | "approvals" | "activity" | "settings";

const navItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: "home", label: "首页", icon: Home },
  { id: "tasks", label: "任务", icon: ListChecks },
  { id: "approvals", label: "待确认", icon: ShieldCheck },
  { id: "activity", label: "运行记录", icon: History },
  { id: "settings", label: "设置", icon: Settings2 },
];

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

const initialTasks = [
  {
    id: "competitor",
    title: "跟踪竞品发布动态",
    description: "每天检查 3 个竞品页面，有变化时生成一份摘要。",
    status: "运行中",
    progress: 68,
    updated: "刚刚更新",
  },
  {
    id: "weekly-report",
    title: "整理本周项目进展",
    description: "汇总项目文件和工作记录，生成周报草稿。",
    status: "待确认",
    progress: 92,
    updated: "8 分钟前",
  },
  {
    id: "meeting",
    title: "准备产品评审材料",
    description: "整理评审议题、相关文件和待解决问题。",
    status: "已完成",
    progress: 100,
    updated: "今天 10:32",
  },
  {
    id: "research",
    title: "收集 AI 浏览器产品资料",
    description: "保存产品页面并提取功能、定价和团队信息。",
    status: "已完成",
    progress: 100,
    updated: "昨天 18:06",
  },
];

const initialApprovals = [
  {
    id: "send-summary",
    title: "把竞品摘要发送到领导沟通群",
    reason: "摘要已经生成，下一步会通过邮件连接器发送到群组。",
    impact: "发送后，群内 3 位成员可以看到这份摘要。",
    action: "发送摘要",
    icon: Send,
  },
  {
    id: "browser-access",
    title: "读取工作浏览器的登录状态",
    reason: "目标页面需要登录，系统想使用当前浏览器的会话继续访问。",
    impact: "只用于本次任务，任务结束后自动失效。",
    action: "允许本次访问",
    icon: Globe2,
  },
  {
    id: "write-report",
    title: "把报告保存到项目目录",
    reason: "系统准备把生成的报告写入当前项目。",
    impact: "将新增文件 competitor-report.md，不会修改其他文件。",
    action: "允许保存",
    icon: FileText,
  },
];

const activityItems = [
  {
    time: "14:28",
    title: "摘要已生成",
    detail: "整理出 4 项产品变化和 2 项值得关注的信号。",
    icon: Sparkles,
    tone: "blue",
  },
  {
    time: "14:26",
    title: "页面变化整理完成",
    detail: "对比了今天与昨天的页面内容，过滤了无意义变化。",
    icon: Brain,
    tone: "violet",
  },
  {
    time: "14:23",
    title: "完成 12 张页面截图",
    detail: "3 个目标页面均已读取，截图和页面结构已保存。",
    icon: Globe2,
    tone: "green",
  },
  {
    time: "09:00",
    title: "任务按计划开始",
    detail: "由每日 09:00 的计划自动启动。",
    icon: Clock3,
    tone: "neutral",
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

export default function HomePage() {
  const [activeView, setActiveView] = useState<ViewId>("home");
  const [query, setQuery] = useState("");
  const [isRunning, setIsRunning] = useState(true);
  const [selectedStep, setSelectedStep] = useState("analyze");
  const [approvals, setApprovals] = useState(initialApprovals);
  const [selectedApprovalId, setSelectedApprovalId] = useState(initialApprovals[0].id);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [taskName, setTaskName] = useState("跟踪一个新网页");
  const [taskTarget, setTaskTarget] = useState("https://example.com");
  const [queuedTasks, setQueuedTasks] = useState(0);
  const [settings, setSettings] = useState({
    approval: true,
    local: true,
    notifications: true,
  });

  const pageTitle = viewTitles[activeView];
  const selectedApproval =
    approvals.find((item) => item.id === selectedApprovalId) ?? approvals[0];

  const filteredTasks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return initialTasks;
    return initialTasks.filter((task) =>
      `${task.title} ${task.description} ${task.status}`.toLowerCase().includes(keyword),
    );
  }, [query]);

  function approveCurrent() {
    if (!selectedApproval) return;
    setApprovals((items) => items.filter((item) => item.id !== selectedApproval.id));
    setSelectedApprovalId(
      approvals.find((item) => item.id !== selectedApproval.id)?.id ?? "",
    );
    setNotice(`已允许：${selectedApproval.title}`);
  }

  function holdCurrent() {
    if (!selectedApproval) return;
    setNotice("已暂不执行，这项操作会继续留在待确认列表中");
  }

  function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskName.trim() || !taskTarget.trim()) return;
    setQueuedTasks((count) => count + 1);
    setComposerOpen(false);
    setNotice(`任务“${taskName.trim()}”已开始准备`);
  }

  function openView(view: ViewId) {
    setActiveView(view);
    setNotificationsOpen(false);
  }

  return (
    <main className="clarity-shell">
      <aside className="clarity-sidebar" aria-label="主导航">
        <div className="clarity-brand">
          <span>U1</span>
          <div>
            <strong>Unzoo One</strong>
            <small>AI 工作助理</small>
          </div>
        </div>

        <nav className="clarity-nav">
          {navItems.map((item) => (
            <button
              className={activeView === item.id ? "active" : ""}
              key={item.id}
              type="button"
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
            <label className="clarity-search">
              <Search size={16} />
              <input
                aria-label="搜索任务"
                placeholder="搜索任务"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

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
                      <strong>{approvals.length} 项操作等你确认</strong>
                      <small>外部发送前任务已经暂停</small>
                    </span>
                  </button>
                  <button type="button" onClick={() => openView("activity")}>
                    <CheckCircle2 size={17} />
                    <span>
                      <strong>竞品摘要已经生成</strong>
                      <small>包含 4 项产品变化</small>
                    </span>
                  </button>
                </div>
              )}
            </div>

            <button
              className="clarity-primary-button"
              type="button"
              onClick={() => setComposerOpen(true)}
            >
              <Plus size={17} />
              新建任务
            </button>
          </div>
        </header>

        {activeView === "home" && (
          <section className="home-view">
            <div className="home-summary" aria-label="今日概览">
              <span>
                <i className="running" />
                正在运行 <strong>{4 + queuedTasks}</strong>
              </span>
              <span>
                <i className="waiting" />
                等待确认 <strong>{approvals.length}</strong>
              </span>
              <span>
                <i className="done" />
                今天已完成 <strong>12</strong>
              </span>
            </div>

            <div className="home-focus-grid">
              <section className="active-task-panel" aria-label="正在运行的任务">
                <div className="focus-panel-heading">
                  <div>
                    <span>正在运行</span>
                    <strong>跟踪竞品发布动态</strong>
                  </div>
                  <span className={`live-state ${isRunning ? "" : "paused"}`}>
                    <i />
                    {isRunning ? "运行中" : "已暂停"}
                  </span>
                </div>

                <p className="task-purpose">
                  每天检查 3 个竞品页面。有变化时，系统会整理成一份可以直接阅读的摘要。
                </p>

                <div className="simple-progress">
                  <div>
                    <span>已完成 2 / 3 步</span>
                    <strong>{isRunning ? "68%" : "暂停"}</strong>
                  </div>
                  <span>
                    <i className={isRunning ? "moving" : ""} />
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
                    onClick={() => setIsRunning((running) => !running)}
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

                    <div className="plain-impact">
                      <ShieldCheck size={17} />
                      <span>
                        <strong>确认后会发生什么</strong>
                        <small>{selectedApproval.impact}</small>
                      </span>
                    </div>

                    <div className="attention-actions">
                      <button className="confirm" type="button" onClick={approveCurrent}>
                        <Check size={16} />
                        {selectedApproval.action}
                      </button>
                      <button type="button" onClick={holdCurrent}>暂不执行</button>
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
                {filteredTasks.slice(0, 3).map((task) => (
                  <button
                    className="recent-task-row"
                    key={task.id}
                    type="button"
                    onClick={() => setNotice(`已打开任务：${task.title}`)}
                  >
                    <span className={`task-status-dot status-${task.status}`} />
                    <span>
                      <strong>{task.title}</strong>
                      <small>{task.description}</small>
                    </span>
                    <em className={`status-label status-${task.status}`}>{task.status}</em>
                    <span className="task-updated">{task.updated}</span>
                    <ChevronRight size={16} />
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
                <button className="active" type="button">全部</button>
                <button type="button">运行中</button>
                <button type="button">待确认</button>
                <button type="button">已完成</button>
              </div>
              <button
                className="clarity-secondary-button"
                type="button"
                onClick={() => setComposerOpen(true)}
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
                  onClick={() => setNotice(`已打开任务：${task.title}`)}
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
            </div>
          </section>
        )}

        {activeView === "approvals" && (
          <section className="approvals-view">
            {approvals.length ? (
              <>
                <div className="approval-queue">
                  <div className="approval-queue-heading">
                    <span>等待处理</span>
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
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.reason}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>

                {selectedApproval && (
                  <div className="approval-detail">
                    <span className="approval-kicker">
                      <ShieldCheck size={15} />
                      等待你的确认
                    </span>
                    <h2>{selectedApproval.title}</h2>
                    <p>{selectedApproval.reason}</p>
                    <div className="approval-explanation">
                      <strong>确认后会发生什么</strong>
                      <p>{selectedApproval.impact}</p>
                    </div>
                    <div className="approval-scope">
                      <span><Check size={14} /> 只允许这一次</span>
                      <span><Check size={14} /> 操作会写入运行记录</span>
                      <span><Check size={14} /> 可以随时暂停任务</span>
                    </div>
                    <div className="approval-detail-actions">
                      <button className="confirm" type="button" onClick={approveCurrent}>
                        <Check size={16} />
                        {selectedApproval.action}
                      </button>
                      <button type="button" onClick={holdCurrent}>暂不执行</button>
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
            <div className="activity-summary">
              <Activity size={18} />
              <div>
                <strong>跟踪竞品发布动态</strong>
                <small>今天 09:00 开始 · 已运行 5 小时 28 分钟</small>
              </div>
              <span className="live-state"><i />运行中</span>
            </div>

            <div className="activity-timeline">
              {activityItems.map((item) => (
                <div className="timeline-row" key={`${item.time}-${item.title}`}>
                  <time>{item.time}</time>
                  <span className={`timeline-icon ${item.tone}`}>
                    <item.icon size={17} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotice(`正在查看：${item.title}`)}
                  >
                    查看
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeView === "settings" && (
          <section className="settings-view">
            <div className="settings-group">
              <div>
                <span>安全与确认</span>
                <h2>任务执行规则</h2>
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
                  onClick={() =>
                    setSettings((value) => ({ ...value, approval: !value.approval }))
                  }
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
                  onClick={() =>
                    setSettings((value) => ({ ...value, local: !value.local }))
                  }
                >
                  <i />
                </button>
              </label>
            </div>

            <div className="settings-group">
              <div>
                <span>通知</span>
                <h2>什么时候提醒我</h2>
              </div>
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
                  onClick={() =>
                    setSettings((value) => ({
                      ...value,
                      notifications: !value.notifications,
                    }))
                  }
                >
                  <i />
                </button>
              </label>
            </div>
          </section>
        )}
      </section>

      {composerOpen && (
        <div className="clarity-dialog-backdrop" onMouseDown={() => setComposerOpen(false)}>
          <form
            className="clarity-dialog"
            aria-label="新建任务"
            onSubmit={createTask}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="clarity-dialog-heading">
              <div>
                <span>新建任务</span>
                <h2>你希望 Unzoo One 做什么？</h2>
              </div>
              <button type="button" aria-label="关闭" onClick={() => setComposerOpen(false)}>
                <X size={17} />
              </button>
            </div>

            <label>
              <span>任务名称</span>
              <input
                required
                value={taskName}
                onChange={(event) => setTaskName(event.target.value)}
              />
            </label>

            <label>
              <span>要处理的网页</span>
              <input
                required
                type="url"
                value={taskTarget}
                onChange={(event) => setTaskTarget(event.target.value)}
              />
            </label>

            <div className="clarity-dialog-note">
              <ShieldCheck size={17} />
              <p>任何对外发送或敏感访问，都会先停下来等你确认。</p>
            </div>

            <div className="clarity-dialog-actions">
              <button type="button" onClick={() => setComposerOpen(false)}>取消</button>
              <button className="confirm" type="submit">
                <Plus size={16} />
                创建任务
              </button>
            </div>
          </form>
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
