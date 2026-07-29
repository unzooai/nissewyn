"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Bell,
  Bot,
  Brain,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Database,
  FileText,
  Globe2,
  Grid2X2,
  LayoutDashboard,
  Mail,
  MonitorCog,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Radio,
  Route,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
  X,
} from "lucide-react";

const navItems = [
  { label: "控制台", icon: LayoutDashboard },
  { label: "任务流", icon: Workflow },
  { label: "大脑路由", icon: Brain },
  { label: "能力市场", icon: Grid2X2 },
  { label: "权限中心", icon: ShieldCheck },
  { label: "产物库", icon: Archive },
];

const palette = [
  { name: "浏览器观察", desc: "读取页面、截图、结构化提取", icon: Globe2, tone: "mint" },
  { name: "浏览器执行", desc: "点击、输入、上传、下载", icon: MousePointer2, tone: "lime" },
  { name: "终端运行", desc: "PTY、命令、代码验证", icon: TerminalSquare, tone: "blue" },
  { name: "邮件连接器", desc: "收件箱、草稿、发送审批", icon: Mail, tone: "coral" },
  { name: "日历连接器", desc: "日程检索、空闲时间、会议", icon: CalendarClock, tone: "amber" },
  { name: "长期记忆", desc: "任务上下文、偏好、事实库", icon: Database, tone: "violet" },
];

const brainRoutes = [
  { name: "Codex SDK", role: "代码与工具执行", health: "主路由" },
  { name: "Claude Agent SDK", role: "长文分析与沟通", health: "备用" },
  { name: "Gemini / ACP", role: "多模态补位", health: "待接入" },
];

const stageCards = [
  {
    id: "observe",
    number: "01",
    title: "观察网页",
    status: "已完成",
    body: "Unzoo 打开目标页面，完成截图、DOM 结构读取和页面变化提取。",
    activities: ["目标页面已打开", "12 张页面截图已保存", "DOM 结构与变化已提取"],
    icon: Globe2,
    className: "observe",
  },
  {
    id: "analyze",
    number: "02",
    title: "AI 分析",
    status: "进行中",
    body: "Codex 正在把页面变化整理成结论，并准备生成领导可读的简报。",
    activities: ["12 张截图已完成索引", "38 次工具调用已核对", "正在生成领导摘要"],
    icon: Bot,
    className: "analyze",
  },
  {
    id: "approve",
    number: "03",
    title: "发送前确认",
    status: "待审批",
    body: "发送对象、内容和授权范围都会在这里确认，批准后才会继续。",
    activities: ["发送对象等待确认", "凭证访问范围待授权", "报告写入目录已准备"],
    icon: Shield,
    className: "approve",
  },
];

const evidence = [
  { label: "页面截图", value: "12 张", icon: MonitorCog },
  { label: "工具调用", value: "38 次", icon: Route },
  { label: "审计事件", value: "146 条", icon: Radio },
];

const initialApprovals = [
  { id: "send", title: "发送摘要到领导沟通群", risk: "外部副作用", time: "8 分钟后过期" },
  { id: "cookie", title: "读取工作浏览器身份凭证", risk: "凭证访问", time: "需要一次性授权" },
  { id: "write", title: "写入生成报告到项目目录", risk: "本地修改", time: "等待确认范围" },
];

const audit = [
  "能力租约已续期：unzoo.local",
  "工具请求进入权限策略：brain:codex",
  "产物已登记：competitor-report.md",
  "恢复快照已加载：unterm-core",
];

