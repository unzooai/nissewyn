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
    icon: Globe2,
    className: "observe",
  },
  {
    id: "analyze",
    number: "02",
    title: "AI 分析",
    status: "进行中",
    body: "Codex 正在把页面变化整理成结论，并准备生成领导可读的简报。",
    icon: Bot,
    className: "analyze",
  },
  {
    id: "approve",
    number: "03",
    title: "发送前确认",
    status: "待审批",
    body: "发送对象、内容和授权范围都会在这里确认，批准后才会继续。",
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

  function approveFirst() {
    setApprovals((items) => items.slice(1));
    setSelectedStageId("approve");
  }

  function approveById(id: string) {
    setApprovals((items) => items.filter((item) => item.id !== id));
    setSelectedStageId("approve");
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
              onClick={() => setActiveNav(item.label)}
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
            <button className="icon-action" type="button" aria-label="通知">
              <Bell size={18} />
            </button>
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
            <strong>{isRunning ? "18" : "17"}</strong>
            <small>{isRunning ? "4 个任务正在执行" : "任务已暂停，等待恢复"}</small>
          </div>
          <div>
            <span>等待审批</span>
            <strong>{pendingCount}</strong>
            <small>{pendingCount ? "最高风险：凭证访问" : "审批队列已清空"}</small>
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
              <button type="button" aria-label="展开能力市场">
                <ChevronDown size={18} />
              </button>
            </div>

            <div className="palette-list">
              {filteredPalette.map((item) => (
                <button
                  className={`palette-row ${item.tone} ${selectedCapability === item.name ? "selected" : ""}`}
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedCapability(item.name)}
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
                  onClick={() => setSelectedBrain(route.name)}
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

          <section className="canvas-panel" aria-label="任务流画布">
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
              {composerOpen && (
                <div className="task-composer">
                  <div>
                    <span>快速创建</span>
                    <strong>监控一个网页，并在变化后生成摘要</strong>
                  </div>
                  <button type="button" onClick={() => setComposerOpen(false)}>
                    加入队列
                  </button>
                </div>
              )}

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

              <div className="stage-board" aria-label="任务运行看板">
                {stageCards.map((stage) => (
                  <button
                    className={`stage-card ${stage.className} ${selectedStageId === stage.id ? "selected" : ""}`}
                    key={stage.id}
                    type="button"
                    onClick={() => setSelectedStageId(stage.id)}
                  >
                    <div className="stage-topline">
                      <span>{stage.number}</span>
                      <em>{stage.id === "analyze" && !isRunning ? "已暂停" : stage.status}</em>
                    </div>
                    <div className="stage-icon">
                      <stage.icon size={22} />
                    </div>
                    <h3>{stage.title}</h3>
                    <p>{stage.body}</p>
                    {stage.id === "observe" && (
                      <div className="mini-browser" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </div>
                    )}
                    {stage.id === "analyze" && (
                      <div className="signal-lines" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </div>
                    )}
                    {stage.id === "approve" && (
                      <div className="approval-preview" aria-hidden="true">
                        <b />
                        <span />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="run-output-card">
                <selectedStage.icon size={20} />
                <div>
                  <span>当前选择</span>
                  <strong>{selectedStage.title} · {selectedStage.status}</strong>
                </div>
                <button type="button" onClick={() => setSelectedStageId("approve")}>
                  查看审批
                </button>
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
              <h2>{pendingCount ? "发送前需要你批准" : "审批已完成"}</h2>
              <p>{pendingCount ? "目标动作会影响外部沟通渠道，默认进入提交前审批。" : "当前任务没有阻塞项，可以继续进入下一步。"}</p>
              <div className="risk-meter" aria-label="风险等级">
                <span />
                <strong>{pendingCount ? "高风险" : "无阻塞"}</strong>
              </div>
              <div className="approval-buttons">
                <button className="allow" type="button" onClick={approveFirst} disabled={!pendingCount}>
                  <Check size={16} />
                  {pendingCount ? "批准一次" : "已处理"}
                </button>
                <button type="button" onClick={() => setIsRunning(false)}>转人工</button>
              </div>
            </div>

            <div className="approval-list">
              {approvals.map((item) => (
                <button className="approval-row" key={item.id} type="button" onClick={() => approveById(item.id)}>
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
    </main>
  );
}
