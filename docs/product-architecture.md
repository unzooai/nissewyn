# Nissewyn 产品架构与 Unterm / Unzoo 能力审计

> 状态：产品架构草案
> 日期：2026-07-26
> 范围：Unterm、Unzoo Browser、Codex / Claude / Gemini 等 Agent Runtime

> 产品名：**Nissewyn — Your Personal AI Operating System**

> **归属修订 2026-08-06**：本文档 §1、§4、§6、§8、§10 原将 Unterm 定位为「个人助理控制平面」。
> 该定位已纠正——**Nissewyn 自身是唯一控制平面**，Unterm 与 Unzoo 是同级 Provider。
> 详见 `unzooai/nissewyn#2`（One Epic）、`zhitongblog/unterm#20`（Unterm 收窄为 Terminal Provider）、
> `unzooai/unzoo#73`（Unzoo Provider Epic）。§3 的能力审计为当时事实记录，保留不改。

## 1. 执行摘要

本项目不应被定义为“给浏览器或终端加一个 AI”，而应被定义为：

> 一个本地优先、可更换大脑、可持续运行、可审计，并能安全操作终端、浏览器和桌面应用的个人数字同事运行时。

推荐的核心分工：

- **Nissewyn**：唯一控制平面。自有常驻运行时 `one-core`，负责 Workspace、任务、大脑路由、权限、审批、记忆、调度、Provider 编排、审计与产物。
- **Unterm**：Terminal Provider。负责 PTY、Session、Screen、Scrollback、终端内 Agent 会话，以及自身的本地执行闸门。同时是一个独立的 AI 原生终端产品。
- **Unzoo**：Browser / Computer Provider。负责观察页面与桌面、执行动作、管理浏览器身份，并提供动作证据。
- **Codex / Claude / Gemini / OpenCode 等**：可插拔 Brain Provider，负责推理、规划和生成下一步行动。
- **MCP / SDK / ACP**：能力与大脑接入协议。
- **本地持久化层**：由 One 持有，保存任务、运行、事件、审批、记忆、产物和审计记录。

平台只能有一个全局控制平面，且它必须是产品自身而不是某个 Provider。Provider 拥有服务于自身独立使用的局部状态是正当的，但不对外充当全局真相；Unzoo 内部 Brain 定位为“浏览器局部自动驾驶”。

授权是**两层纵深防御**，不是两套真相：One 决定「该不该做」，Provider 决定「能不能在我这里做」——Provider 不信任调用方，即使 One 声称已授权仍自行校验 lease 与 scope。

## 2. 产品目标

### 2.1 用户价值

用户可以用自然语言下达一个长期目标，例如：

- 搜集信息并形成报告。
- 登录多个平台处理工作。
- 运行代码、修改项目、检查结果。
- 监控邮件、日历、网页或本地文件变化。
- 在获得授权后发布内容、发送消息或操作桌面应用。
- 任务失败、需要登录或涉及高风险动作时，通知用户接管或审批。

### 2.2 产品原则

1. **本地优先**：凭证、记忆、任务记录和敏感产物默认保存在本机。
2. **大脑可替换**：Codex、Claude、Gemini 等不能与任务系统强耦合。
3. **能力可组合**：终端、浏览器、桌面、邮件、日历等作为独立 Provider 接入。
4. **权限先于执行**：所有实际副作用必须经过同一个策略和审批入口。
5. **长任务可恢复**：GUI 关闭、进程重启或模型中断后仍能恢复。
6. **全程可审计**：每个动作应知道是谁、因何任务、使用什么授权、产生什么结果。
7. **观察—行动—验证**：不能只发出鼠标键盘事件，必须验证动作是否在正确目标上生效。

## 3. 当前能力审计

## 3.1 Unterm

### 已有能力

- 99 个 MCP 方法、21 个命名空间。
- 多实例终端与实例发现。
- Agent Cockpit、Inbox、Fleet、Review。
- PTY 创建、输入、读取、截图、命令执行和进程信号。
- Codex、Claude Code、Gemini、OpenCode、Kimi、Trae 等 CLI 的安装、配置和启动支持。
- MCP Token、Identity Profile、Secret Vault、受信 Agent、命令策略与审计。
- Git worktree、checkpoint、diff、验证和合并能力。