export default function Home() {
  const [activeNav, setActiveNav] = useState("控制台");
  const [query, setQuery] = useState("");
  const [selectedCapability, setSelectedCapability] = useState("浏览器观察");
  const [selectedBrain, setSelectedBrain] = useState("Codex SDK");
  const [selectedStageId, setSelectedStageId] = useState("analyze");
  const [isRunning, setIsRunning] = useState(true);
  const [approvals, setApprovals] = useState(initialApprovals);
  const [composerOpen, setComposerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [selectedApprovalId, setSelectedApprovalId] = useState(initialApprovals[0].id);
  const [taskName, setTaskName] = useState("监控竞品发布页面");
  const [taskTarget, setTaskTarget] = useState("https://example.com/releases");
  const [queuedTasks, setQueuedTasks] = useState(0);
  const [notice, setNotice] = useState("");

  const filteredPalette = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return palette;
    return palette.filter((item) =>
      `${item.name} ${item.desc}`.toLowerCase().includes(keyword),
    );
  }, [query]);

  const selectedStage = stageCards.find((stage) => stage.id === selectedStageId) ?? stageCards[1];
  const selectedCapabilityItem =
    palette.find((item) => item.name === selectedCapability) ?? palette[0];
  const pendingCount = approvals.length;
  const approvedCount = initialApprovals.length - approvals.length;
  const selectedApproval =
    approvals.find((item) => item.id === selectedApprovalId) ?? approvals[0];
  const highestRisk =
    approvals.find((item) => item.risk === "凭证访问")?.risk ??
    approvals[0]?.risk;

  function approveFirst() {
    if (!selectedApproval) return;
    setApprovals((items) => items.filter((item) => item.id !== selectedApproval.id));
    setSelectedApprovalId(
      approvals.find((item) => item.id !== selectedApproval.id)?.id ?? "",
    );
    setSelectedStageId("approve");
    setNotice(`已批准：${selectedApproval.title}`);
  }

  function selectApproval(id: string) {
    setSelectedApprovalId(id);
    setSelectedStageId("approve");
  }

  function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = taskName.trim();
    const target = taskTarget.trim();
    if (!name || !target) return;
    setQueuedTasks((count) => count + 1);
    setComposerOpen(false);
    setNotice(`任务“${name}”已加入运行队列`);
  }

  function switchView(label: string) {
    setActiveNav(label);
    setNotice(`已切换到${label}`);
  }

  return (
    <main className="product-shell">
      <aside className="rail" aria-label="主导航">
        <div className="logo-block">
          <div className="logo-mark">U1</div>
          <div>
            <span>Unzoo One</span>
            <strong>个人 AI 操作系统</strong>
          </div>
        </div>

        <nav className="rail-nav">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`rail-link ${activeNav === item.label ? "active" : ""}`}
              type="button"
              aria-label={item.label}
              onClick={() => switchView(item.label)}
            >
              <item.icon size={18} strokeWidth={1.9} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="runtime-badge">
          <span className="pulse-dot" />
          <div>
            <strong>{isRunning ? "Core 正在运行" : "Core 已暂停"}</strong>
            <small>当前视图：{activeNav}</small>
          </div>
        </div>
      </aside>

      <section className="command-area">
        <header className="command-header">
          <div className="title-group">
            <span className="workspace-chip">
              <Sparkles size={14} />
              MVP 操作台 · 本地优先
            </span>
            <h1>AI 任务控制台</h1>
            <p>把长期任务、能力调用、审批和证据沉淀在同一个可靠的操作面里。</p>
          </div>

          <div className="header-tools">
            <label className="search-field">
              <Search size={16} />
              <input
                aria-label="搜索"
                placeholder="搜索任务、能力、审批"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="notification-wrap">
              <button
                className={`icon-action ${notificationsOpen ? "active" : ""}`}
                type="button"
                aria-label="通知"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={18} />
                <span className="notification-dot" />
              </button>
              {notificationsOpen && (
                <div className="notification-popover" role="dialog" aria-label="通知中心">
                  <div className="popover-heading">
                    <div>
                      <span>通知中心</span>
                      <strong>3 条新动态</strong>
                    </div>
                    <button type="button" aria-label="关闭通知" onClick={() => setNotificationsOpen(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <button type="button" onClick={() => setSelectedStageId("approve")}>
                    <span className="notice-tone amber" />
                    <div>
                      <strong>有 3 项操作等待审批</strong>
                      <small>其中 1 项涉及浏览器身份凭证</small>
                    </div>
                  </button>
                  <button type="button" onClick={() => setSelectedStageId("analyze")}>
                    <span className="notice-tone blue" />
                    <div>
                      <strong>页面分析仍在运行</strong>
                      <small>已整理 12 张截图和 38 次工具调用</small>
                    </div>
                  </button>
                </div>
              )}
            </div>
            <button
              className="create-action"
              type="button"
              onClick={() => setComposerOpen((open) => !open)}
            >
              <Plus size={18} />
              新建任务
            </button>
          </div>
        </header>

        <section className="mission-strip" aria-label="运行摘要">
          <div>
            <span>今日运行</span>
            <strong>{isRunning ? 18 + queuedTasks : 17 + queuedTasks}</strong>
            <small>{isRunning ? `${4 + queuedTasks} 个任务正在执行` : "任务已暂停，等待恢复"}</small>
          </div>
          <div>
            <span>等待审批</span>
            <strong>{pendingCount}</strong>
            <small>{pendingCount ? `最高风险：${highestRisk}` : "审批队列已清空"}</small>
          </div>
          <div>
            <span>能力健康度</span>
            <strong>97%</strong>
            <small>已选择：{selectedCapability}</small>
          </div>
          <div>
            <span>证据产物</span>
            <strong>146</strong>
            <small>本轮已批准 {approvedCount} 项</small>
          </div>
        </section>

        <section className="studio-grid">
          <section className="palette-panel" aria-label="能力市场">
            <div className="section-heading">
              <div>
                <span>能力工具</span>
                <h2>能力市场</h2>
              </div>
              <button
                type="button"
                aria-label={paletteOpen ? "收起能力市场" : "展开能力市场"}
                aria-expanded={paletteOpen}
                onClick={() => setPaletteOpen((open) => !open)}
              >
                <ChevronDown className={paletteOpen ? "rotate-open" : ""} size={18} />
              </button>
            </div>

            {paletteOpen && (
              <>
                <div className="palette-list">
                  {filteredPalette.map((item) => (
                    <button
                      className={`palette-row ${item.tone} ${selectedCapability === item.name ? "selected" : ""}`}
                      key={item.name}
                      type="button"
                      onClick={() => {
                        setSelectedCapability(item.name);
                        setNotice(`已启用能力：${item.name}`);
                      }}
                    >
                      <item.icon size={18} />
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.desc}</small>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                  {!filteredPalette.length && <p className="empty-note">没有匹配的能力。</p>}
                </div>

                <div className="capability-detail">
                  <selectedCapabilityItem.icon size={18} />
                  <div>
                    <span>已选择能力</span>
                    <strong>{selectedCapabilityItem.name}</strong>
                    <small>{selectedCapabilityItem.desc}</small>
                  </div>
                </div>
              </>
            )}

            <div className="brain-route-box">
              <div className="section-heading compact">
                <div>
                  <span>模型路由</span>
                  <h2>大脑路由</h2>
                </div>
              </div>
              {brainRoutes.map((route) => (
                <button
                  className={`brain-row ${selectedBrain === route.name ? "selected" : ""}`}
                  key={route.name}
                  type="button"
                  onClick={() => {
                    setSelectedBrain(route.name);
                    setNotice(`模型路由已切换为 ${route.name}`);
                  }}
                >
                  <Brain size={16} />
                  <div>
                    <strong>{route.name}</strong>
                    <small>{route.role}</small>
                  </div>
                  <span>{selectedBrain === route.name ? "使用中" : route.health}</span>
                </button>
              ))}
            </div>
          </section>

          <section
            className={`canvas-panel ${isRunning ? "is-running" : "is-paused"}`}
            aria-label="任务流画布"
          >
            <div className="canvas-toolbar">
              <div>
                <span>自动化流程</span>
                <h2>竞品信号自动化任务</h2>
              </div>
              <div className="toolbar-actions">
                <button
                  type="button"
                  aria-label={isRunning ? "暂停任务" : "继续任务"}
                  onClick={() => setIsRunning((running) => !running)}
                >
                  {isRunning ? <Pause size={16} /> : <Play size={16} />}
                </button>
              </div>
            </div>

            <div className="workflow-canvas">
              <div className="run-hero-card">
                <div>
                  <span>当前任务</span>
                  <strong>竞品发布信号自动化</strong>
                  <p>当前由 {selectedBrain} 调度，使用「{selectedCapability}」。任何发送到外部渠道的动作，都会先停下来让你批准。</p>
                </div>
                <div className="run-progress" aria-label="任务进度 68%">
                  <span>{isRunning ? "68%" : "暂停"}</span>
                </div>
              </div>

              <div className="stage-stepper" aria-label="任务运行步骤">
                {stageCards.map((stage) => (
                  <button
                    className={`stage-step ${stage.className} ${selectedStageId === stage.id ? "active" : ""}`}
                    key={stage.id}
                    type="button"
                    onClick={() => setSelectedStageId(stage.id)}
                  >
                    <span className="step-number">{stage.number}</span>
                    <span className="step-icon">
                      <stage.icon size={18} />
                    </span>
                    <div>
                      <strong>{stage.title}</strong>
                      <small>{stage.id === "analyze" && !isRunning ? "已暂停" : stage.status}</small>
                    </div>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>

              <div className={`stage-detail ${selectedStage.className}`}>
                <div className="stage-detail-copy">
                  <div className="detail-eyebrow">
                    <span className="detail-icon">
                      <selectedStage.icon size={19} />
                    </span>
                    <span>当前步骤</span>
                    <em>{selectedStage.id === "analyze" && !isRunning ? "已暂停" : selectedStage.status}</em>
                  </div>
                  <h3>{selectedStage.title}</h3>
                  <p>{selectedStage.body}</p>
                  <div className="detail-actions">
                    <button type="button" onClick={() => setIsRunning((running) => !running)}>
                      {isRunning ? <Pause size={15} /> : <Play size={15} />}
                      {isRunning ? "暂停任务" : "继续任务"}
                    </button>
                    <button className="primary" type="button" onClick={() => setSelectedStageId("approve")}>
                      <Shield size={15} />
                      查看审批
                    </button>
                  </div>
                </div>
                <div className="activity-panel" aria-label="实时活动">
                  <div className="activity-heading">
                    <span>实时活动</span>
                    <strong>
                      <i />
                      {isRunning ? "运行中" : "已暂停"}
                    </strong>
                  </div>
                  {selectedStage.activities.map((activity, index) => (
                    <div className="activity-row" key={activity}>
                      <span className={index === selectedStage.activities.length - 1 ? "current" : ""}>
                        {index === selectedStage.activities.length - 1 ? <Radio size={14} /> : <Check size={14} />}
                      </span>
                      <div>
                        <strong>{activity}</strong>
                        <small>{index === selectedStage.activities.length - 1 ? "刚刚更新" : `${index + 2} 分钟前`}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="evidence-strip">
              {evidence.map((item) => (
                <div className="evidence-item" key={item.label}>
                  <item.icon size={18} />
                  <div>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="inspector-panel" aria-label="审批检查器">
            <div className="approval-hero">
              <span className="workspace-chip warning">
                <Shield size={14} />
                审批检查器
              </span>
              <h2>{pendingCount ? selectedApproval?.title : "审批已完成"}</h2>
              <p>
                {pendingCount
                  ? `${selectedApproval?.risk} · ${selectedApproval?.time}。确认后只批准当前选中的这一项。`
                  : "当前任务没有阻塞项，可以继续进入下一步。"}
              </p>
              <div className="risk-meter" aria-label="风险等级">
                <span />
                <strong>{pendingCount ? "高风险" : "无阻塞"}</strong>
              </div>
              <div className="approval-buttons">
                <button className="allow" type="button" onClick={approveFirst} disabled={!pendingCount}>
                  <Check size={16} />
                  {pendingCount ? "批准所选" : "已处理"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRunning(false);
                    setNotice("任务已暂停并转入人工处理");
                  }}
                >
                  转人工
                </button>
              </div>
            </div>

            <div className="approval-list">
              {approvals.map((item) => (
                <button
                  className={`approval-row ${selectedApproval?.id === item.id ? "selected" : ""}`}
                  key={item.id}
                  type="button"
                  onClick={() => selectApproval(item.id)}
                >
                  <Circle size={10} />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.risk} · {item.time}</small>
                  </div>
                </button>
              ))}
              {!approvals.length && (
                <div className="approval-empty">
                  <Check size={16} />
                  <span>审批队列已清空</span>
                </div>
              )}
            </div>

            <div className="audit-box">
              <div className="section-heading compact">
                <div>
                  <span>操作记录</span>
                  <h2>实时审计</h2>
                </div>
              </div>
              {audit.map((item) => (
                <p key={item}>{item}</p>
              ))}
              {approvedCount > 0 && <p>本轮已批准：{approvedCount} 项</p>}
            </div>
          </aside>
        </section>
      </section>

      {composerOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setComposerOpen(false)}>
          <form
            className="task-dialog"
            aria-label="新建任务"
            onSubmit={createTask}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dialog-heading">
              <div>
                <span>新建自动化任务</span>
                <h2>把一个目标交给 Unzoo One</h2>
              </div>
              <button type="button" aria-label="关闭新建任务" onClick={() => setComposerOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <label>
              <span>任务名称</span>
              <input required value={taskName} onChange={(event) => setTaskName(event.target.value)} />
            </label>
            <label>
              <span>目标网页</span>
              <input
                required
                type="url"
                inputMode="url"
                value={taskTarget}
                onChange={(event) => setTaskTarget(event.target.value)}
              />
            </label>
            <div className="dialog-summary">
              <Globe2 size={18} />
              <p>系统会观察网页变化、调用 {selectedBrain} 分析，并在任何外部发送动作前等待审批。</p>
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={() => setComposerOpen(false)}>取消</button>
              <button className="primary" type="submit">
                <Plus size={16} />
                加入运行队列
              </button>
            </div>
          </form>
        </div>
      )}

      {notice && (
        <div className="action-toast" role="status">
          <Check size={16} />
          <span>{notice}</span>
          <button type="button" aria-label="关闭提示" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
