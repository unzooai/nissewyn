# `contracts/v0` 变更记录

版本策略：新增可选字段、新增事件类型、放宽约束 —— 向后兼容，记在这里即可。
删字段、改语义、收窄枚举、改必填 —— 破坏兼容，必须升 major 并开新目录。

## 2026-09-03 — 初版

建立 22 个 schema、24 个示例、29 个反例固件，全部通过
`npm run test:contracts`。对应 ONE-C001 / `unzoo-one#3`。

新增：

- `common/` — primitives（ID/时间/哈希/Actor/敏感度/预算/保留期）、error
- `task/` — task、run、step、tool-call、approval、inbox-item
- `brain/` — adapter、thread（含 turn）、events
- `provider/` — manifest、invoke、action-result
- `security/` — risk、capability-grant、policy-decision
- `workspace/` — workspace、capability-scope
- `artifact/` — artifact
- `automation/` — automation
- `events/` — envelope

与文字规范的三处出入，以 schema 为准，文档已同步：

1. `approval.allowed_decisions` 的取值采用安全模型 §11 的四个
   （`allow_once` / `allow_for_task` / `allow_exact_for_automation` / `deny`）。
   领域模型 §8 的示例里写的是 `allow_for_automation`，已改。
2. `grant.resources` 采用安全模型 §10 的分类型范围（files / terminal / browser /
   desktop / connector），不是领域模型 §9 示例里的扁平结构。同一份定义由 Grant、
   Approval 的 canonical payload 和 Provider 校验共用——分开写就没法判断有没有越界。
3. 目录布局采用领域模型 §19 的 `contracts/v0/<域>/`，不是交付路线图 §4 的
   `contracts/<域>/v0/`。路线图已同步。

尚未纳入 v0（M5 之前不需要，避免冻结用不上的东西）：

- Memory（领域模型 §14）
- Connector 自身的配置与凭证声明
- Model Router 的路由策略