### 缺口 U-A：没有真正的无头 Core

当前 MCP Server 在 Unterm GUI 启动链中启动。GUI 未运行时，MCP Bridge 无法提供终端能力。

影响：

- 不能作为系统常驻个人助理。
- 关闭桌面窗口会终止控制平面。
- 无法可靠承载定时任务和跨天任务。
- GUI 与后台运行时生命周期耦合。

建议拆分：

```text
unterm-core.exe       常驻服务；任务、PTY、MCP、策略、审计
unterm-desktop.exe    可选 GUI；连接到 Core
unterm-cli.exe        CLI 客户端；连接到 Core
```

### 缺口 U-B：Brain 接入只是 CLI 启动

当前 `agent run` 主要把 Prompt 转换为：

- `codex exec <prompt>`
- `claude -p <prompt>`
- `gemini -p <prompt>`
- `opencode run <prompt>`

尚未形成统一的 Brain Runtime：

- 没有规范化的事件流。
- 没有统一的 conversation/thread 恢复。
- 没有统一工具调用与审批事件。
- 没有统一 Token、费用和上下文使用统计。
- 没有统一 interrupt、resume、handoff 协议。
- `--json` 主要用于 dry-run 输出，不代表 Agent 的结构化事件流。

### 缺口 U-C：存在等价执行路径的策略绕过

`session.input` 会进入用户确认逻辑，但 `exec.run` 与 `exec.run_wait` 只检查命令字符串黑名单，然后直接向 PTY 写入。

同时，策略结构虽然定义了 `allowed_patterns`，实际检查逻辑没有使用它。

风险：

- 同一个 shell 命令通过不同 MCP 方法调用时，审批行为不一致。
- 默认关闭的字符串黑名单不足以成为数字助理权限边界。
- Agent 身份基于自报名称，不能用于强安全认证。

### 缺口 U-D：缺少持久化任务模型

缺少统一持久化对象：

```text
Task
Run
Step
BrainTurn
ToolCall
Approval
CapabilityGrant
Artifact
Memory
Event
```

现有 Cockpit/Fleet 更偏向终端内 Agent 管理，尚不能代替通用个人助理任务引擎。

### 缺口 U-E：审计和权限粒度不足

- MCP 审计日志主要保存在进程内环形队列。
- 命令策略基于字符串模式。
- 缺少按用户、任务、Provider、工具、资源和副作用类型进行授权。
- 缺少签名或防篡改的持久化证据链。
- 缺少“一次授权”“本任务授权”“永久授权”的统一模型。

### 缺口 U-F：缺少平台级能力

- 个人长期记忆。
- 系统级 Scheduler 和 Trigger。
- Artifact Registry。
- Provider Registry。
- 模型路由、降级、成本和配额。
- 手机通知与远程审批。
- 邮件、日历、联系人等个人数据连接器。

## 3.2 Unzoo

### 已有能力

- Chromium 148 fork 与 Rust daemon。
- REST、MCP 220+、CDP 接口。
- Accessibility Snapshot、DOM、视觉和 Human Mode。
- 多 Profile、Cookie、代理和多账号隔离。
- 浏览器录制、Workflow、运行证据和回放。
- 下载、媒体捕获、页面事件和文件操作。
- TypeScript / Python SDK。
- Brain、Memory、Scheduler、人工接管、Bot 和插件框架。
- Workflow、Scheduler、部分 Brain Memory 已持久化。

### 缺口 Z-A：浏览器完整，但桌面控制没有闭环

仓库中已经存在系统级 `InputSimulator`：

- Windows SendInput。
- macOS CGEvent。
- 鼠标移动、点击、拖拽、滚动、文本和快捷键。
- 明确不局限于浏览器窗口。

但当前没有发现它被完整接入主要 IPC、MCP 和产品调用链。

即使直接暴露 InputSimulator，也仍缺少：

