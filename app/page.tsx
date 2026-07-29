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
  Clock3,
  Database,
  FileText,
  Fingerprint,
  Globe2,
  Grid2X2,
  KeyRound,
  LayoutDashboard,
  Mail,
  MonitorCog,
  MousePointer2,
  Network,
  Pause,
  Play,
  Plus,
  Radio,
  Route,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
  Zap,
} from "lucide-react";

const navItems = [
  { label: "控制台", icon: LayoutDashboard, active: true },
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
  { name: "Codex SDK", role: "代码与工具执行", health: "主路由", load: "63%" },
  { name: "Claude Agent SDK", role: "长文分析与沟通", health: "备用", load: "24%" },
  { name: "Gemini / ACP", role: "多模态补位", health: "待接入", load: "0%" },
];

const nodes = [
  { label: "每天 09:00", sub: "Cron 触发", icon: Clock3, className: "node-cron" },
  { label: "读取竞品页面", sub: "Unzoo Browser", icon: Globe2, className: "node-browser" },
  { label: "Codex 分析", sub: "Brain Router", icon: Bot, className: "node-brain" },
  { label: "权限闸门", sub: "Policy Engine", icon: Shield, className: "node-policy" },
  { label: "生成简报", sub: "Artifact Registry", icon: FileText, className: "node-doc" },
  { label: "领导审批", sub: "Approval", icon: Fingerprint, className: "node-approval" },
  { label: "发送摘要", sub: "Mail Connector", icon: Send, className: "node-send" },
];

const evidence = [
  { label: "页面截图", value: "12 张", icon: MonitorCog },
  { label: "工具调用", value: "38 次", icon: Route },
  { label: "审计事件", value: "146 条", icon: Radio },
];

const approvals = [
  { title: "发送摘要到领导沟通群", risk: "外部副作用", time: "8 分钟后过期" },
  { title: "读取工作浏览器身份凭证", risk: "凭证访问", time: "需要一次性授权" },
  { title: "写入生成报告到项目目录", risk: "本地修改", time: "等待确认范围" },
];

const audit = [
  "能力租约已续期：unzoo.local",
  "工具请求进入权限策略：brain:codex",
  "产物已登记：competitor-report.md",
  "恢复快照已加载：unterm-core",
];

export default function Home() {
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
              className={`rail-link ${item.active ? "active" : ""}`}
              type="button"
              aria-label={item.label}
            >
              <item.icon size={18} strokeWidth={1.9} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="runtime-badge">
          <span className="pulse-dot" />
          <div>
            <strong>Core 正在运行</strong>
            <small>任务、审批、审计均已接入</small>
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
            <h1>把长期任务交给 AI，但每一步都能看见、批准和追溯。</h1>
          </div>

          <div className="header-tools">
            <label className="search-field">
              <Search size={16} />
              <input aria-label="搜索" placeholder="搜索任务、能力、审批" />
            </label>
            <button className="icon-action" type="button" aria-label="通知">
              <Bell size={18} />
            </button>
            <button className="create-action" type="button">
              <Plus size={18} />
              新建任务
            </button>
          </div>
        </header>

        <section className="mission-strip" aria-label="运行摘要">
          <div>
            <span>今日运行</span>
            <strong>18</strong>
            <small>4 个任务正在执行</small>
          </div>
          <div>
            <span>等待审批</span>
            <strong>3</strong>
            <small>最高风险：凭证访问</small>
          </div>
          <div>
            <span>能力健康度</span>
            <strong>97%</strong>
            <small>Unzoo Browser 已绑定</small>
          </div>
          <div>
            <span>证据产物</span>
            <strong>146</strong>
            <small>全部关联到任务</small>
          </div>
        </section>

        <section className="studio-grid">
          <section className="palette-panel" aria-label="能力市场">
            <div className="section-heading">
              <div>
                <span>Capability Marketplace</span>
                <h2>能力市场</h2>
              </div>
              <button type="button" aria-label="展开能力市场">
                <ChevronDown size={18} />
              </button>
            </div>

            <div className="palette-list">
              {palette.map((item) => (
                <div className={`palette-row ${item.tone}`} key={item.name}>
                  <item.icon size={18} />
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.desc}</small>
                  </div>
                  <ChevronRight size={16} />
                </div>
              ))}
            </div>

            <div className="brain-route-box">
              <div className="section-heading compact">
                <div>
                  <span>Brain Adapter Bus</span>
                  <h2>大脑路由</h2>
                </div>
              </div>
              {brainRoutes.map((route) => (
                <div className="brain-row" key={route.name}>
                  <Brain size={16} />
                  <div>
                    <strong>{route.name}</strong>
                    <small>{route.role}</small>
                  </div>
                  <span>{route.health}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="canvas-panel" aria-label="任务流画布">
            <div className="canvas-toolbar">
              <div>
                <span>Task Flow</span>
                <h2>竞品信号自动化任务</h2>
              </div>
              <div className="toolbar-actions">
                <button type="button" aria-label="暂停">
                  <Pause size={16} />
                </button>
                <button type="button" aria-label="运行">
                  <Play size={16} />
                </button>
              </div>
            </div>

            <div className="workflow-canvas">
              <div className="canvas-line line-a" />
              <div className="canvas-line line-b" />
              <div className="canvas-line line-c" />
              <div className="canvas-line line-d" />
              <div className="canvas-line line-e" />
              <div className="canvas-line line-f" />

              {nodes.map((node) => (
                <div className={`flow-node ${node.className}`} key={node.label}>
                  <node.icon size={18} />
                  <div>
                    <strong>{node.label}</strong>
                    <small>{node.sub}</small>
                  </div>
                </div>
              ))}

              <div className="canvas-center">
                <Network size={28} />
                <span>Observe · Act · Verify</span>
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
              <h2>发送前需要你批准</h2>
              <p>目标动作会影响外部沟通渠道，默认进入提交前审批。</p>
              <div className="risk-meter" aria-label="风险等级">
                <span />
                <strong>高风险</strong>
              </div>
              <div className="approval-buttons">
                <button className="allow" type="button">
                  <Check size={16} />
                  批准一次
                </button>
                <button type="button">转人工</button>
              </div>
            </div>

            <div className="approval-list">
              {approvals.map((item) => (
                <div className="approval-row" key={item.title}>
                  <Circle size={10} />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.risk} · {item.time}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="audit-box">
              <div className="section-heading compact">
                <div>
                  <span>Audit Stream</span>
                  <h2>实时审计</h2>
                </div>
              </div>
              {audit.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
