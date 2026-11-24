# `contracts/v0`

> 状态：Draft（已实现，未冻结）
> 日期：2026-09-03
> 对应：ONE-C001 / `unzoo-one#3`（P0-Blocker）

三个仓库之间的唯一事实来源。`unzoo-one`、`unterm`、`unzoo` 交换的每一个对象都在
这里定义，Rust / TypeScript / Python 的类型由它生成或对照校验，不各写一份。

文字规范在 [`docs/domain-model-and-contracts.md`](../../docs/domain-model-and-contracts.md)
和 [`docs/security-and-trust-model.md`](../../docs/security-and-trust-model.md)。
两边不一致时**以本目录的 schema 为准**，并回头修文档。

## 目录

```text
contracts/v0/
  common/      primitives（ID、时间、哈希、Actor、敏感度）、error
  task/        task、run、step、tool-call、approval、inbox-item
  brain/       adapter（Brain manifest）、thread（含 turn）、events
  provider/    manifest、invoke（invoke/get_action/cancel_action）、action-result
  security/    risk、capability-grant、policy-decision
  workspace/   workspace、capability-scope
  artifact/    artifact
  automation/  automation
  events/      envelope（Core 对外事件信封）
  examples/    每个 schema 的示例 + 一次完整任务的事件流
  invalid/     反例固件，每条对应一条真实约束
```

`$id` 与路径一一对应：`https://contracts.unzoo.ai/v0/<相对路径>`。这个 URL 是标识符，
不需要能访问。

## 怎么用

```bash
npm run test:contracts
```

校验器在 [`tests/contracts.test.mjs`](../../tests/contracts.test.mjs)：编译全部 schema、
跑通全部示例、确认全部反例被拒绝。跨文件 `$ref` 断了会当场红。

其他语言接入时，把 `contracts/v0` 整个目录喂给各自的 JSON Schema 库，按 `$id` 取。
禁止把 schema 复制到别的仓库——要用就引用这一份。

## 三条硬规矩

1. **每个对象都带 `schema_version`**，且是常量（`task.v0`、`grant.v0`……）。它是可判别
   字段，v1 上线后靠它区分两版数据。
2. **新字段默认可忽略**。因此 schema 不设 `additionalProperties: false`——收到不认识的
   字段就跳过，不要报错。破坏性变更（删字段、改语义、收窄枚举）必须升 major，开新目录。
3. **错误只按 `code` 分支**。`message` 随版本变，`user_message` 随语言变，都不是接口。

## schema 管不到的规则

以下是真实约束，但 JSON Schema 表达不了，由 Core 和 Provider 在代码里保证。列在这里是
为了不让人误以为「schema 过了就等于安全」：

| 规则 | 谁来保证 |
|---|---|
| Grant 的资源范围 ⊆ 它所依据的 Approval 的范围 | Policy Gateway 签发时校验，Provider 执行时复验 |
| `arguments_hash` 与实际参数一致 | Provider 执行前重算比对，对不上就拒绝并重新审批 |
| Step 的 `depends_on` 不含自身、依赖图无环 | Core 写入时校验 |
| 同一 Approval 只有一个 InboxItem | Core 唯一索引 |
| Approval 只能解决一次，第一响应者胜出 | Core compare-and-set |
| 事件 `sequence` 在 Task 内单调、`prev_hash` 成链 | Core 追加时保证，导出时附 manifest 校验 |
| 幂等键相同则不重复执行 | Provider 保存最近的 key/result 直到 retention 到期 |
| 未声明风险的第三方工具按 `external_side_effect` 处理 | Core 注册工具时兜底 |

## 已经落在 schema 里的安全约束

这些是能被自动验证的，反例固件逐条守着：

- `read` 工具不能声明副作用；`credential_access` / `financial` / `destructive` 不能声明成
  自动或按范围放行，`financial` / `destructive` 必须二次确认。
- 高风险 Grant 必须一次性、绑定到具体 ToolCall、且来自一次明确 Approval；
  `read` 之外的 Grant 一律要有 Approval。
- 常驻授权（Automation standing grant）里不允许出现高风险等级。
- 浏览器范围给了 `act`/`download`/`upload` 就必须限定域名；Connector 给了写权限就必须
  给确切目标。
- ToolCall 进入 `authorized` 之后必须有 `grant_id`，派发之后必须有 `action_id`——包括
  `unknown`，否则无从 reconcile。
- `unknown` 的 ActionResult 只能建议 `reconcile_first`，不能建议直接重试。
- 不可逆的动作必须留 before/after 证据；截图默认 private；证据类 Artifact 必须说明脱敏
  做没做过。
- 所有时间必须是 UTC（以 `Z` 结尾）。

## 改动流程

1. 改 schema，同步改 `examples/` 里对应的示例。
2. 新增约束时，在 `invalid/` 补一条反例，把要防的事写进 `reason`。
3. 新增 schema 时，在 `examples/index.json` 补一条——否则覆盖率断言会红。
4. 跑 `npm run test:contracts`。
5. 在 `CHANGELOG.md` 记一笔，注明是否破坏兼容。

## 冻结状态

目录已建成、示例和反例齐备、测试全绿，但**尚未冻结**。冻结需要
`unzoo-one` / `unterm` / `unzoo` 三方共同评审（M0 退出标准）。在那之前，v0 可以直接改。