- 全屏与任意窗口截图。
- 操作系统窗口枚举。
- 当前前台窗口和焦点状态。
- Windows UI Automation。
- macOS Accessibility Tree。
- 控件级定位。
- 动作后的状态验证。

当前 `list_windows` 基于 Chromium `BrowserList`，不能枚举所有桌面应用窗口。

### 缺口 Z-B：缺少桌面安全会话

完整桌面控制不能仅依靠全局鼠标键盘事件，需要：

- Desktop Session Lease。
- 目标窗口绑定。
- 前台窗口校验。
- 截图版本号和过期检测。
- 坐标系、DPI、多显示器标准化。
- 用户移动鼠标后的自动暂停。
- 敏感窗口和密码框保护。
- UAC / Secure Desktop 明确拒绝。

### 缺口 Z-C：高风险工具只有文字标签

现有工具描述使用 `[MUTATION]`、`[READONLY]` 等文本，但没有机器可执行的结构化风险元数据。

无法可靠表达：

- 读取还是修改。
- 本地修改还是外部副作用。
- 是否涉及 Cookie、凭证或隐私。
- 是否不可逆。
- 是否必须在提交前审批。
- 允许访问哪些 Profile、域名、文件和窗口。

### 缺口 Z-D：Brain 任务状态不持久

Unzoo Brain 的任务表仍为进程内 `HashMap`。服务重启后任务状态消失。

目前存在多套状态体系：

- Brain Task。
- Workflow Run。
- Scheduler Job。
- Human Action Report。
- Operation Log。

它们还没有汇聚为同一种 Task / Run / Step / Event 模型。

### 缺口 Z-E：本地服务认证不足以承载桌面控制

REST 在 localhost 且没有配置 API Key 时可以跳过认证。

对于普通浏览器自动化尚可作为开发便利，但桌面输入、Cookie、文件和账号控制接入后，应默认要求：

- Client Identity。
- 短期 Access Token。
- Capability Lease。
- Token 轮换和撤销。
- 每次调用关联 Task ID。

### 缺口 Z-F：操作审计不统一

REST Audit、Workflow Evidence、Human Action Report 和 OpLogger 各自存在。其中 OpLogger 是内存环形队列。

需要统一为可持久化、可查询、可关联 Task/Approval/Artifact 的事件记录。

## 4. 目标产品架构

```text
┌─────────────────────────────────────────────────────────────┐
│                 Experience / Channel Layer                  │
│ Desktop UI · CLI · Mobile · Web · Telegram · 企业微信       │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                     Personal Assistant API                  │
│ Conversations · Tasks · Approvals · Artifacts · Notifications│
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    Nissewyn Core (one-core)                 │
│                                                             │
│ Workspace          Task Engine        Brain Router          │
│ Scheduler          Policy Engine      Artifact Registry     │
│ Identity/Vault     Event Bus          Audit/Observability   │
│ Provider Registry  Recovery           Cost/Quota Router     │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
       Brain Adapter Bus              Capability Provider Bus
               │                              │
  ┌────────────┼─────────────┐       ┌────────┼──────────────┐
  │            │             │       │        │              │
Codex SDK  Claude SDK   Gemini/ACP  Unterm    Unzoo         Connectors
Codex CLI  Claude CLI   OpenCode    Terminal  Browser        Mail
                                    PTY/Files Computer       Calendar
                                              Profiles       Docs/IM
```

## 5. 核心协议

### 5.1 Brain Adapter

所有大脑实现统一接口：

```text
brain.start(task, context, tools) -> thread_id
brain.resume(thread_id, input)
brain.events(thread_id) -> EventStream
brain.approve(thread_id, approval_id, decision)
brain.interrupt(thread_id)
brain.snapshot(thread_id)
brain.usage(thread_id)
```

规范化事件：

```text
message.delta
reasoning.summary
tool.requested
tool.started
tool.completed
approval.requested
artifact.created
usage.updated
thread.completed
thread.failed
```

首批 Adapter：

1. Codex SDK。
2. Codex CLI JSONL。
3. Claude Agent SDK。
4. Claude CLI。
5. Gemini CLI / ACP。
6. OpenCode。

### 5.2 Capability Provider

