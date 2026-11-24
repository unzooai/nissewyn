# Unzoo One

**Your Personal AI Operating System.**

Unzoo One 是一个本地优先、可更换大脑、可持续运行、可审计，并能安全操作终端、浏览器和桌面应用的 AI 超级工作台。

核心组合：

- **Unterm**：任务、会话、大脑路由、权限、审批、记忆、调度、审计与产物。
- **Unzoo**：浏览器与桌面操作执行器，负责观察、行动、验证与证据。
- **Codex / Claude / Gemini / OpenCode**：可插拔 AI Brain。
- **MCP / SDK / ACP**：能力和大脑接入协议。

## 产品设计

- [完整产品文档索引](docs/README.md)
- [整体产品架构与能力审计](docs/product-architecture.md)
- [MVP 产品规格](docs/mvp-product-spec.md)
- [产品体验、页面与异常状态规格](docs/product-experience-spec.md)
- [核心领域模型与协议契约](docs/domain-model-and-contracts.md)
- [`contracts/v0` 跨仓库 JSON Schema](contracts/v0/README.md)（三仓库唯一事实来源）
- [`one-core` 常驻运行时](one-core/README.md)（骨架：认证 IPC、单实例、SQLite、事件 cursor）
- [安全与信任模型](docs/security-and-trust-model.md)
- [Connector、Skill 与生态规范](docs/connectors-skills-and-ecosystem.md)
- [分发、数据与运行保障](docs/distribution-data-and-operations.md)
- [产品指标与验证计划](docs/product-metrics-and-validation.md)
- [交付路线图与开发 Backlog](docs/delivery-roadmap.md)
- [OpenWorker 参考分析与能力覆盖策略](docs/openworker-reference-analysis.md)
- [Unzoo 品牌家族与 Unzoo One UI 系统](docs/brand-and-ui-system.md)
- [C1 / Flow One 完整品牌识别系统](docs/c1-brand-identity-system.md)
- [打开 C1 完整品牌系统预览](brand/c1/brand-system-preview.html)
- [C1 产品设计系统](docs/c1-product-design-system.md)
- [关键页面与状态蓝图](docs/key-screen-blueprints.md)
- [打开 C1 产品设计预览](brand/c1/product-design-preview.html)
- [运行 C1 桌面 UI 原型](apps/desktop-ui/README.md)
- [桌面 UI 实现状态与接入 Backlog](docs/ui-prototype-implementation.md)
- [超级工作台 Context、角色与执行治理](docs/super-workbench-context-and-governance.md)
- [打开品牌与 UI 预览](brand/preview.html)

## 当前阶段

项目已进入产品架构、跨仓库契约、核心运行时与桌面 UI 原型并行验证阶段。首个目标是完成：

1. Unterm 真正无头运行。
2. Codex 与 Claude Brain Adapter。
3. 持久化 Task Engine。
4. Unzoo Browser Provider 原生绑定。
5. 统一 Policy、Approval、Audit 与 Artifact。
6. Ask / Work / Code / Automate 四种任务入口。
7. 统一 Approval Inbox、MCP Connector 导入和首批邮件/日历/消息连接。

## Web 控制台（`app/`）

仓库内置 Unzoo One 的 Web 控制台原型（来自 codex 前端线），技术栈为
Next.js 16 + React 19 + [vinext](https://github.com/cloudflare/vinext)，运行在
Cloudflare Worker 上，可选 D1 / R2 绑定。

```bash
npm install     # 依赖锁定在 package-lock.json
npm run dev     # 本地开发
npm run build   # 验证 vinext 构建产物
npm test        # 构建 + 渲染骨架测试
npm run lint
```

### 两个构建目标

| 命令 | 产物 | 用途 |
| --- | --- | --- |
| `npm run build` | `dist/server`（Worker） | 云端演示版，SSR + API routes，数据走内存 mock |
| `npm run build:static` | `dist/client`（静态文件） | 本地版，交给 unterm 托管 |

静态版是预渲染的完整首屏，不是白屏 SPA。

### 交给 unterm 托管

unterm 0.71 起，`unterm-settings` 的 HTTP 服务（固定端口 19877）可以直接托管
这套静态产物：

```bash
npm run build:static
# 开发时把 unterm 指向产物目录，改完前端刷新浏览器即可
UNTERM_CONSOLE_DIR=D:/code/unzoo-one/dist/client unterm
# 然后访问 http://127.0.0.1:19877/console/
```

安装版会把产物放在 `<unterm 安装目录>/console`，不需要设环境变量。

同源之后控制台直接调 unterm 的 `/api/*`：页面加载时先取一次
`/bootstrap.json` 拿 auth token，后续请求带 Bearer，和 unterm 自己的设置页
是同一套机制。这条路下本仓库的 `app/api/*` 代理不参与，也不用配置令牌。

### 数据从哪来

组件只依赖 `app/lib/provider.ts` 的契约，实现在 `app/lib/workspace-provider.ts`
里选：

- `provider-mock.ts` — 内存数据，云端演示和离线兜底都用它
- `provider-live.ts` — 真实后端，能接的走本机 unzoo / unterm，接不上自动
  落回 mock

所以云端和本地跑的是同一份代码，区别只在于有多少数据是真的。

脚手架细节、ChatGPT 登录（SIWC）与 D1 迁移说明见
[Web 控制台脚手架说明](docs/web-console-setup.md)。