Unterm、Unzoo 和连接器统一声明能力：

```json
{
  "provider_id": "unzoo.local",
  "version": "2.x",
  "capabilities": [
    {
      "name": "browser.navigate",
      "risk": "local_mutation",
      "scopes": ["profile", "domain"],
      "reversible": true,
      "evidence": ["before", "after"]
    }
  ]
}
```

Provider 必须实现：

```text
provider.discover
provider.health
provider.capabilities
provider.acquire_lease
provider.renew_lease
provider.release_lease
provider.invoke
provider.cancel
provider.events
```

### 5.3 Capability Grant

授权票据至少包含：

```json
{
  "grant_id": "grant_xxx",
  "task_id": "task_xxx",
  "subject": "brain:codex",
  "provider": "unzoo.local",
  "capabilities": ["browser.read", "browser.act"],
  "resources": {
    "profiles": ["work"],
    "domains": ["example.com"],
    "windows": [],
    "paths": []
  },
  "expires_at": "2026-07-26T18:00:00+08:00",
  "approval_mode": "before_external_commit"
}
```

### 5.4 风险等级

| 等级 | 示例 | 默认策略 |
|---|---|---|
| `readonly` | 截图、读取网页、列目录 | 可自动执行 |
| `local_mutation` | 编辑本地文件、打开标签页 | 在任务授权范围内执行 |
| `external_side_effect` | 发消息、发布内容、提交表单 | 提交前审批 |
| `credential_access` | 读取 Cookie、密码、Token | 显式短期授权 |
| `financial` | 购买、支付、转账 | 每次审批 |
| `destructive` | 删除、覆盖、撤销账号 | 每次审批并显示影响范围 |

## 6. 职责划分与 Issue 对照

> **2026-08-06 归属修订**：本节原为「Unterm 产品需求 U-001~U-007」，把 Task Engine、Brain Runtime、
> Policy/Approval、Provider Registry、Audit/Artifact 全部指派给 Unterm。该划分已纠正。

### 6.1 划分原则

1. **控制平面必须是产品自身。** 平台能力寄生在某个 Provider 上，会导致：卸载该 Provider 等于卸载产品；
   产品迭代要等 Provider 发版；不需要该 Provider 的用户被迫安装它。
2. **Provider 提供能力并守住自己的门；One 决定何时使用该能力。**
3. **授权两层，纵深防御。** One 决定「该不该做」，Provider 决定「能不能在我这里做」。
4. **边界对象由 `contracts/v0` 统一定义**，三仓库共同冻结，任何一方不单独定义。

### 6.2 Nissewyn 自身实现（P0）

| 能力 | Issue |
|---|---|
| `contracts/v0` 跨仓库对象与错误 schema 冻结 | `nissewyn#3` |
| One Core 自有常驻运行时 | `nissewyn#4` |
| Durable Task Engine | `nissewyn#5` |
| Policy、Approval、Grant 与 Inbox | `nissewyn#6` |
| Provider Registry：发现、协商、租约与编排 | `nissewyn#7` |
| Artifact Registry 与跨 Provider 证据链 | `nissewyn#8` |
| Workspace Context & Isolation | `nissewyn#9` |
| Brain Router：多脑路由、成本配额与 handoff | `nissewyn#10` |
| Tool Routing：强制意图路由 | `nissewyn#11` |
| Distribution & Runtime Supervisor | `nissewyn#12` |
| 平台能力（记忆/触发器/连接器/模型路由/移动审批，P1） | `nissewyn#13` |

### 6.3 Unterm 作为 Terminal Provider

| 能力 | Issue |
|---|---|
| 0.60 终端 parity gate（**唯一前置**） | `unterm#24` |
| True Headless Core：终端会话与 MCP 脱离 GUI | `unterm#12` |
| 终端内 Agent 会话的结构化事件流 | `unterm#13` |
| Terminal Action Gateway：唯一本地执行闸门 | `unterm#15` |
| PTY 授权旁路修复 | `unterm#16`（已完成） |
| Terminal 持久化动作日志 | `unterm#18` |
| Managed Agent 约束：不得绕过 Gateway | `unterm#22` |
| Path Scope 强制校验 | `unterm#26` |
| Provider Manifest、Lease 与 Task Context 接入 | `unterm#27` |
| 可被托管的运行时契约 | `unterm#28` |

Epic：`unterm#20`。Unterm 不实现通用 Task 引擎、Provider Registry、Workspace 模型、
Artifact Registry、Memory/Scheduler/Connector/Model Router 与三进程 Supervisor。

**Unterm 是可选组件**：MVP 场景 A（网页调研生成报告）不涉及终端，用户不该被迫安装它。

### 6.4 同一能力的三方分层

| 能力 | Nissewyn | Unterm | Unzoo |
|---|---|---|---|
| 任务 | 全局 Task/Run/Step（#5） | 局部会话记录（#12） | Provider durable state（`unzoo#101`） |
| 授权 | Grant/Approval/Inbox（#6） | 本地执行闸门（#15） | Control Surface Enforcement（`unzoo#82`/`#97`） |
| 路径 | Workspace 模型（#9） | path scope 强制（#26） | filesystem sandbox（`unzoo#108`） |
| 编排 | Registry 主动面（#7） | manifest/lease 被动面（#27） | Provider binding（`unzoo#70`/`#107`） |
| 产物 | Artifact Registry（#8） | 产物引用（#18） | Workflow evidence |
| 大脑 | 多脑路由与计费（#10） | 终端内 Agent 事件流（#13） | 浏览器局部自动驾驶 |
| 分发 | Supervisor 与安装（#12） | 可被托管（#28） | Managed Runtime（`unzoo#79`/`#105`） |

## 7. Unzoo 产品需求

## P0

### Z-001：ComputerProvider 观察接口

新增：

```text
computer.list_displays
computer.screenshot
computer.list_windows
computer.get_foreground_window
computer.focus_window
computer.accessibility_snapshot
computer.find_element
```

平台：

- Windows：UI Automation / IUIAutomation。
- macOS：AXUIElement。

验收：

- 能枚举浏览器之外的应用窗口。
- 截图返回 display/window ID、坐标、DPI、时间戳和 frame_id。
- Accessibility Snapshot 可稳定定位按钮、输入框、菜单等控件。

### Z-002：Secure Desktop Input

把现有 InputSimulator 接入：

```text
computer.move
computer.click
computer.double_click
computer.drag
computer.scroll
computer.type
computer.hotkey
computer.key_down
computer.key_up
```

验收：

- 没有有效 Capability Lease 时全部拒绝。
- 默认限定到指定窗口。
- 前台窗口变化时自动停止。
- 用户主动移动鼠标或输入时自动暂停 Agent。
- 每个动作返回统一 Action Contract。

### Z-003：Observe–Act–Verify

每个桌面动作必须：

1. 获取目标窗口和 frame_id。
2. 检查截图是否过期。
3. 检查目标窗口是否仍为前台。
4. 执行动作。
5. 获取动作后截图或 Accessibility 差异。
6. 返回成功证据或明确错误码。

建议错误码：

```text
stale_frame
foreground_changed
target_not_found
target_occluded
protected_surface
user_interrupted
permission_denied
verification_failed
```

### Z-004：Structured Risk Metadata

所有 MCP/SDK 工具提供结构化：

```text
risk
side_effect
resource_scopes
sensitive_inputs
reversible
approval_mode
evidence_policy
```

验收：

- 不再依赖描述文本中的 `[MUTATION]` 做安全判断。
- Workflow 内工具不能绕过其独立风险策略。
- `social_post`、Cookie 导出、文件覆盖等能被上层策略准确识别。

### Z-005：Mandatory Local Authentication

要求：

- localhost 默认也认证。
- 安装时生成 Client Identity。
- 支持短期 Token 与 Capability Lease。
- 支持撤销和轮换。
- 插件、Unterm、独立 SDK Client 使用不同身份。

验收：

- 未认证本地进程无法调用敏感 REST/MCP。
- 泄漏的单任务 Token 不能访问其他 Profile 或窗口。
- 撤销绑定后旧 Token 立即失效。

### Z-006：Unterm Native Binding

要求：

- 安装器自动发现并注册 Unterm。
- 提供 Provider Manifest、Health、Events。
- 所有调用接受 Task Context 和 Grant。

验收：

- Unterm 中可以查看 Unzoo 版本、状态、Profile 和可用能力。
- Unterm 取消任务后 Unzoo 停止对应 workflow/CUA/desktop action。
- Evidence 自动回传 Unterm Artifact Registry。

### Z-007：统一任务、取消与审计关联

要求：

- Brain、Workflow、Scheduler、Human Mode 共用关联字段。
- 现有内部执行系统可以保留，但必须接受外部 `task_id/run_id`。

验收：

- 任意动作可以反查来源 Task、Brain、Approval 和 Capability Grant。
- 服务重启后历史仍可查询。
- CUA、Workflow 和桌面动作支持可靠取消。

## P1

- Z-101：Windows/macOS 桌面能力一致性。
- Z-102：密码框、银行页面、隐私窗口和受保护内容遮罩。
- Z-103：多显示器、缩放与远程桌面坐标标准化。
- Z-104：桌面操作录制、参数化、回放和证据。
- Z-105：微信、Office、文件管理器等桌面 App Skill。
- Z-106：桌面接管实时画面和手机端审批。

## 8. 建议开发顺序

### 第一阶段：安全地跑起来

1. 冻结 `contracts/v0` 跨仓库契约（P0-Blocker）。
2. 建立 `one-core` 自有常驻运行时。
3. 在 One 中建立 Durable Task Engine 与 Policy/Approval。
4. 实现 Provider Registry，先接 Unzoo Browser（不依赖终端即可跑通场景 A）。
5. 实现 Brain Router 与 Codex/Claude Adapter。
6. Unterm 完成 0.60 parity gate 后，作为 Terminal Provider 接入。

### 第二阶段：浏览器数字同事

1. One 持有全局 Task、Policy、Memory。
2. Unzoo 作为 Browser Provider。
3. 接入 Workflow Evidence。
4. 实现 Scheduler、通知、人工审批。
5. 接入 Claude、Gemini、OpenCode。

### 第三阶段：完整 Computer Use

1. Unzoo 实现桌面截图和窗口枚举。
2. 实现 UI Automation / Accessibility。
3. 安全接通 InputSimulator。
4. 实现 Observe–Act–Verify。
5. 加入敏感应用保护与用户抢占。

### 第四阶段：真正的个人助理

1. 长期记忆。
2. 邮件、日历、联系人和文档。
3. 手机端。
4. 主动触发和长期任务。
5. 多设备同步与可选私有云中继。

## 9. MVP 范围

首个可用版本建议只承诺：

- Unterm Core 无头运行。
- Codex 和 Claude 两个 Brain Adapter。
- Unterm Terminal Provider。
- Unzoo Browser Provider。
- SQLite Task Engine。
- 统一审批与审计。
- Cron 和 Webhook。
- Desktop UI 中查看任务、审批和产物。

暂不在首个版本承诺：

- 任意桌面软件自动操作。
- 自动支付。
- 无审批对外发布。
- 完整跨设备同步。
- 大规模企业多租户。

## 10. 最终判断

这个组合具备成为真正个人数字助理的基础，但核心竞争力不能只是“可调用很多工具”。

真正的产品壁垒是：

> 多大脑、全能力执行、长期任务、个人记忆、细粒度授权、动作验证与完整证据。

在目标架构中：

- **Nissewyn 是数字同事本身——操作系统与控制中心。**
- **Unzoo 是它操作网页和电脑的眼睛与手。**
- **Unterm 是它操作终端的手，同时也是一个可独立存在的终端产品。**
- **Codex、Claude 等是可以按任务切换的大脑。**

只要坚持这一职责边界，就能避免重复造轮子，并形成比单一 Agent、单一模型或单纯浏览器自动化更强的完整系统。

关键在于：控制平面必须属于产品自身。把它托付给任何一个 Provider，产品就失去了独立演进的能力，
而那个 Provider 也会被迫背上不属于它的复杂度。
